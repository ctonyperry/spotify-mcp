import { HttpError, RateLimitError, TransientError, isRetryableError } from '../errors/index.js';
import { requestId, nowMs, sleep } from '../utils/index.js';
import type { Logger } from '../logging/index.js';
import type { HttpOptions, HttpHooks, HttpClient } from './types.js';

function parseRetryAfter(retryAfterHeader: string | null): number | undefined {
  if (!retryAfterHeader) return undefined;
  
  const seconds = parseInt(retryAfterHeader, 10);
  return isNaN(seconds) ? undefined : seconds * 1000;
}

function calculateRetryDelay(attempt: number, baseDelay: number, jitter: boolean): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  
  if (!jitter) {
    return exponentialDelay;
  }
  
  // Add jitter: ±25% of the delay
  const jitterFactor = 0.25;
  const jitterAmount = exponentialDelay * jitterFactor;
  const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount;
  
  return Math.max(0, exponentialDelay + randomJitter);
}

export class RetryableHttpClient implements HttpClient {
  private hooks: HttpHooks = {};

  constructor(private readonly logger: Logger) {}

  setHooks(hooks: HttpHooks): void {
    this.hooks = hooks;
  }

  async fetchJSON<T = unknown>(url: string, options: HttpOptions = {}): Promise<T> {
    const {
      timeout = 30000,
      retries = 3,
      retryDelay = 1000,
      retryJitter = true,
      ...fetchOptions
    } = options;

    const reqId = requestId();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      const startTime = nowMs();

      try {
        await this.hooks.beforeRequest?.(url, options, reqId);

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const durationMs = nowMs() - startTime;

        await this.hooks.afterRequest?.(url, response, reqId, durationMs);

        this.logger.debug('HTTP request completed', {
          requestId: reqId,
          method: fetchOptions.method || 'GET',
          url,
          status: response.status,
          durationMs,
          attempt,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          
          if (response.status === 429) {
            const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
            const error = new RateLimitError(
              `Rate limited: ${errorText}`,
              response.status,
              url,
              retryAfterMs
            );
            
            if (attempt <= retries) {
              const delayMs = retryAfterMs || calculateRetryDelay(attempt, retryDelay, retryJitter);
              await this.hooks.onRetry?.(url, error, attempt, reqId);
              this.logger.warn('Rate limited, retrying', {
                requestId: reqId,
                url,
                attempt,
                delayMs,
                retryAfterMs,
              });
              await sleep(delayMs);
              continue;
            }
            throw error;
          }

          const error = new HttpError(
            `HTTP ${response.status}: ${errorText}`,
            response.status,
            url
          );

          if (response.status >= 500 && attempt <= retries) {
            await this.hooks.onRetry?.(url, error, attempt, reqId);
            const delayMs = calculateRetryDelay(attempt, retryDelay, retryJitter);
            this.logger.warn('Server error, retrying', {
              requestId: reqId,
              url,
              status: response.status,
              attempt,
              delayMs,
            });
            await sleep(delayMs);
            continue;
          }

          throw error;
        }

        // Parse JSON response
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new HttpError(
            `Expected JSON response, got ${contentType}`,
            response.status,
            url
          );
        }

        const data = await response.json() as T;
        return data;

      } catch (error) {
        const durationMs = nowMs() - startTime;
        lastError = error as Error;

        this.logger.error('HTTP request failed', {
          requestId: reqId,
          url,
          error: lastError.message,
          attempt,
          durationMs,
        });

        // Handle timeout
        if (lastError.name === 'AbortError') {
          lastError = new TransientError(`Request timeout after ${timeout}ms`, 'REQUEST_TIMEOUT', lastError);
        }

        // Check if we should retry
        if (attempt <= retries && isRetryableError(lastError)) {
          await this.hooks.onRetry?.(url, lastError, attempt, reqId);
          const delayMs = calculateRetryDelay(attempt, retryDelay, retryJitter);
          this.logger.warn('Network error, retrying', {
            requestId: reqId,
            url,
            error: lastError.message,
            attempt,
            delayMs,
          });
          await sleep(delayMs);
          continue;
        }

        // No more retries or non-retryable error
        throw lastError;
      }
    }

    // Should never reach here, but TypeScript needs this
    throw lastError || new TransientError('Unexpected error in retry loop');
  }
}

export function createHttpClient(logger: Logger): HttpClient {
  return new RetryableHttpClient(logger);
}
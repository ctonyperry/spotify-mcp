import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHttpClient, RetryableHttpClient } from '../../http/client.js';
import { createLogger } from '../../logging/logger.js';
import { HttpError, RateLimitError, TransientError } from '../../errors/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HTTP Client', () => {
  let client: RetryableHttpClient;
  let logger: ReturnType<typeof createLogger>;
  
  beforeEach(() => {
    logger = createLogger('debug');
    client = createHttpClient(logger) as RetryableHttpClient;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful requests', () => {
    it('should make successful JSON request', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      const result = await client.fetchJSON('https://api.test.com/data');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('https://api.test.com/data', {
        signal: expect.any(AbortSignal),
      });
    });

    it('should pass through request options', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      await client.fetchJSON('https://api.test.com/data', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer token' },
        body: JSON.stringify({ test: true }),
      });

      expect(mockFetch).toHaveBeenCalledWith('https://api.test.com/data', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer token' },
        body: JSON.stringify({ test: true }),
        signal: expect.any(AbortSignal),
      });
    });
  });

  describe('error handling', () => {
    it('should throw HttpError for 4xx status', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Bad Request', {
        status: 400,
        statusText: 'Bad Request',
      }));

      await expect(client.fetchJSON('https://api.test.com/data'))
        .rejects
        .toThrow(HttpError);
        
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries for 4xx
    });

    it('should throw error for non-JSON response', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Not JSON', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }));

      await expect(client.fetchJSON('https://api.test.com/data'))
        .rejects
        .toThrow(HttpError);
    });
  });

  describe('rate limiting', () => {
    it('should handle 429 with Retry-After header', async () => {
      // First call: 429 with retry-after
      mockFetch.mockResolvedValueOnce(new Response('Rate limited', {
        status: 429,
        headers: { 'retry-after': '1' }, // 1 second
      }));

      // Second call: success
      mockFetch.mockResolvedValueOnce(new Response('{"success": true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      const startTime = Date.now();
      const result = await client.fetchJSON('https://api.test.com/data', {
        retryDelay: 100, // Override for faster test
      });
      const elapsed = Date.now() - startTime;

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(elapsed).toBeGreaterThanOrEqual(900); // Should wait ~1000ms
    });

    it('should throw RateLimitError after max retries', async () => {
      mockFetch.mockResolvedValue(new Response('Rate limited', {
        status: 429,
        headers: { 'retry-after': '1' },
      }));

      await expect(client.fetchJSON('https://api.test.com/data', {
        retries: 2,
        retryDelay: 10,
      }))
        .rejects
        .toThrow(RateLimitError);

      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('server error retries', () => {
    it('should retry on 5xx errors with exponential backoff', async () => {
      // Mock server errors followed by success
      mockFetch
        .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
        .mockResolvedValueOnce(new Response('Server Error', { status: 502 }))
        .mockResolvedValueOnce(new Response('{"success": true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }));

      const startTime = Date.now();
      const result = await client.fetchJSON('https://api.test.com/data', {
        retries: 3,
        retryDelay: 50,
        retryJitter: false, // Disable jitter for predictable timing
      });
      const elapsed = Date.now() - startTime;

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      // Should wait: 50ms + 100ms = 150ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(140);
    });

    it('should apply jitter to retry delays', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
        .mockResolvedValueOnce(new Response('{"success": true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }));

      // Run multiple times to test jitter randomness
      const delays: number[] = [];
      for (let i = 0; i < 5; i++) {
        vi.clearAllMocks();
        mockFetch
          .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
          .mockResolvedValueOnce(new Response('{"success": true}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }));

        const start = Date.now();
        await client.fetchJSON('https://api.test.com/data', {
          retryDelay: 100,
          retryJitter: true,
        });
        delays.push(Date.now() - start);
      }

      // Delays should vary due to jitter (not all exactly 100ms)
      const uniqueDelays = new Set(delays.map(d => Math.round(d / 10)));
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('timeout handling', () => {
    it('should handle aborted requests as transient errors', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(client.fetchJSON('https://api.test.com/data', {
        retries: 0,
      }))
        .rejects
        .toThrow(TransientError);
    });
  });

  describe('network error retries', () => {
    it('should retry on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNRESET: Connection reset'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT: Request timeout'))
        .mockResolvedValueOnce(new Response('{"success": true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }));

      const result = await client.fetchJSON('https://api.test.com/data', {
        retryDelay: 10,
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = new Error('Non-retryable error');
      mockFetch.mockRejectedValue(nonRetryableError);

      await expect(client.fetchJSON('https://api.test.com/data'))
        .rejects
        .toThrow(nonRetryableError);

      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('hooks', () => {
    it('should call hooks in correct order', async () => {
      const hooks = {
        beforeRequest: vi.fn(),
        afterRequest: vi.fn(),
        onRetry: vi.fn(),
      };

      client.setHooks(hooks);

      mockFetch.mockResolvedValueOnce(new Response('{"data": "test"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      await client.fetchJSON('https://api.test.com/data');

      expect(hooks.beforeRequest).toHaveBeenCalledWith(
        'https://api.test.com/data',
        expect.any(Object),
        expect.stringMatching(/^[0-9a-f-]{36}$/) // UUID format
      );

      expect(hooks.afterRequest).toHaveBeenCalledWith(
        'https://api.test.com/data',
        expect.any(Response),
        expect.stringMatching(/^[0-9a-f-]{36}$/),
        expect.any(Number)
      );

      expect(hooks.onRetry).not.toHaveBeenCalled();
    });

    it('should call onRetry hook during retries', async () => {
      const hooks = { onRetry: vi.fn() };
      client.setHooks(hooks);

      mockFetch
        .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
        .mockResolvedValueOnce(new Response('{"success": true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }));

      await client.fetchJSON('https://api.test.com/data', { retryDelay: 10 });

      expect(hooks.onRetry).toHaveBeenCalledWith(
        'https://api.test.com/data',
        expect.any(HttpError),
        1, // Attempt number
        expect.stringMatching(/^[0-9a-f-]{36}$/)
      );
    });
  });
});
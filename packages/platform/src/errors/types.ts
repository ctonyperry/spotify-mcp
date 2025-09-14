import { BaseError, type ErrorMeta } from './base.js';

export class ConfigError extends BaseError {
  constructor(
    message: string,
    code: string = 'CONFIG_ERROR',
    cause?: Error,
    meta?: ErrorMeta
  ) {
    super(message, code, cause, meta);
  }
}

export class AuthError extends BaseError {
  constructor(
    message: string,
    code: string = 'AUTH_ERROR',
    cause?: Error,
    meta?: ErrorMeta
  ) {
    super(message, code, cause, meta);
  }
}

export class HttpError extends BaseError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
    code: string = 'HTTP_ERROR',
    cause?: Error,
    meta?: ErrorMeta
  ) {
    super(message, code, cause, { ...meta, status, url });
  }
}

export class RateLimitError extends HttpError {
  constructor(
    message: string,
    status: number,
    url: string,
    public readonly retryAfterMs?: number,
    cause?: Error,
    meta?: ErrorMeta
  ) {
    super(message, status, url, 'RATE_LIMIT_ERROR', cause, {
      ...meta,
      retryAfterMs,
    });
  }
}

export class TransientError extends BaseError {
  constructor(
    message: string,
    code: string = 'TRANSIENT_ERROR',
    cause?: Error,
    meta?: ErrorMeta
  ) {
    super(message, code, cause, meta);
  }
}

export function isRetryableError(error: Error): boolean {
  return (
    error instanceof TransientError ||
    error instanceof RateLimitError ||
    (error instanceof HttpError && error.status >= 500) ||
    // Network errors
    error.message.includes('ECONNRESET') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('ETIMEDOUT') ||
    error.message.includes('EAI_AGAIN')
  );
}
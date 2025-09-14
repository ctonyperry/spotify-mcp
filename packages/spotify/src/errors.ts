import { AuthError, HttpError, RateLimitError, TransientError } from '@spotify-mcp/platform';

export class SpotifyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    cause?: Error
  ) {
    super(message);
    this.name = 'SpotifyError';
    this.cause = cause;
  }
}

export class SpotifyAuthError extends SpotifyError {
  constructor(message: string, status?: number, cause?: Error) {
    super(message, 'SPOTIFY_AUTH_ERROR', status, cause);
    this.name = 'SpotifyAuthError';
  }
}

export class SpotifyRateLimitError extends SpotifyError {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
    status?: number,
    cause?: Error
  ) {
    super(message, 'SPOTIFY_RATE_LIMIT_ERROR', status, cause);
    this.name = 'SpotifyRateLimitError';
  }
}

export class SpotifyApiError extends SpotifyError {
  constructor(message: string, status: number, cause?: Error) {
    super(message, 'SPOTIFY_API_ERROR', status, cause);
    this.name = 'SpotifyApiError';
  }
}

export class SpotifyValidationError extends SpotifyError {
  constructor(message: string, cause?: Error) {
    super(message, 'SPOTIFY_VALIDATION_ERROR', undefined, cause);
    this.name = 'SpotifyValidationError';
  }
}

/**
 * Maps HTTP errors from platform to Spotify-specific errors
 */
export function mapHttpError(error: Error, context?: string): Error {
  const contextMsg = context ? ` (${context})` : '';

  if (error instanceof AuthError) {
    return new SpotifyAuthError(
      `Spotify authentication failed${contextMsg}: ${error.message}`,
      error.status,
      error
    );
  }

  if (error instanceof RateLimitError) {
    return new SpotifyRateLimitError(
      `Spotify API rate limit exceeded${contextMsg}: ${error.message}`,
      error.retryAfterMs,
      error.status,
      error
    );
  }

  if (error instanceof HttpError) {
    // Map specific HTTP status codes to appropriate errors
    switch (error.status) {
      case 401:
        return new SpotifyAuthError(
          `Invalid or expired Spotify access token${contextMsg}`,
          error.status,
          error
        );
      case 403:
        if (error.message.toLowerCase().includes('scope')) {
          return new SpotifyAuthError(
            `Insufficient Spotify OAuth scope${contextMsg}: ${error.message}`,
            error.status,
            error
          );
        }
        return new SpotifyAuthError(
          `Spotify access forbidden${contextMsg}: ${error.message}`,
          error.status,
          error
        );
      case 404:
        return new SpotifyApiError(
          `Spotify resource not found${contextMsg}: ${error.message}`,
          error.status,
          error
        );
      case 429:
        return new SpotifyRateLimitError(
          `Spotify API rate limit exceeded${contextMsg}: ${error.message}`,
          undefined,
          error.status,
          error
        );
      default:
        if (error.status >= 400 && error.status < 500) {
          return new SpotifyApiError(
            `Spotify API client error${contextMsg}: ${error.message}`,
            error.status,
            error
          );
        }
        if (error.status >= 500) {
          return new TransientError(
            `Spotify API server error${contextMsg}: ${error.message}`,
            'SPOTIFY_SERVER_ERROR',
            error
          );
        }
        break;
    }
  }

  if (error instanceof TransientError) {
    return new TransientError(
      `Spotify API transient error${contextMsg}: ${error.message}`,
      'SPOTIFY_TRANSIENT_ERROR',
      error
    );
  }

  // For other errors, wrap them as transient errors
  return new TransientError(
    `Spotify API unexpected error${contextMsg}: ${error.message}`,
    'SPOTIFY_UNEXPECTED_ERROR',
    error
  );
}

/**
 * Checks if an error should be retried
 */
export function isRetryableSpotifyError(error: Error): boolean {
  return (
    error instanceof SpotifyRateLimitError ||
    error instanceof TransientError ||
    (error instanceof SpotifyApiError && error.status && error.status >= 500)
  );
}

/**
 * Extracts retry delay from a Spotify rate limit error
 */
export function getRetryDelay(error: Error): number | undefined {
  if (error instanceof SpotifyRateLimitError) {
    return error.retryAfterMs;
  }
  if (error instanceof RateLimitError) {
    return error.retryAfterMs;
  }
  return undefined;
}
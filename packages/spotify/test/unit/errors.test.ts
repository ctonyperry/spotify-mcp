import { describe, it, expect } from 'vitest';
import { AuthError, HttpError, RateLimitError, TransientError } from '@spotify-mcp/platform';
import {
  mapHttpError,
  isRetryableSpotifyError,
  getRetryDelay,
  SpotifyAuthError,
  SpotifyRateLimitError,
  SpotifyApiError,
  SpotifyValidationError,
} from '../../src/errors.js';

describe('errors', () => {
  describe('mapHttpError', () => {
    it('should map AuthError to SpotifyAuthError', () => {
      const authError = new AuthError('Invalid token', 'AUTH_ERROR');
      const mapped = mapHttpError(authError, 'test context');

      expect(mapped).toBeInstanceOf(SpotifyAuthError);
      expect(mapped.message).toContain('Spotify authentication failed');
      expect(mapped.message).toContain('test context');
      expect(mapped.message).toContain('Invalid token');
      expect(mapped.cause).toBe(authError);
    });

    it('should map RateLimitError to SpotifyRateLimitError', () => {
      const rateLimitError = new RateLimitError('Too many requests', 429, 'http://test.com', 5000);
      const mapped = mapHttpError(rateLimitError);

      expect(mapped).toBeInstanceOf(SpotifyRateLimitError);
      expect(mapped.message).toContain('Spotify API rate limit exceeded');
      expect((mapped as SpotifyRateLimitError).retryAfterMs).toBe(5000);
    });

    it('should map HTTP 401 to SpotifyAuthError', () => {
      const httpError = new HttpError('Unauthorized', 401, 'http://test.com');
      const mapped = mapHttpError(httpError);

      expect(mapped).toBeInstanceOf(SpotifyAuthError);
      expect(mapped.message).toContain('Invalid or expired Spotify access token');
      expect((mapped as SpotifyAuthError).status).toBe(401);
    });

    it('should map HTTP 403 with scope error to SpotifyAuthError', () => {
      const httpError = new HttpError('Insufficient scope', 403, 'http://test.com');
      const mapped = mapHttpError(httpError);

      expect(mapped).toBeInstanceOf(SpotifyAuthError);
      expect(mapped.message).toContain('Insufficient Spotify OAuth scope');
    });

    it('should map HTTP 403 without scope error to SpotifyAuthError', () => {
      const httpError = new HttpError('Forbidden', 403, 'http://test.com');
      const mapped = mapHttpError(httpError);

      expect(mapped).toBeInstanceOf(SpotifyAuthError);
      expect(mapped.message).toContain('Spotify access forbidden');
    });

    it('should map HTTP 404 to SpotifyApiError', () => {
      const httpError = new HttpError('Not Found', 404, 'http://test.com');
      const mapped = mapHttpError(httpError);

      expect(mapped).toBeInstanceOf(SpotifyApiError);
      expect(mapped.message).toContain('Spotify resource not found');
      expect((mapped as SpotifyApiError).status).toBe(404);
    });

    it('should map HTTP 429 to SpotifyRateLimitError', () => {
      const httpError = new HttpError('Rate limited', 429, 'http://test.com');
      const mapped = mapHttpError(httpError);

      expect(mapped).toBeInstanceOf(SpotifyRateLimitError);
      expect(mapped.message).toContain('Spotify API rate limit exceeded');
    });

    it('should map 4xx errors to SpotifyApiError', () => {
      const httpError = new HttpError('Bad Request', 400, 'http://test.com');
      const mapped = mapHttpError(httpError);

      expect(mapped).toBeInstanceOf(SpotifyApiError);
      expect(mapped.message).toContain('Spotify API client error');
      expect((mapped as SpotifyApiError).status).toBe(400);
    });

    it('should map 5xx errors to TransientError', () => {
      const httpError = new HttpError('Internal Server Error', 500, 'http://test.com');
      const mapped = mapHttpError(httpError);

      expect(mapped).toBeInstanceOf(TransientError);
      expect(mapped.message).toContain('Spotify API server error');
    });

    it('should map TransientError to TransientError with Spotify context', () => {
      const transientError = new TransientError('Network error', 'NETWORK_ERROR');
      const mapped = mapHttpError(transientError);

      expect(mapped).toBeInstanceOf(TransientError);
      expect(mapped.message).toContain('Spotify API transient error');
    });

    it('should wrap unknown errors as TransientError', () => {
      const unknownError = new Error('Something went wrong');
      const mapped = mapHttpError(unknownError);

      expect(mapped).toBeInstanceOf(TransientError);
      expect(mapped.message).toContain('Spotify API unexpected error');
      expect(mapped.cause).toBe(unknownError);
    });

    it('should include context in error messages when provided', () => {
      const error = new HttpError('Test error', 400, 'http://test.com');
      const mapped = mapHttpError(error, 'search operation');

      expect(mapped.message).toContain('(search operation)');
    });
  });

  describe('isRetryableSpotifyError', () => {
    it('should return true for SpotifyRateLimitError', () => {
      const error = new SpotifyRateLimitError('Rate limited', 1000, 429);
      expect(isRetryableSpotifyError(error)).toBe(true);
    });

    it('should return true for TransientError', () => {
      const error = new TransientError('Network error');
      expect(isRetryableSpotifyError(error)).toBe(true);
    });

    it('should return true for SpotifyApiError with 5xx status', () => {
      const error = new SpotifyApiError('Server error', 500);
      expect(isRetryableSpotifyError(error)).toBe(true);
    });

    it('should return false for SpotifyApiError with 4xx status', () => {
      const error = new SpotifyApiError('Client error', 400);
      expect(isRetryableSpotifyError(error)).toBe(false);
    });

    it('should return false for SpotifyAuthError', () => {
      const error = new SpotifyAuthError('Auth error', 401);
      expect(isRetryableSpotifyError(error)).toBe(false);
    });

    it('should return false for SpotifyValidationError', () => {
      const error = new SpotifyValidationError('Validation error');
      expect(isRetryableSpotifyError(error)).toBe(false);
    });

    it('should return false for generic Error', () => {
      const error = new Error('Generic error');
      expect(isRetryableSpotifyError(error)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should return retryAfterMs from SpotifyRateLimitError', () => {
      const error = new SpotifyRateLimitError('Rate limited', 5000, 429);
      expect(getRetryDelay(error)).toBe(5000);
    });

    it('should return retryAfterMs from RateLimitError', () => {
      const error = new RateLimitError('Rate limited', 429, 'http://test.com', 3000);
      expect(getRetryDelay(error)).toBe(3000);
    });

    it('should return undefined for SpotifyRateLimitError without retryAfterMs', () => {
      const error = new SpotifyRateLimitError('Rate limited', undefined, 429);
      expect(getRetryDelay(error)).toBeUndefined();
    });

    it('should return undefined for other error types', () => {
      const error = new SpotifyApiError('API error', 400);
      expect(getRetryDelay(error)).toBeUndefined();
    });
  });

  describe('Spotify error classes', () => {
    describe('SpotifyAuthError', () => {
      it('should create error with correct properties', () => {
        const error = new SpotifyAuthError('Auth failed', 401);

        expect(error.name).toBe('SpotifyAuthError');
        expect(error.code).toBe('SPOTIFY_AUTH_ERROR');
        expect(error.status).toBe(401);
        expect(error.message).toBe('Auth failed');
      });

      it('should create error without status', () => {
        const error = new SpotifyAuthError('Auth failed');

        expect(error.status).toBeUndefined();
      });
    });

    describe('SpotifyRateLimitError', () => {
      it('should create error with retry delay', () => {
        const error = new SpotifyRateLimitError('Rate limited', 5000, 429);

        expect(error.name).toBe('SpotifyRateLimitError');
        expect(error.code).toBe('SPOTIFY_RATE_LIMIT_ERROR');
        expect(error.retryAfterMs).toBe(5000);
        expect(error.status).toBe(429);
      });

      it('should create error without retry delay', () => {
        const error = new SpotifyRateLimitError('Rate limited');

        expect(error.retryAfterMs).toBeUndefined();
      });
    });

    describe('SpotifyApiError', () => {
      it('should create error with status', () => {
        const error = new SpotifyApiError('API error', 400);

        expect(error.name).toBe('SpotifyApiError');
        expect(error.code).toBe('SPOTIFY_API_ERROR');
        expect(error.status).toBe(400);
      });
    });

    describe('SpotifyValidationError', () => {
      it('should create validation error', () => {
        const error = new SpotifyValidationError('Invalid data');

        expect(error.name).toBe('SpotifyValidationError');
        expect(error.code).toBe('SPOTIFY_VALIDATION_ERROR');
        expect(error.status).toBeUndefined();
      });
    });
  });
});
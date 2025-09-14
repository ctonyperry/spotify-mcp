import { describe, it, expect } from 'vitest';
import {
  ConfigError,
  AuthError,
  HttpError,
  RateLimitError,
  TransientError,
  isRetryableError,
} from '../../errors/types.js';

describe('Error Types', () => {
  describe('ConfigError', () => {
    it('should create error with code and message', () => {
      const error = new ConfigError('Config validation failed', 'INVALID_CONFIG');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.name).toBe('ConfigError');
      expect(error.message).toBe('Config validation failed');
      expect(error.code).toBe('INVALID_CONFIG');
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should support cause and meta', () => {
      const cause = new Error('Original error');
      const meta = { field: 'SPOTIFY_CLIENT_ID' };
      
      const error = new ConfigError('Validation failed', 'CONFIG_ERROR', cause, meta);
      
      expect(error.cause).toBe(cause);
      expect(error.meta).toEqual(meta);
    });
  });

  describe('HttpError', () => {
    it('should include status and URL', () => {
      const error = new HttpError('Not found', 404, 'https://api.spotify.com/test');
      
      expect(error.status).toBe(404);
      expect(error.url).toBe('https://api.spotify.com/test');
      expect(error.meta).toEqual({
        status: 404,
        url: 'https://api.spotify.com/test',
      });
    });
  });

  describe('RateLimitError', () => {
    it('should extend HttpError with retry info', () => {
      const error = new RateLimitError('Too many requests', 429, 'https://api.spotify.com/test', 5000);
      
      expect(error).toBeInstanceOf(HttpError);
      expect(error.status).toBe(429);
      expect(error.retryAfterMs).toBe(5000);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.meta).toEqual({
        status: 429,
        url: 'https://api.spotify.com/test',
        retryAfterMs: 5000,
      });
    });
  });

  describe('TransientError', () => {
    it('should create transient error', () => {
      const error = new TransientError('Network timeout');
      
      expect(error.code).toBe('TRANSIENT_ERROR');
      expect(error.message).toBe('Network timeout');
    });
  });

  describe('Error JSON serialization', () => {
    it('should serialize error to JSON', () => {
      const cause = new Error('Cause error');
      const meta = { attempts: 3 };
      const error = new HttpError('Server error', 500, 'https://api.test.com', 'SERVER_ERROR', cause, meta);
      
      const json = error.toJSON();
      
      expect(json.name).toBe('HttpError');
      expect(json.message).toBe('Server error');
      expect(json.code).toBe('SERVER_ERROR');
      expect(json.cause).toBe('Cause error');
      expect(json.meta).toEqual({
        attempts: 3,
        status: 500,
        url: 'https://api.test.com',
      });
      expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError(new TransientError('Network error'))).toBe(true);
      expect(isRetryableError(new RateLimitError('Rate limited', 429, 'url'))).toBe(true);
      expect(isRetryableError(new HttpError('Server error', 500, 'url'))).toBe(true);
      expect(isRetryableError(new HttpError('Server error', 502, 'url'))).toBe(true);
      expect(isRetryableError(new HttpError('Server error', 503, 'url'))).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(isRetryableError(new HttpError('Bad request', 400, 'url'))).toBe(false);
      expect(isRetryableError(new HttpError('Unauthorized', 401, 'url'))).toBe(false);
      expect(isRetryableError(new HttpError('Not found', 404, 'url'))).toBe(false);
      expect(isRetryableError(new ConfigError('Invalid config'))).toBe(false);
      expect(isRetryableError(new AuthError('Auth failed'))).toBe(false);
    });

    it('should identify network errors as retryable', () => {
      const networkErrors = [
        new Error('ECONNRESET: socket hang up'),
        new Error('ENOTFOUND: DNS lookup failed'),
        new Error('ETIMEDOUT: timeout'),
        new Error('EAI_AGAIN: DNS lookup timeout'),
      ];

      for (const error of networkErrors) {
        expect(isRetryableError(error)).toBe(true);
      }
    });
  });
});
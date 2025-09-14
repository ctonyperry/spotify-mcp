import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpotifyAuthClient } from '../../oauth/client.js';
import { createLogger, AuthError, nowMs } from '@spotify-mcp/platform';
import { type AuthConfig } from '../../oauth/types.js';
import { type TokenData, type TokenStore } from '../../storage/types.js';

// Simple test focusing on the core logic without complex HTTP mocking
describe('SpotifyAuthClient - Core Logic', () => {
  let mockTokenStore: TokenStore;
  let logger: ReturnType<typeof createLogger>;
  
  const testConfig: AuthConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://localhost:8443/callback',
    scopes: 'user-read-private user-modify-playback-state',
    tlsKeyPath: './test.key',
    tlsCertPath: './test.crt',
  };

  const validTokens: TokenData = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    scope: 'user-read-private user-modify-playback-state',
    tokenType: 'Bearer',
    expiresAtEpochMs: nowMs() + 3600000, // 1 hour from now
  };

  beforeEach(() => {
    mockTokenStore = {
      load: vi.fn(),
      save: vi.fn(),
      clear: vi.fn(),
    };

    logger = createLogger('error'); // Reduce log noise
  });

  describe('getAccessToken', () => {
    it('should return cached token if still valid', async () => {
      (mockTokenStore.load as any).mockResolvedValue(validTokens);
      
      const client = new SpotifyAuthClient(testConfig, mockTokenStore, logger);
      const token = await client.getAccessToken();

      expect(token).toBe(validTokens.accessToken);
      expect(mockTokenStore.load).toHaveBeenCalledOnce();
    });

    it('should throw error if no tokens exist', async () => {
      (mockTokenStore.load as any).mockResolvedValue(null);
      
      const client = new SpotifyAuthClient(testConfig, mockTokenStore, logger);
      
      await expect(client.getAccessToken()).rejects.toThrow(AuthError);
      await expect(client.getAccessToken()).rejects.toThrow(/No tokens found/);
    });

    it('should attempt refresh for expired tokens', async () => {
      const expiredTokens = {
        ...validTokens,
        expiresAtEpochMs: nowMs() - 1000, // Expired 1 second ago
      };

      (mockTokenStore.load as any).mockResolvedValue(expiredTokens);
      
      const client = new SpotifyAuthClient(testConfig, mockTokenStore, logger);
      
      // This will fail due to network call, but we can verify it tries to refresh
      await expect(client.getAccessToken()).rejects.toThrow(AuthError);
      await expect(client.getAccessToken()).rejects.toThrow(/Failed to refresh access token/);
    });
  });

  describe('revoke', () => {
    it('should clear local tokens', async () => {
      const client = new SpotifyAuthClient(testConfig, mockTokenStore, logger);
      await client.revoke();

      expect(mockTokenStore.clear).toHaveBeenCalledOnce();
    });
  });

  describe('configuration handling', () => {
    it('should handle PKCE-only config (no client secret)', () => {
      const pkceConfig = { ...testConfig, clientSecret: undefined };
      
      // Should not throw when creating client without client secret
      expect(() => new SpotifyAuthClient(pkceConfig, mockTokenStore, logger)).not.toThrow();
    });
  });
});
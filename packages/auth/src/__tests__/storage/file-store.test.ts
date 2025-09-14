import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { FileTokenStore } from '../../storage/file-store.js';
import { type TokenData } from '../../storage/types.js';
import { AuthError } from '@spotify-mcp/platform';

describe('FileTokenStore', () => {
  const testFilePath = './test-tokens.json';
  const testDirPath = './test-dir/nested/tokens.json';
  let store: FileTokenStore;
  let nestedStore: FileTokenStore;

  const validTokens: TokenData = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    scope: 'user-read-private user-read-email',
    tokenType: 'Bearer',
    expiresAtEpochMs: Date.now() + 3600000,
  };

  beforeEach(() => {
    store = new FileTokenStore(testFilePath);
    nestedStore = new FileTokenStore(testDirPath);
  });

  afterEach(() => {
    // Clean up test files
    [testFilePath, testDirPath].forEach(filePath => {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    });

    // Clean up test directories
    if (existsSync('./test-dir')) {
      rmSync('./test-dir', { recursive: true });
    }
  });

  describe('save', () => {
    it('should save valid tokens to file', async () => {
      await store.save(validTokens);
      
      expect(existsSync(testFilePath)).toBe(true);
    });

    it('should create nested directories if they do not exist', async () => {
      await nestedStore.save(validTokens);
      
      expect(existsSync(testDirPath)).toBe(true);
      expect(existsSync(dirname(testDirPath))).toBe(true);
    });

    it('should validate tokens before saving', async () => {
      const invalidTokens = {
        ...validTokens,
        expiresAtEpochMs: 'invalid' as any,
      };

      await expect(store.save(invalidTokens)).rejects.toThrow(AuthError);
    });

    it('should save tokens in correct JSON format', async () => {
      await store.save(validTokens);
      
      const loaded = await store.load();
      expect(loaded).toEqual(validTokens);
    });

    it('should handle file system errors', async () => {
      // Skip this test on Windows as path permissions work differently
      if (process.platform === 'win32') {
        return;
      }
      
      const invalidStore = new FileTokenStore('/root/invalid/path/tokens.json');
      await expect(invalidStore.save(validTokens)).rejects.toThrow(AuthError);
    });
  });

  describe('load', () => {
    it('should return null when file does not exist', async () => {
      const result = await store.load();
      expect(result).toBeNull();
    });

    it('should load valid tokens from file', async () => {
      await store.save(validTokens);
      const loaded = await store.load();
      
      expect(loaded).toEqual(validTokens);
    });

    it('should validate loaded token data', async () => {
      // Write invalid JSON directly to file
      const invalidTokens = {
        ...validTokens,
        expiresAtEpochMs: 'invalid',
      };
      writeFileSync(testFilePath, JSON.stringify(invalidTokens));

      await expect(store.load()).rejects.toThrow(AuthError);
    });

    it('should handle invalid JSON files', async () => {
      writeFileSync(testFilePath, '{ invalid json }');

      await expect(store.load()).rejects.toThrow(AuthError);
      await expect(store.load()).rejects.toThrow(/Failed to load tokens from/);
    });

    it('should handle missing required fields', async () => {
      const incompleteTokens = {
        accessToken: 'test-token',
        // Missing required fields
      };
      writeFileSync(testFilePath, JSON.stringify(incompleteTokens));

      await expect(store.load()).rejects.toThrow(AuthError);
    });
  });

  describe('clear', () => {
    it('should remove existing token file', async () => {
      await store.save(validTokens);
      expect(existsSync(testFilePath)).toBe(true);

      await store.clear();
      expect(existsSync(testFilePath)).toBe(false);
    });

    it('should not throw when file does not exist', async () => {
      await expect(store.clear()).resolves.not.toThrow();
    });

    it('should handle file system errors during clear', async () => {
      // Create a read-only directory to cause permission error
      if (process.platform !== 'win32') {
        mkdirSync('./readonly-dir', { mode: 0o444 });
        const readOnlyStore = new FileTokenStore('./readonly-dir/tokens.json');
        
        // First save to create the file
        await readOnlyStore.save(validTokens);
        
        // Change directory permissions to read-only
        try {
          await expect(readOnlyStore.clear()).rejects.toThrow(AuthError);
        } finally {
          // Cleanup
          rmSync('./readonly-dir', { recursive: true, force: true });
        }
      }
    });
  });

  describe('file permissions (Unix only)', () => {
    it('should set restrictive permissions on saved files', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows - permissions work differently
        return;
      }

      await store.save(validTokens);
      
      const fs = await import('fs');
      const stats = fs.statSync(testFilePath);
      const mode = stats.mode & parseInt('777', 8);
      
      // Should be 0600 (rw-------)
      expect(mode).toBe(0o600);
    });
  });

  describe('schema validation', () => {
    it('should accept all valid token properties', async () => {
      const completeTokens: TokenData = {
        accessToken: 'BQC4liRiKOvHxvBQtL4JCvIL0xNGIzJ2a9vD8N1',
        refreshToken: 'AQArJiKOvHxvBQtL4JCvIL0xNGIzJ2a9vD8N1',
        scope: 'user-read-private user-modify-playback-state',
        tokenType: 'Bearer',
        expiresAtEpochMs: 1672531200000,
      };

      await expect(store.save(completeTokens)).resolves.not.toThrow();
      
      const loaded = await store.load();
      expect(loaded).toEqual(completeTokens);
    });

    it('should apply default tokenType', async () => {
      const tokensWithoutType = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        scope: 'user-read-private',
        expiresAtEpochMs: Date.now() + 3600000,
      };

      writeFileSync(testFilePath, JSON.stringify(tokensWithoutType));
      
      const loaded = await store.load();
      expect(loaded?.tokenType).toBe('Bearer');
    });
  });
});
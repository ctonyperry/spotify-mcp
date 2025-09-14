import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { loadConfig } from '../../config/loader.js';
import { ConfigError } from '../../config/types.js';

describe('Config Loader', () => {
  const testConfigPath = 'test-config.json';
  
  beforeEach(() => {
    // Clear environment variables
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    delete process.env.SPOTIFY_REDIRECT_URI;
    delete process.env.SERVER_PORT;
    delete process.env.TLS_KEY_PATH;
    delete process.env.TLS_CERT_PATH;
    delete process.env.LOG_LEVEL;
    delete process.env.TOKEN_STORE_PATH;
    delete process.env.SCOPES;
  });

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  it('should fail fast on missing required keys', () => {
    expect(() => loadConfig('non-existent.json')).toThrow(ConfigError);
    expect(() => loadConfig('non-existent.json')).toThrow(/Configuration validation failed/);
  });

  it('should apply defaults correctly', () => {
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_REDIRECT_URI = 'https://localhost:8443/callback';
    process.env.TLS_KEY_PATH = '/path/to/key';
    process.env.TLS_CERT_PATH = '/path/to/cert';

    const config = loadConfig('non-existent.json');

    expect(config.SERVER_PORT).toBe(8443);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.TOKEN_STORE_PATH).toBe('.secrets/tokens.json');
    expect(config.SCOPES).toContain('user-read-playback-state');
  });

  it('should respect environment variable precedence', () => {
    const fileConfig = {
      SPOTIFY_CLIENT_ID: 'file-client-id',
      SPOTIFY_REDIRECT_URI: 'https://localhost:8443/callback',
      TLS_KEY_PATH: '/file/key',
      TLS_CERT_PATH: '/file/cert',
      SERVER_PORT: 9000,
    };

    writeFileSync(testConfigPath, JSON.stringify(fileConfig));

    process.env.SPOTIFY_CLIENT_ID = 'env-client-id';
    process.env.SERVER_PORT = '8080';

    const config = loadConfig(testConfigPath);

    // Environment should override file
    expect(config.SPOTIFY_CLIENT_ID).toBe('env-client-id');
    expect(config.SERVER_PORT).toBe(8080);
    
    // File values should be used when env is not set
    expect(config.TLS_KEY_PATH).toBe('/file/key');
  });

  it('should validate HTTPS redirect URI', () => {
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_REDIRECT_URI = 'http://localhost:8443/callback'; // HTTP not allowed
    process.env.TLS_KEY_PATH = '/path/to/key';
    process.env.TLS_CERT_PATH = '/path/to/cert';

    expect(() => loadConfig()).toThrow(ConfigError);
    expect(() => loadConfig()).toThrow(/must use HTTPS/);
  });

  it('should validate port range', () => {
    const fileConfig = {
      SPOTIFY_CLIENT_ID: 'test-client-id',
      SPOTIFY_REDIRECT_URI: 'https://localhost:8443/callback',
      TLS_KEY_PATH: '/path/to/key',
      TLS_CERT_PATH: '/path/to/cert',
      SERVER_PORT: 999999, // Invalid port
    };

    writeFileSync(testConfigPath, JSON.stringify(fileConfig));

    expect(() => loadConfig(testConfigPath)).toThrow(ConfigError);
  });

  it('should handle invalid JSON files', () => {
    writeFileSync(testConfigPath, '{ invalid json }');

    expect(() => loadConfig(testConfigPath)).toThrow(ConfigError);
    expect(() => loadConfig(testConfigPath)).toThrow(/Failed to parse config file/);
  });

  it('should return frozen config object', () => {
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_REDIRECT_URI = 'https://localhost:8443/callback';
    process.env.TLS_KEY_PATH = '/path/to/key';
    process.env.TLS_CERT_PATH = '/path/to/cert';

    const config = loadConfig();

    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      (config as any).SERVER_PORT = 9999;
    }).toThrow();
  });

  it('should validate LOG_LEVEL enum', () => {
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_REDIRECT_URI = 'https://localhost:8443/callback';
    process.env.TLS_KEY_PATH = '/path/to/key';
    process.env.TLS_CERT_PATH = '/path/to/cert';
    process.env.LOG_LEVEL = 'invalid';

    expect(() => loadConfig()).toThrow(ConfigError);
  });
});
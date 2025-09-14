import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ConfigSchema, type Config, ConfigError } from './types.js';

interface RawConfig {
  [key: string]: unknown;
}

function loadFromEnv(): RawConfig {
  return {
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
    SERVER_PORT: process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : undefined,
    TLS_KEY_PATH: process.env.TLS_KEY_PATH,
    TLS_CERT_PATH: process.env.TLS_CERT_PATH,
    LOG_LEVEL: process.env.LOG_LEVEL,
    TOKEN_STORE_PATH: process.env.TOKEN_STORE_PATH,
    SCOPES: process.env.SCOPES,
  };
}

function loadFromFile(path: string): RawConfig {
  if (!existsSync(path)) {
    return {};
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as RawConfig;
  } catch (error) {
    throw new ConfigError(
      `Failed to parse config file ${path}`,
      'CONFIG_FILE_INVALID',
      error as Error
    );
  }
}

function mergeConfigs(...configs: RawConfig[]): RawConfig {
  const merged: RawConfig = {};
  
  // Merge configs in order, with later configs overriding earlier ones
  for (const config of configs) {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }
  
  return merged;
}

export function loadConfig(configPath = 'config.local.json'): Config {
  try {
    // Load with precedence: env > config.local.json > defaults
    const defaults: RawConfig = {};
    const fileConfig = loadFromFile(configPath);
    const envConfig = loadFromEnv();
    
    const mergedConfig = mergeConfigs(defaults, fileConfig, envConfig);
    
    // Validate and parse with Zod
    const result = ConfigSchema.safeParse(mergedConfig);
    
    if (!result.success) {
      const errors = result.error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      
      throw new ConfigError(
        `Configuration validation failed: ${errors}`,
        'CONFIG_VALIDATION_ERROR'
      );
    }
    
    // Return frozen config object
    return Object.freeze(result.data);
    
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    
    throw new ConfigError(
      'Failed to load configuration',
      'CONFIG_LOAD_ERROR',
      error as Error
    );
  }
}
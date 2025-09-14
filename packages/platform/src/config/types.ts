import { z } from 'zod';

export const ConfigSchema = z.object({
  SPOTIFY_CLIENT_ID: z.string().min(1, 'SPOTIFY_CLIENT_ID is required'),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().url('SPOTIFY_REDIRECT_URI must be a valid HTTPS URL').refine(
    url => url.startsWith('https://'),
    'SPOTIFY_REDIRECT_URI must use HTTPS'
  ),
  SERVER_PORT: z.number().int().min(1).max(65535).default(8443),
  TLS_KEY_PATH: z.string().min(1, 'TLS_KEY_PATH is required'),
  TLS_CERT_PATH: z.string().min(1, 'TLS_CERT_PATH is required'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  TOKEN_STORE_PATH: z.string().default('.secrets/tokens.json'),
  SCOPES: z.string().default('user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-modify-public playlist-modify-private user-library-read user-library-modify'),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'CONFIG_ERROR',
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}
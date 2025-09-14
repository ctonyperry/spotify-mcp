import { z } from 'zod';

export const SpotifyAuthUrlParams = z.object({
  clientId: z.string(),
  redirectUri: z.string().url(),
  scopes: z.string(),
  codeChallenge: z.string(),
  codeChallengeMethod: z.literal('S256'),
});

export const SpotifyTokenResponse = z.object({
  access_token: z.string(),
  token_type: z.string(),
  scope: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
});

export const SpotifyRefreshResponse = z.object({
  access_token: z.string(),
  token_type: z.string(),
  scope: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(), // May or may not be included
});

export interface AuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string;
  tlsKeyPath: string;
  tlsCertPath: string;
}

export interface AuthClient {
  getAccessToken(): Promise<string>;
  authorizeInteractive(): Promise<void>;
  revoke(): Promise<void>;
}
import { z } from 'zod';

export const TokenDataSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  scope: z.string(),
  tokenType: z.string().default('Bearer'),
  expiresAtEpochMs: z.number().int(),
});

export type TokenData = z.infer<typeof TokenDataSchema>;

export interface TokenStore {
  load(): Promise<TokenData | null>;
  save(tokens: TokenData): Promise<void>;
  clear(): Promise<void>;
}
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { dirname } from 'path';
import { AuthError } from '@spotify-mcp/platform';
import { TokenDataSchema, type TokenData, type TokenStore } from './types.js';

export class FileTokenStore implements TokenStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<TokenData | null> {
    try {
      if (!existsSync(this.filePath)) {
        return null;
      }

      const content = readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      const result = TokenDataSchema.safeParse(parsed);
      if (!result.success) {
        throw new AuthError(
          'Invalid token data format',
          'TOKEN_INVALID_FORMAT',
          undefined,
          { errors: result.error.issues }
        );
      }

      return result.data;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      
      throw new AuthError(
        `Failed to load tokens from ${this.filePath}`,
        'TOKEN_LOAD_ERROR',
        error as Error
      );
    }
  }

  async save(tokens: TokenData): Promise<void> {
    try {
      // Validate tokens before saving
      const validated = TokenDataSchema.parse(tokens);
      
      // Ensure directory exists
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write tokens to file
      const content = JSON.stringify(validated, null, 2);
      writeFileSync(this.filePath, content, 'utf-8');

      // Set restrictive permissions (0600) on Unix systems
      try {
        if (process.platform !== 'win32') {
          chmodSync(this.filePath, 0o600);
        }
      } catch (permError) {
        // Permissions setting failed, but file was written
        // This is not critical for functionality
      }
    } catch (error) {
      throw new AuthError(
        `Failed to save tokens to ${this.filePath}`,
        'TOKEN_SAVE_ERROR',
        error as Error
      );
    }
  }

  async clear(): Promise<void> {
    try {
      if (existsSync(this.filePath)) {
        unlinkSync(this.filePath);
      }
    } catch (error) {
      throw new AuthError(
        `Failed to clear tokens from ${this.filePath}`,
        'TOKEN_CLEAR_ERROR',
        error as Error
      );
    }
  }
}
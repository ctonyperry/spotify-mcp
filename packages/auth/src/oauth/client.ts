import { createServer, type Server } from 'https';
import { readFileSync } from 'fs';
import { URL } from 'url';
import { spawn } from 'child_process';
import { AuthError, createHttpClient, type Logger, nowMs } from '@spotify-mcp/platform';
import { generatePkceChallenge } from './pkce.js';
import { type TokenStore, type TokenData } from '../storage/types.js';
import {
  type AuthConfig,
  type AuthClient,
  SpotifyTokenResponse,
  SpotifyRefreshResponse,
} from './types.js';

export class SpotifyAuthClient implements AuthClient {
  private readonly httpClient;
  private refreshPromise: Promise<TokenData> | null = null;

  constructor(
    private readonly config: AuthConfig,
    private readonly tokenStore: TokenStore,
    private readonly logger: Logger
  ) {
    this.httpClient = createHttpClient(logger);
  }

  async getAccessToken(): Promise<string> {
    const tokens = await this.tokenStore.load();
    
    if (!tokens) {
      throw new AuthError(
        'No tokens found. Run authorization flow first.',
        'NO_TOKENS'
      );
    }

    // Check if token is still valid (with 60s buffer)
    const expiryBufferMs = 60 * 1000;
    const now = nowMs();
    
    if (tokens.expiresAtEpochMs > now + expiryBufferMs) {
      return tokens.accessToken;
    }

    // Token is expired or expiring soon, refresh it
    const refreshedTokens = await this.refreshAccessToken(tokens);
    return refreshedTokens.accessToken;
  }

  private async refreshAccessToken(tokens: TokenData): Promise<TokenData> {
    // Single-flight refresh: if a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      this.logger.debug('Waiting for existing refresh to complete');
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh(tokens);
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(tokens: TokenData): Promise<TokenData> {
    this.logger.info('Refreshing access token');

    try {
      const response = await this.httpClient.fetchJSON<SpotifyRefreshResponse>(
        'https://accounts.spotify.com/api/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': this.config.clientSecret 
              ? `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
              : undefined,
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokens.refreshToken,
            ...(this.config.clientSecret ? {} : { client_id: this.config.clientId }),
          }).toString(),
        }
      );

      const refreshedTokens: TokenData = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token || tokens.refreshToken, // Use new refresh token if provided
        scope: response.scope,
        tokenType: response.token_type,
        expiresAtEpochMs: nowMs() + (response.expires_in * 1000),
      };

      await this.tokenStore.save(refreshedTokens);
      this.logger.info('Access token refreshed successfully');

      return refreshedTokens;
    } catch (error) {
      this.logger.error('Failed to refresh access token', { error: (error as Error).message });
      throw new AuthError(
        'Failed to refresh access token',
        'REFRESH_FAILED',
        error as Error
      );
    }
  }

  async authorizeInteractive(): Promise<void> {
    this.logger.info('Starting interactive OAuth authorization');

    const pkce = generatePkceChallenge();
    const state = Buffer.from(JSON.stringify({ timestamp: nowMs() })).toString('base64url');
    
    // Build authorization URL
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('scope', this.config.scopes);
    authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('code_challenge', pkce.codeChallenge);
    authUrl.searchParams.set('state', state);

    // Start HTTPS callback server
    const server = await this.startCallbackServer(pkce.codeVerifier, state);
    
    try {
      // Open authorization URL in browser
      await this.openBrowser(authUrl.toString());
      this.logger.info('Authorization URL opened in browser', { url: authUrl.toString() });

      // Wait for callback (server will handle the token exchange)
      await this.waitForCallback(server);
      
    } finally {
      server.close();
    }
  }

  private async startCallbackServer(codeVerifier: string, expectedState: string): Promise<Server> {
    const redirectUrl = new URL(this.config.redirectUri);
    const port = parseInt(redirectUrl.port, 10);
    
    if (!port || isNaN(port)) {
      throw new AuthError('Invalid redirect URI port', 'INVALID_REDIRECT_PORT');
    }

    let key: Buffer;
    let cert: Buffer;
    
    try {
      key = readFileSync(this.config.tlsKeyPath);
      cert = readFileSync(this.config.tlsCertPath);
    } catch (error) {
      throw new AuthError(
        'Failed to load TLS certificates',
        'TLS_CERT_ERROR',
        error as Error,
        { keyPath: this.config.tlsKeyPath, certPath: this.config.tlsCertPath }
      );
    }

    const server = createServer({ key, cert }, async (req, res) => {
      try {
        const reqUrl = new URL(req.url!, `https://localhost:${port}`);
        
        if (reqUrl.pathname !== redirectUrl.pathname) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        const code = reqUrl.searchParams.get('code');
        const state = reqUrl.searchParams.get('state');
        const error = reqUrl.searchParams.get('error');

        // Handle OAuth errors
        if (error) {
          const errorDesc = reqUrl.searchParams.get('error_description') || 'Unknown error';
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>Authorization Error</h1>
                <p>Error: ${error}</p>
                <p>Description: ${errorDesc}</p>
              </body>
            </html>
          `);
          throw new AuthError(`OAuth error: ${error} - ${errorDesc}`, 'OAUTH_ERROR');
        }

        // Validate state parameter
        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Invalid State Parameter</h1></body></html>');
          throw new AuthError('Invalid state parameter', 'INVALID_STATE');
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Missing Authorization Code</h1></body></html>');
          throw new AuthError('Missing authorization code', 'MISSING_CODE');
        }

        // Exchange code for tokens
        await this.exchangeCodeForTokens(code, codeVerifier);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Authorization Successful!</h1>
              <p>You can now close this window and return to the application.</p>
            </body>
          </html>
        `);

        // Close the server after successful callback
        setTimeout(() => server.close(), 100);

      } catch (error) {
        this.logger.error('OAuth callback error', { error: (error as Error).message });
        // Don't throw here as it would be unhandled
      }
    });

    return new Promise((resolve, reject) => {
      server.listen(port, 'localhost', () => {
        this.logger.info(`OAuth callback server listening on port ${port}`);
        resolve(server);
      });

      server.on('error', (error) => {
        reject(new AuthError(
          `Failed to start callback server on port ${port}`,
          'CALLBACK_SERVER_ERROR',
          error
        ));
      });
    });
  }

  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<void> {
    this.logger.info('Exchanging authorization code for tokens');

    try {
      const response = await this.httpClient.fetchJSON<SpotifyTokenResponse>(
        'https://accounts.spotify.com/api/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': this.config.clientSecret 
              ? `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
              : undefined,
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.config.redirectUri,
            code_verifier: codeVerifier,
            ...(this.config.clientSecret ? {} : { client_id: this.config.clientId }),
          }).toString(),
        }
      );

      if (!response.refresh_token) {
        throw new AuthError('No refresh token received', 'NO_REFRESH_TOKEN');
      }

      const tokens: TokenData = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        scope: response.scope,
        tokenType: response.token_type,
        expiresAtEpochMs: nowMs() + (response.expires_in * 1000),
      };

      await this.tokenStore.save(tokens);
      this.logger.info('OAuth tokens saved successfully');

    } catch (error) {
      throw new AuthError(
        'Failed to exchange code for tokens',
        'TOKEN_EXCHANGE_ERROR',
        error as Error
      );
    }
  }

  private async openBrowser(url: string): Promise<void> {
    const platform = process.platform;
    let command: string;
    let args: string[];

    if (platform === 'darwin') {
      command = 'open';
      args = [url];
    } else if (platform === 'win32') {
      command = 'start';
      args = ['', url];
    } else {
      command = 'xdg-open';
      args = [url];
    }

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { detached: true, stdio: 'ignore' });
      
      child.on('error', (error) => {
        reject(new AuthError(
          'Failed to open browser',
          'BROWSER_OPEN_ERROR',
          error,
          { command, args, url }
        ));
      });

      child.on('spawn', () => {
        child.unref();
        resolve();
      });
    });
  }

  private async waitForCallback(server: Server): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new AuthError(
          'OAuth callback timeout after 5 minutes',
          'CALLBACK_TIMEOUT'
        ));
      }, 5 * 60 * 1000); // 5 minutes

      server.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });

      server.on('error', (error) => {
        clearTimeout(timeout);
        reject(new AuthError(
          'Callback server error',
          'CALLBACK_SERVER_ERROR',
          error
        ));
      });
    });
  }

  async revoke(): Promise<void> {
    // Spotify doesn't provide a token revocation endpoint
    // Clear local tokens as the best we can do
    this.logger.info('Clearing local OAuth tokens');
    await this.tokenStore.clear();
  }
}
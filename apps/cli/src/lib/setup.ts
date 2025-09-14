import { loadConfig, createLogger } from '@spotify-mcp/platform';
import { createOAuthClient } from '@spotify-mcp/auth';
import { createSpotifyClient } from '@spotify-mcp/spotify';
import { createMCPRegistry } from '@spotify-mcp/mcp';

export interface CLIContext {
  spotify: any;
  tools: any[];
  logger: any;
  config: any;
}

export interface CLIOptions {
  config?: string;
  json?: boolean;
  dryRun?: boolean;
}

export async function initializeSpotifyMCP(options: CLIOptions): Promise<CLIContext> {
  // Load configuration
  const config = await loadConfig(options.config);
  const logger = createLogger({
    ...config.logging,
    // Reduce log noise for CLI
    level: options.json ? 'error' : 'warn',
  });

  // Initialize OAuth client
  const oauthClient = createOAuthClient({
    clientId: config.spotify.clientId,
    redirectUri: config.spotify.redirectUri,
    scopes: config.spotify.scopes,
    storage: config.auth.storage,
  });

  // Initialize Spotify client
  const spotify = createSpotifyClient({
    oauth: oauthClient,
    http: {
      baseURL: 'https://api.spotify.com/v1',
      timeout: 30000,
      retries: 3,
    },
    logger: logger.child({ component: 'spotify-client' }),
  });

  // Create MCP tool registry
  const tools = createMCPRegistry({
    spotify,
    logger: logger.child({ component: 'mcp-tools' }),
  });

  return {
    spotify,
    tools,
    logger,
    config,
  };
}
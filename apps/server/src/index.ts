#!/usr/bin/env node

// Composition root for the Spotify MCP server
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from '@spotify-mcp/platform';
import { createLogger } from '@spotify-mcp/platform';
import { createOAuthClient } from '@spotify-mcp/auth';
import { createSpotifyClient } from '@spotify-mcp/spotify';
import { createMCPRegistry, getToolCount } from '@spotify-mcp/mcp';

async function main(): Promise<void> {
  // Load configuration
  const config = await loadConfig();
  const logger = createLogger(config.logging);

  logger.info('Starting Spotify MCP server', {
    version: '1.0.0',
    toolCount: getToolCount()
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

  // Create MCP server
  const server = new Server({
    name: 'spotify-mcp',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {},
    },
  });

  // Register all tools
  for (const tool of tools) {
    server.setRequestHandler({ method: 'tools/call', name: tool.name }, async (request) => {
      const startTime = Date.now();
      const requestLogger = logger.child({
        toolName: tool.name,
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

      try {
        requestLogger.info('Tool invocation started', { args: request.params.arguments });

        const result = await tool.handler(request.params.arguments);
        const durationMs = Date.now() - startTime;

        requestLogger.info('Tool invocation completed', { durationMs });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        const durationMs = Date.now() - startTime;
        requestLogger.error('Tool invocation failed', {
          error: error instanceof Error ? error.message : String(error),
          durationMs
        });

        throw error;
      }
    });
  }

  // List tools handler
  server.setRequestHandler({ method: 'tools/list' }, async () => {
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Spotify MCP server started successfully', {
    transport: 'stdio',
    toolCount: tools.length
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
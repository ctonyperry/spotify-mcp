#!/usr/bin/env node

// Composition root for the Spotify MCP server
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main(): Promise<void> {
  const server = new Server({
    name: 'spotify-mcp',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {},
    },
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Spotify MCP server started');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
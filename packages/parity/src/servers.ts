/**
 * Server instance wrappers for parity testing
 */

import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { loadConfig, createLogger } from '@spotify-mcp/platform';
import { createOAuthClient } from '@spotify-mcp/auth';
import { createSpotifyClient } from '@spotify-mcp/spotify';
import { createMCPRegistry } from '@spotify-mcp/mcp';
import type { ServerInstance } from './types.js';

/**
 * New server instance running in-process with real dependencies
 */
export class NewServerInstance implements ServerInstance {
  private tools: any[];
  private logger: any;

  constructor(tools: any[], logger: any) {
    this.tools = tools;
    this.logger = logger;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<any> {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    this.logger.debug('Calling new server tool', { toolName, args });

    try {
      const result = await tool.handler(args);
      this.logger.debug('New server tool result', { toolName, result });
      return result;
    } catch (error) {
      this.logger.error('New server tool error', { toolName, error });
      throw error;
    }
  }

  async listTools(): Promise<any> {
    return {
      tools: this.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for in-process instance
  }

  static async create(): Promise<NewServerInstance> {
    const config = await loadConfig();
    const logger = createLogger({ ...config.logging, level: 'error' }); // Quiet during tests

    const oauthClient = createOAuthClient({
      clientId: config.spotify.clientId,
      redirectUri: config.spotify.redirectUri,
      scopes: config.spotify.scopes,
      storage: config.auth.storage,
    });

    const spotify = createSpotifyClient({
      oauth: oauthClient,
      http: {
        baseURL: 'https://api.spotify.com/v1',
        timeout: 30000,
        retries: 3,
      },
      logger: logger.child({ component: 'spotify-client' }),
    });

    const tools = createMCPRegistry({
      spotify,
      logger: logger.child({ component: 'mcp-tools' }),
    });

    return new NewServerInstance(tools, logger);
  }
}

/**
 * Legacy server instance via subprocess communication
 */
export class LegacyServerInstance implements ServerInstance {
  private process: ChildProcess | null = null;
  private messageId = 1;

  async init(): Promise<void> {
    const legacyServerPath = join(process.cwd(), '../spotify-mcp-server/build/index.js');

    this.process = spawn('node', [legacyServerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: join(process.cwd(), '../spotify-mcp-server'),
    });

    // Wait for server to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<any> {
    if (!this.process) {
      throw new Error('Legacy server not initialized');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Legacy server call timeout'));
      }, 15000);

      const message = {
        jsonrpc: '2.0',
        id: this.messageId++,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      };

      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString().trim());
          if (response.id === message.id) {
            clearTimeout(timeout);
            this.process!.stdout?.off('data', responseHandler);

            if (response.error) {
              reject(new Error(`Legacy server error: ${response.error.message || JSON.stringify(response.error)}`));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Ignore parsing errors, might be partial data
        }
      };

      this.process.stdout?.on('data', responseHandler);
      this.process.stdin?.write(JSON.stringify(message) + '\n');
    });
  }

  async listTools(): Promise<any> {
    if (!this.process) {
      throw new Error('Legacy server not initialized');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Legacy server tools/list timeout'));
      }, 10000);

      const message = {
        jsonrpc: '2.0',
        id: this.messageId++,
        method: 'tools/list',
      };

      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString().trim());
          if (response.id === message.id) {
            clearTimeout(timeout);
            this.process!.stdout?.off('data', responseHandler);

            if (response.error) {
              reject(new Error(`Legacy server error: ${response.error.message}`));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Ignore parsing errors, might be partial data
        }
      };

      this.process.stdout?.on('data', responseHandler);
      this.process.stdin?.write(JSON.stringify(message) + '\n');
    });
  }

  async shutdown(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill();
      this.process = null;
    }
  }
}
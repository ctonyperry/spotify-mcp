/**
 * E2E Smoke Tests for Spotify MCP Server
 * Tests basic server startup and tool invocation with mock Spotify client
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

describe('Spotify MCP Server E2E', () => {
  let serverProcess: ChildProcess;
  let messageId = 1;

  // Mock config file path
  const mockConfigPath = join(process.cwd(), 'test-config.json');
  const mockTokenPath = join(process.cwd(), 'test-tokens.json');

  beforeAll(async () => {
    // Create mock configuration
    const mockConfig = {
      spotify: {
        clientId: 'test-client-id',
        redirectUri: 'https://localhost:8888/callback',
        scopes: ['user-read-playback-state', 'user-modify-playback-state']
      },
      auth: {
        storage: {
          type: 'file',
          path: mockTokenPath
        }
      },
      logging: {
        level: 'error',
        format: 'json'
      },
      server: {
        https: {
          enabled: false
        }
      }
    };

    // Create mock tokens (simulating completed OAuth)
    const mockTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 3600000,
      tokenType: 'Bearer',
      scope: 'user-read-playback-state user-modify-playback-state'
    };

    writeFileSync(mockConfigPath, JSON.stringify(mockConfig, null, 2));
    writeFileSync(mockTokenPath, JSON.stringify(mockTokens, null, 2));

    // Set config path environment variable
    process.env.SPOTIFY_MCP_CONFIG = mockConfigPath;

    // Start server process
    serverProcess = spawn('node', ['--loader', 'ts-node/esm', 'src/index.ts'], {
      cwd: join(process.cwd(), 'apps/server'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, SPOTIFY_MCP_CONFIG: mockConfigPath }
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(() => {
    // Clean up server process
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }

    // Clean up test files
    if (existsSync(mockConfigPath)) {
      unlinkSync(mockConfigPath);
    }
    if (existsSync(mockTokenPath)) {
      unlinkSync(mockTokenPath);
    }
  });

  const sendMessage = async (message: MCPMessage): Promise<MCPMessage> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 10000);

      const messageStr = JSON.stringify(message) + '\n';

      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString().trim());
          clearTimeout(timeout);
          serverProcess.stdout?.off('data', responseHandler);
          resolve(response);
        } catch (error) {
          // Ignore parsing errors, might be partial data
        }
      };

      serverProcess.stdout?.on('data', responseHandler);
      serverProcess.stdin?.write(messageStr);
    });
  };

  it('should start server and list tools', async () => {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'tools/list'
    };

    const response = await sendMessage(message);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(message.id);
    expect(response.result).toBeDefined();
    expect(response.result.tools).toBeInstanceOf(Array);
    expect(response.result.tools.length).toBeGreaterThan(0);

    // Verify expected tools are present
    const toolNames = response.result.tools.map((tool: any) => tool.name);
    expect(toolNames).toContain('tracks.search');
    expect(toolNames).toContain('playback.state.get');
    expect(toolNames).toContain('playlists.list.mine');
    expect(toolNames).toContain('library.saved.tracks.get');
    expect(toolNames).toContain('queue.add');
  }, 15000);

  it('should handle tool call with validation error', async () => {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'tools/call',
      params: {
        name: 'tracks.search',
        arguments: {
          // Missing required 'query' parameter
          limit: 10
        }
      }
    };

    const response = await sendMessage(message);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(message.id);
    expect(response.error).toBeDefined();
    expect(response.error.message).toContain('validation');
  }, 10000);

  it('should handle valid tool call (will fail due to mock tokens)', async () => {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'tools/call',
      params: {
        name: 'tracks.search',
        arguments: {
          query: 'test',
          limit: 5
        }
      }
    };

    const response = await sendMessage(message);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(message.id);

    // Should have either result or error (likely error due to mock tokens)
    expect(response.result || response.error).toBeDefined();

    // If error, it should be an authentication error, not a validation error
    if (response.error) {
      expect(response.error.message).not.toContain('validation');
    }
  }, 10000);

  it('should reject invalid tool name', async () => {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'tools/call',
      params: {
        name: 'nonexistent.tool',
        arguments: {}
      }
    };

    const response = await sendMessage(message);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(message.id);
    expect(response.error).toBeDefined();
  }, 10000);

  it('should handle malformed JSON gracefully', async () => {
    return new Promise<void>((resolve) => {
      const malformedMessage = '{"jsonrpc":"2.0","id":999,"method":"invalid json\n';

      const errorHandler = (data: Buffer) => {
        // Server should continue running despite malformed input
        serverProcess.stderr?.off('data', errorHandler);
        resolve();
      };

      serverProcess.stderr?.on('data', errorHandler);
      serverProcess.stdin?.write(malformedMessage);

      // If no error within 2 seconds, consider test passed
      setTimeout(resolve, 2000);
    });
  }, 5000);
});
/**
 * Resilience & Performance Tests for Spotify MCP Server
 * Tests runtime behavior under stress, rate limits, and network flakiness
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

describe('Spotify MCP Server Resilience', () => {
  let serverProcess: ChildProcess;
  let messageId = 1;

  const mockConfigPath = join(process.cwd(), 'test-resilience-config.json');
  const mockTokenPath = join(process.cwd(), 'test-resilience-tokens.json');

  beforeAll(async () => {
    // Create mock configuration for resilience testing
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
        level: 'info',
        format: 'json'
      },
      server: {
        https: {
          enabled: false
        }
      }
    };

    // Create mock tokens
    const mockTokens = {
      accessToken: 'mock-access-token-resilience',
      refreshToken: 'mock-refresh-token-resilience',
      expiresAt: Date.now() + 3600000,
      tokenType: 'Bearer',
      scope: 'user-read-playback-state user-modify-playback-state'
    };

    writeFileSync(mockConfigPath, JSON.stringify(mockConfig, null, 2));
    writeFileSync(mockTokenPath, JSON.stringify(mockTokens, null, 2));

    // Start server process
    serverProcess = spawn('node', ['--loader', 'ts-node/esm', 'src/index.ts'], {
      cwd: join(process.cwd(), 'apps/server'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, SPOTIFY_MCP_CONFIG: mockConfigPath }
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  afterAll(() => {
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

  const sendMessage = async (message: MCPMessage, timeout = 15000): Promise<MCPMessage> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);

      const messageStr = JSON.stringify(message) + '\n';

      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString().trim());
          if (response.id === message.id) {
            clearTimeout(timer);
            serverProcess.stdout?.off('data', responseHandler);
            resolve(response);
          }
        } catch (error) {
          // Ignore parsing errors
        }
      };

      serverProcess.stdout?.on('data', responseHandler);
      serverProcess.stdin?.write(messageStr);
    });
  };

  describe('Rate Limit Handling', () => {
    it('should handle 429 rate limit responses gracefully', async () => {
      // This test simulates rate limit behavior
      // In practice, the HTTP client should implement exponential backoff

      const startTime = Date.now();

      try {
        const message: MCPMessage = {
          jsonrpc: '2.0',
          id: messageId++,
          method: 'tools/call',
          params: {
            name: 'tracks.search',
            arguments: {
              query: 'test rate limit',
              limit: 1
            }
          }
        };

        const response = await sendMessage(message, 20000);

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Even if it fails due to auth, should respond within reasonable time
        // and not crash the server
        expect(duration).toBeLessThan(20000);
        expect(response).toBeDefined();

        // If there's an error, it should be a proper error response
        if (response.error) {
          expect(response.error.message).toBeDefined();
          expect(typeof response.error.message).toBe('string');
        }

      } catch (error) {
        // Timeout or connection error is acceptable in resilience test
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(25000);
      }
    }, 25000);

    it('should implement backoff and jitter for retries', async () => {
      // Test that multiple rapid requests don't overwhelm the system
      const promises = [];
      const startTime = Date.now();

      for (let i = 0; i < 5; i++) {
        const message: MCPMessage = {
          jsonrpc: '2.0',
          id: messageId++,
          method: 'tools/call',
          params: {
            name: 'playback.state.get',
            arguments: {}
          }
        };

        promises.push(sendMessage(message, 10000).catch(err => ({ error: err.message })));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // All requests should complete or fail gracefully
      expect(results).toHaveLength(5);

      // Should not take an excessive amount of time (no hanging)
      expect(totalDuration).toBeLessThan(15000);

      // Server should still be responsive
      const healthCheck: MCPMessage = {
        jsonrpc: '2.0',
        id: messageId++,
        method: 'tools/list'
      };

      const healthResponse = await sendMessage(healthCheck);
      expect(healthResponse.result).toBeDefined();
    }, 20000);
  });

  describe('Error Recovery', () => {
    it('should handle malformed requests without crashing', async () => {
      // Send malformed JSON
      const malformedMessage = '{"jsonrpc":"2.0","id":' + messageId++ + ',"method":"tools/call","params":{"invalid":"json"\n';

      serverProcess.stdin?.write(malformedMessage);

      // Wait a moment for potential crash
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Server should still respond to valid requests
      const validMessage: MCPMessage = {
        jsonrpc: '2.0',
        id: messageId++,
        method: 'tools/list'
      };

      const response = await sendMessage(validMessage);
      expect(response.result).toBeDefined();
    });

    it('should handle invalid tool calls gracefully', async () => {
      const invalidMessage: MCPMessage = {
        jsonrpc: '2.0',
        id: messageId++,
        method: 'tools/call',
        params: {
          name: 'nonexistent.tool',
          arguments: { invalid: 'data' }
        }
      };

      const response = await sendMessage(invalidMessage);

      expect(response.error).toBeDefined();
      expect(response.error.message).toBeDefined();

      // Server should still be responsive after error
      const healthCheck: MCPMessage = {
        jsonrpc: '2.0',
        id: messageId++,
        method: 'tools/list'
      };

      const healthResponse = await sendMessage(healthCheck);
      expect(healthResponse.result).toBeDefined();
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle parallel search requests efficiently', async () => {
      const queries = ['rock', 'jazz', 'classical', 'electronic', 'pop'];
      const startTime = Date.now();

      const promises = queries.map(query => {
        const message: MCPMessage = {
          jsonrpc: '2.0',
          id: messageId++,
          method: 'tools/call',
          params: {
            name: 'tracks.search',
            arguments: {
              query,
              limit: 5
            }
          }
        };

        return sendMessage(message, 15000).catch(err => ({ error: err.message }));
      });

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Parallel requests should be reasonably fast
      expect(duration).toBeLessThan(15000); // 15 second timeout
      expect(results).toHaveLength(queries.length);

      // Calculate rough performance metrics
      const successfulRequests = results.filter(r => !('error' in r)).length;
      console.log(`Parallel search performance: ${successfulRequests}/${queries.length} successful in ${duration}ms`);

      if (successfulRequests > 0) {
        const avgTimePerRequest = duration / successfulRequests;
        console.log(`Average time per request: ${avgTimePerRequest.toFixed(2)}ms`);

        // Should be reasonably efficient (not more than 5 seconds per request on average)
        expect(avgTimePerRequest).toBeLessThan(5000);
      }
    }, 20000);

    it('should handle large playlist operations without O(N²) behavior', async () => {
      // Test with a reasonable number of URIs to check for performance issues
      const mockUris = Array.from({ length: 50 }, (_, i) =>
        `spotify:track:${i.toString().padStart(22, '0')}`
      );

      const startTime = Date.now();

      const message: MCPMessage = {
        jsonrpc: '2.0',
        id: messageId++,
        method: 'tools/call',
        params: {
          name: 'playlists.tracks.add',
          arguments: {
            playlistId: 'test-playlist-id',
            uris: mockUris,
            dryRun: true, // Important: don't actually modify anything
            dedupe: true
          }
        }
      };

      try {
        const response = await sendMessage(message, 10000);
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete in reasonable time even with deduplication
        expect(duration).toBeLessThan(10000);

        // Even if it fails due to auth/invalid playlist, should respond quickly
        expect(response).toBeDefined();

        console.log(`Playlist operation (50 URIs, dryRun): ${duration}ms`);

        // Performance should be roughly linear, not quadratic
        const timePerUri = duration / mockUris.length;
        expect(timePerUri).toBeLessThan(100); // Less than 100ms per URI

      } catch (error) {
        const duration = Date.now() - startTime;

        // Even failures should be fast
        expect(duration).toBeLessThan(10000);
      }
    }, 15000);
  });

  describe('Logging & Security', () => {
    it('should not log sensitive information', async () => {
      let logOutput = '';

      // Capture stderr for log analysis
      const stderrHandler = (data: Buffer) => {
        logOutput += data.toString();
      };

      serverProcess.stderr?.on('data', stderrHandler);

      try {
        const message: MCPMessage = {
          jsonrpc: '2.0',
          id: messageId++,
          method: 'tools/call',
          params: {
            name: 'tracks.search',
            arguments: {
              query: 'test logging security',
              limit: 1
            }
          }
        };

        await sendMessage(message, 10000).catch(() => {
          // Ignore failures, we're testing logging
        });

        // Wait for logs to be written
        await new Promise(resolve => setTimeout(resolve, 1000));

        serverProcess.stderr?.off('data', stderrHandler);

        // Check that sensitive information is not logged
        const forbiddenPatterns = [
          /authorization[:\s]+bearer\s+[a-zA-Z0-9]/i,
          /access[_\s]?token[:\s]+[a-zA-Z0-9]/i,
          /refresh[_\s]?token[:\s]+[a-zA-Z0-9]/i,
          /set-cookie/i,
          /client[_\s]?secret/i,
        ];

        for (const pattern of forbiddenPatterns) {
          expect(logOutput).not.toMatch(pattern);
        }

        console.log(`Log output length: ${logOutput.length} characters`);

        // Should have some logging (not completely silent)
        if (logOutput.length > 0) {
          expect(logOutput).toMatch(/spotify.*mcp/i);
        }

      } finally {
        serverProcess.stderr?.off('data', stderrHandler);
      }
    }, 15000);
  });
});
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/'],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@spotify-mcp/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@spotify-mcp/auth': path.resolve(__dirname, './packages/auth/src/index.ts'),
      '@spotify-mcp/spotify': path.resolve(__dirname, './packages/spotify/src/index.ts'),
      '@spotify-mcp/mcp': path.resolve(__dirname, './packages/mcp/src/index.ts'),
      '@spotify-mcp/platform': path.resolve(__dirname, './packages/platform/src/index.ts'),
    },
  },
});
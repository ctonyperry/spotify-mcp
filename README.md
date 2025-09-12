# Spotify MCP

A modern, robust Spotify MCP implementation built with hexagonal architecture.

## 🏗️ Architecture

This project follows a **ports & adapters (hexagonal)** architecture pattern:

- **`packages/core`**: Pure domain services and business logic (no I/O)
- **`packages/auth`**: HTTPS OAuth with PKCE, token storage, refresh handling
- **`packages/spotify`**: Typed Spotify Web API client with retries and rate limiting
- **`packages/mcp`**: MCP tool schemas, registry, and handler plumbing
- **`packages/platform`**: Configuration, logging, telemetry, utilities
- **`apps/server`**: Composition root that wires everything together

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Generate development certificates:**
   ```bash
   node scripts/gen-dev-cert.mjs
   ```

3. **Configure Spotify credentials:**
   ```bash
   # Copy and edit the example configuration
   cp spotify-config.example.json spotify-config.json
   # Add your Spotify Client ID and Secret
   ```

4. **Run OAuth setup:**
   ```bash
   pnpm oauth
   ```

5. **Start development server:**
   ```bash
   pnpm dev
   ```

## 📋 Tool Catalog

> **Note:** This is the planned tool catalog. Implementation is in progress.

### Search & Discovery
- `tracks.search` - Search for tracks
- `albums.search` - Search for albums  
- `artists.search` - Search for artists

### Playback Control
- `playback.state.get` - Get current playback state
- `playback.control.set` - Control playback (play/pause/next/previous)

### Playlists
- `playlists.list.mine` - List user's playlists
- `playlists.tracks.get` - Get playlist tracks
- `playlists.create` - Create new playlist
- `playlists.tracks.add` - Add tracks to playlist (with deduplication)

### Library Management
- `library.saved.tracks.get` - Get saved tracks
- `library.saved.tracks.save` - Save tracks
- `library.saved.tracks.remove` - Remove saved tracks
- `library.saved.albums.get` - Get saved albums
- `library.saved.albums.save` - Save albums
- `library.saved.albums.remove` - Remove saved albums

### Queue Management
- `queue.add` - Add track to queue

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

## 🔧 Development Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm oauth` - Run OAuth setup flow
- `pnpm build` - Build all packages
- `pnpm lint` - Run linting
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm format` - Format code with Prettier

## 🔐 Security

- HTTPS enforced for all OAuth flows
- Self-signed certificates for development (generated automatically)
- Secure token storage with restricted permissions
- Minimal required OAuth scopes
- Secrets never logged

## 🎯 Development Status

This is a new implementation following the specification in `CLAUDE.md`. Current progress:

- ✅ Project scaffold and TypeScript workspace
- ✅ Hexagonal architecture package structure  
- ✅ Development tooling (ESLint, Prettier, Vitest)
- 🚧 Platform utilities (config, logging)
- 🚧 Authentication system (OAuth, PKCE, token storage)
- 🚧 Spotify Web API client
- 🚧 Domain services
- 🚧 MCP tool implementations

## 📖 Extension Guide

To add new capabilities:

1. Define schemas in `packages/mcp/src/schemas/`
2. Implement domain logic in `packages/core/src/services/`
3. Add Spotify API calls in `packages/spotify/src/client/`
4. Wire everything together in MCP handlers in `packages/mcp/src/tools/`

All external boundaries use Zod validation for type safety.
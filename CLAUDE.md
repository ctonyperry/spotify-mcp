# Spotify MCP - Implementation Status & Context

> **Project**: Modern Spotify MCP server using hexagonal architecture
> **Status**: Foundation complete, core functionality implementation needed
> **Location**: `C:\Users\piznu\spotify-mcp\`

## 🎯 Current Implementation Status

This is a **re-architecture** of an existing Spotify MCP server located at `C:\Users\piznu\spotify-mcp-server\`. The new implementation follows hexagonal architecture principles and is approximately **40% complete**.

### ✅ **Completed Infrastructure**
- **Project scaffold**: pnpm monorepo with TypeScript strict mode
- **Development tooling**: ESLint, Prettier, Vitest testing framework
- **Platform package** (`packages/platform/`): Complete with config loader, structured logging, HTTP client with retries/backoff, error types, and utilities
- **Auth package** (`packages/auth/`): Complete OAuth/PKCE implementation with secure file-based token storage
- **Scripts**: Certificate generation (`scripts/gen-dev-cert.mjs`) and OAuth bootstrap (`scripts/oauth-bootstrap.mjs`)
- **Server bootstrap**: Basic MCP server composition root in `apps/server/`

### 🚧 **Missing Core Implementation**

The following packages exist but contain only placeholder `index.ts` files:

1. **`packages/spotify/`** - Spotify Web API client
2. **`packages/core/`** - Domain services and business logic
3. **`packages/mcp/`** - MCP tool schemas and handlers

## 📋 Required Tool Catalog

The new implementation must provide functional parity with these capabilities:

### Search & Discovery
- `tracks.search` - Search for tracks by query with pagination
- `albums.search` - Search for albums by query with pagination
- `artists.search` - Search for artists by query with pagination

### Playback Control
- `playback.state.get` - Get current playback state and now playing
- `playback.control.set` - Control playback (play/pause/next/previous)

### Playlists
- `playlists.list.mine` - List user's playlists with pagination
- `playlists.tracks.get` - Get playlist tracks with pagination
- `playlists.create` - Create new playlist
- `playlists.tracks.add` - Add tracks to playlist (with deduplication support)

### Library Management
- `library.saved.tracks.get|save|remove|check` - Manage saved tracks
- `library.saved.albums.get|save|remove|check` - Manage saved albums

### Queue Management
- `queue.add` - Add track to playback queue

## 🏗️ Architecture Requirements

**Hexagonal Architecture Pattern:**
- **Domain** (`packages/core/`): Pure business logic, no I/O dependencies
- **Adapters** (`packages/spotify/`, `packages/auth/`, `packages/platform/`): External integrations
- **Application** (`packages/mcp/`): MCP tool handlers that orchestrate domain + adapters
- **Infrastructure** (`apps/server/`): Composition root wiring everything together

**Quality Standards:**
- All external boundaries use Zod validation
- Structured logging with requestId, toolName, durationMs
- Retry/backoff for 5xx/429 responses with jitter
- Domain-typed errors (never bubble raw API errors)
- HTTPS-only OAuth with PKCE
- Idempotent operations where possible
- 90%+ test coverage on domain + adapter logic

## 🔧 Implementation Guidance

### For `packages/spotify/`
Create typed Spotify Web API client with:
- DTOs for all API responses using Zod schemas
- Retry logic with exponential backoff + jitter
- Rate limiting (429 handling)
- Pagination helpers for consistent offset/limit patterns
- Error mapping from HTTP status codes to domain errors
- Contract tests with recorded fixtures (VCR-style)

### For `packages/core/`
Implement pure domain services:
- Track/album/playlist search with filtering logic
- Playback state management
- Playlist creation and modification rules
- Library management with idempotency rules
- Queue management logic
- No I/O dependencies - accept injected data

### For `packages/mcp/`
Build MCP integration layer:
- Zod schemas for all tool inputs/outputs
- Tool registry and handler registration
- MCP handlers that compose domain services + adapters
- Consistent error handling and logging
- No business logic in handlers (orchestration only)

## 📁 Key Files to Reference

**Configuration:**
- `packages/platform/src/config/types.ts` - Complete config schema with OAuth, HTTPS, logging settings

**Authentication:**
- `packages/auth/src/oauth/types.ts` - OAuth flow types and interfaces
- `packages/auth/src/oauth/client.ts` - Complete OAuth client implementation

**Infrastructure:**
- `packages/platform/src/http/client.ts` - HTTP client with retry/backoff logic
- `packages/platform/src/logging/` - Structured logging implementation

**Server Entry Points:**
- `apps/server/src/index.ts` - Main MCP server (needs tool registration)
- `apps/server/src/bin/oauth.ts` - OAuth setup CLI

## 🔍 Development Commands

```bash
# In the spotify-mcp directory:
pnpm install          # Install dependencies
pnpm dev              # Start development server
pnpm oauth            # Run OAuth setup
pnpm test             # Run all tests
pnpm build            # Build all packages
pnpm lint             # Lint code
pnpm typecheck        # TypeScript checking
```

## 🎭 Testing Strategy

- **Unit tests**: Domain services (pure functions) with 100% coverage
- **Contract tests**: Spotify adapter with recorded API responses
- **Integration tests**: End-to-end MCP tool flows
- **Security tests**: HTTPS enforcement, token hygiene
- **Resilience tests**: 401/403/429/5xx error handling

## 🚨 Critical Success Factors

1. **Functional Parity**: All tools from original server must work identically
2. **Unrecognizable**: Different naming, file structure, and symbol graph from original
3. **Domain Purity**: No I/O in `packages/core/` - only pure business logic
4. **Type Safety**: Zod validation on all external boundaries
5. **Observability**: Request correlation, timing, and structured errors
6. **Security**: HTTPS enforced, secrets never logged, minimal scopes

## 📊 Original Server Reference

The original implementation is at `C:\Users\piznu\spotify-mcp-server\` with these key files:
- `src/read.ts` - Search and library functionality
- `src/play.ts` - Playback and queue controls
- `src/albums.ts` - Album management
- `src/utils.ts` - Spotify API client utilities

**Do not copy code directly** - use for understanding functional requirements only.

## 🎯 Next Steps Priority

1. **Implement Spotify adapter** (`packages/spotify/`) - API client with full error handling
2. **Build domain services** (`packages/core/`) - Pure business logic for each capability
3. **Create MCP tools** (`packages/mcp/`) - Tool schemas and handlers
4. **Wire server integration** (`apps/server/`) - Register all tools with MCP server
5. **Add comprehensive tests** - Unit, integration, and contract tests
6. **Verify functional parity** - Test against original server capabilities

---

**Important**: This refactor aims for a completely new implementation that happens to provide the same functionality. Focus on clean architecture, type safety, and maintainability over speed of delivery.
# Architecture Overview

## Hexagonal Architecture (Ports & Adapters)

This Spotify MCP server implements hexagonal architecture to ensure clean separation of concerns, testability, and maintainability.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MCP CLIENT                                     │
│                        (Claude, other AI tools)                            │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │ JSON-RPC over stdio
                          │
┌─────────────────────────▼───────────────────────────────────────────────────┐
│                      INFRASTRUCTURE LAYER                                  │
│                         apps/server/                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Composition Root                                 │   │
│  │  • MCP Server setup                                                 │   │
│  │  • Dependency injection                                             │   │
│  │  • Request/response handling                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────────────┐
│                       APPLICATION LAYER                                    │
│                        packages/mcp/                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Tool Registry  │  │  Input/Output   │  │       MCP Handlers          │  │
│  │                 │  │   Schemas       │  │                             │  │
│  │  • Tool lookup  │  │  • Zod schemas  │  │  • tracks.search            │  │
│  │  • Registration │  │  • Validation   │  │  • playlists.create         │  │
│  │  • Metadata     │  │  • Type safety  │  │  • playback.control.set     │  │
│  └─────────────────┘  └─────────────────┘  │  • library.saved.tracks.*   │  │
│                                            │  • queue.add                │  │
│                                            └─────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │ Orchestrates domain + adapters
                          │
┌─────────────────────────▼───────────────────────────────────────────────────┐
│                        DOMAIN LAYER                                        │
│                       packages/core/                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Domain Types   │  │ Business Logic  │  │       Domain Rules          │  │
│  │                 │  │                 │  │                             │  │
│  │  • Track        │  │ • SearchService │  │  • Deduplication logic      │  │
│  │  • Playlist     │  │ • PlaylistOps   │  │  • Playlist constraints     │  │
│  │  • Library      │  │ • PlaybackCtrl  │  │  • Selection criteria       │  │
│  │  • Queue        │  │ • LibraryMgmt   │  │  • Normalization rules      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │ Pure business logic (no I/O)
                          │
┌─────────────────────────▼───────────────────────────────────────────────────┐
│                       ADAPTER LAYER                                        │
│                     External Integrations                                  │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Spotify API    │  │  OAuth & Auth   │  │      Platform Utils         │  │
│  │ packages/spotify│  │ packages/auth   │  │   packages/platform         │  │
│  │                 │  │                 │  │                             │  │
│  │  • HTTP client  │  │  • OAuth/PKCE   │  │  • Structured logging       │  │
│  │  • API mapping  │  │  • Token storage│  │  • Configuration loader     │  │
│  │  • Rate limits  │  │  • Refresh flow │  │  • HTTP client base         │  │
│  │  • Retry logic  │  │  • Secure store │  │  • Error types              │  │
│  │  • Pagination   │  │                 │  │  • Utility functions        │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────────────┐
│                      EXTERNAL SYSTEMS                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Spotify Web API                               │   │
│  │  • Authentication endpoints                                        │   │
│  │  • Track, album, artist search                                     │   │
│  │  • Playlist management                                             │   │
│  │  • Playback control                                                │   │
│  │  • User library operations                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Benefits

### 1. **Domain Purity**
- Core business logic has zero I/O dependencies
- Pure functions make testing straightforward
- Easy to reason about and modify

### 2. **Adapter Isolation**
- External dependencies are contained in adapter layers
- Easy to swap implementations (e.g., different OAuth providers)
- Mock adapters for testing

### 3. **Type Safety**
- Zod schemas validate all external boundaries
- TypeScript ensures compile-time safety
- Runtime validation catches integration issues

### 4. **Testability**
- Each layer can be tested in isolation
- Pure domain functions are 100% deterministic
- Adapters can be mocked or stubbed

### 5. **Observability**
- Structured logging at all boundaries
- Request correlation across layers
- Performance monitoring built-in

## Data Flow

### Request Processing
```
MCP Request → Input Validation → Domain Logic → Adapter Calls → Response Mapping → MCP Response
     ↓              ↓               ↓             ↓              ↓            ↓
   Raw JSON    Zod Schema     Pure Function   HTTP Calls    Domain Type   Formatted JSON
```

### Example: Track Search Flow
1. **MCP Handler** receives `tracks.search` call
2. **Input Schema** validates query parameters
3. **Domain Service** applies search logic/rules
4. **Spotify Adapter** makes HTTP API call
5. **Response Mapper** converts API response to domain types
6. **Output Schema** formats response for MCP protocol

### Error Handling Flow
```
Adapter Error → Domain Error → MCP Error Response
     ↓              ↓             ↓
  HTTP 429      RateLimitError   Structured JSON
  HTTP 401      AuthError        Error message
  HTTP 5xx      ServiceError     Retry suggestion
```

## Security Boundaries

### 1. **Input Validation**
- All MCP inputs validated with Zod schemas
- No raw data enters domain layer
- SQL injection / XSS prevention

### 2. **Authentication**
- OAuth tokens never logged
- Automatic token redaction in logs
- Secure file-based token storage

### 3. **API Security**
- Rate limiting with exponential backoff
- Request timeout enforcement
- HTTPS-only communication

## Package Dependencies

```
apps/server
    ├── @spotify-mcp/mcp (application layer)
    ├── @spotify-mcp/core (domain layer)
    ├── @spotify-mcp/spotify (adapter)
    ├── @spotify-mcp/auth (adapter)
    └── @spotify-mcp/platform (adapter)

packages/mcp
    ├── @spotify-mcp/core (domain layer)
    ├── @spotify-mcp/spotify (adapter)
    └── @spotify-mcp/platform (utilities)

packages/core
    └── (no external dependencies - pure domain)

packages/spotify
    ├── @spotify-mcp/auth (OAuth)
    └── @spotify-mcp/platform (HTTP client)

packages/auth
    └── @spotify-mcp/platform (crypto, storage)

packages/platform
    └── (Node.js built-ins only)
```

## Deployment Architecture

### Development
```
Developer Machine
├── pnpm dev (MCP server stdio)
├── OAuth callback server (HTTPS)
└── Local token storage
```

### Docker Container
```
Container
├── MCP server process
├── Volume-mounted config
├── Volume-mounted secrets
└── Health check endpoint
```

### CI/CD Pipeline
```
GitHub Actions
├── Unit tests (domain + adapters)
├── Integration tests (MCP protocol)
├── Security scanning
├── Parity tests (vs. legacy server)
└── Docker image build
```

This architecture ensures the Spotify MCP server is maintainable, testable, and secure while providing excellent developer experience.
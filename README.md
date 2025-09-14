# Spotify MCP Server

A modern, robust Spotify MCP (Model Context Protocol) server implementation using hexagonal architecture. This server provides comprehensive Spotify Web API integration for AI assistants and tools.

<!-- Badges -->
[![CI](https://github.com/spotify-mcp/spotify-mcp/workflows/CI/badge.svg)](https://github.com/spotify-mcp/spotify-mcp/actions)
[![Coverage](https://codecov.io/gh/spotify-mcp/spotify-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/spotify-mcp/spotify-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)

---

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [Setup OAuth](#1-setup-oauth)
  - [Run the Server](#2-run-the-server)
  - [Test with MCP Client](#3-test-with-mcp-client)
  - [Demo CLI](#4-demo-cli)
- [🛠️ Tool Catalog](#-tool-catalog)
- [⚙️ Configuration](#-configuration)
- [🏗️ Architecture](#-architecture)
- [🧪 Development](#-development)
- [🔒 Security](#-security-notes)
- [🔧 Troubleshooting](#-troubleshooting)
- [🐳 Docker Support](#-docker-support)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Spotify App**: Create at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

### 1. Setup OAuth

```bash
# Clone and install dependencies
git clone https://github.com/ctonyperry/spotify-mcp/spotify-mcp.git
cd spotify-mcp
pnpm install

# Generate development certificates for HTTPS
pnpm dev:cert

# Configure OAuth (interactive setup)
pnpm oauth
```

The OAuth setup will:
- Prompt for your Spotify App credentials
- Start a secure HTTPS server for OAuth callback
- Save tokens securely to local file storage

### 2. Run the Server

```bash
# Development mode with auto-reload
pnpm dev

# Production mode
pnpm build
pnpm start
```

The server communicates via stdin/stdout using the MCP protocol.

### 3. Test with MCP Client

```bash
# List available tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | pnpm dev

# Search for tracks
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"tracks.search","arguments":{"query":"bohemian rhapsody","limit":5}}}' | pnpm dev
```

### 4. Demo CLI

For easier testing and demonstration, use the included CLI:

```bash
# Search for tracks
pnpm cli tracks search "sandstorm"

# List user playlists
pnpm cli playlists list --limit 10

# Add tracks to playlist (dry run)
pnpm cli playlists add <playlist-id> --uris "spotify:track:123,spotify:track:456" --dry-run

# Control playback
pnpm cli playback control pause
pnpm cli playback control play

# Queue management
pnpm cli queue add "spotify:track:4u7EnebtmKWzUH433cf5Qv"

# Library operations
pnpm cli library tracks --limit 20
pnpm cli library save-track "4u7EnebtmKWzUH433cf5Qv"

# Output as JSON
pnpm cli tracks search "bohemian rhapsody" --json
```

## 🛠️ Tool Catalog

### 🔍 Search & Discovery

| Tool | Description | Input | Output |
|------|-------------|--------|---------|
| `tracks.search` | Search for tracks | `{query: string, limit?: number, offset?: number}` | Track results with metadata |
| `albums.search` | Search for albums | `{query: string, limit?: number, offset?: number}` | Album results with metadata |
| `artists.search` | Search for artists | `{query: string, limit?: number, offset?: number}` | Artist results with metadata |

### 🎵 Playback Control

| Tool | Description | Input | Output |
|------|-------------|--------|---------|
| `playback.state.get` | Get current playback state | `{}` | Current track, device, playing status |
| `playback.control.set` | Control playback | `{action: "play"\|"pause"\|"next"\|"previous", deviceId?: string}` | Success confirmation |

### 📋 Playlists

| Tool | Description | Input | Output |
|------|-------------|--------|---------|
| `playlists.list.mine` | List user's playlists | `{limit?: number, offset?: number}` | User playlists with metadata |
| `playlists.tracks.get` | Get playlist tracks | `{playlistId: string, limit?: number, offset?: number}` | Playlist tracks |
| `playlists.create` | Create new playlist | `{name: string, description?: string, public?: boolean}` | Created playlist details |
| `playlists.tracks.add` | Add tracks to playlist | `{playlistId: string, uris: string[], position?: number, dedupe?: boolean, dryRun?: boolean}` | Operation result with deduplication stats |

### 📚 Library Management

| Tool | Description | Input | Output |
|------|-------------|--------|---------|
| `library.saved.tracks.get` | Get saved tracks | `{limit?: number, offset?: number}` | User's liked tracks |
| `library.saved.tracks.save` | Save tracks to library | `{ids: string[]}` | Save operation result |
| `library.saved.tracks.remove` | Remove tracks from library | `{ids: string[]}` | Remove operation result |
| `library.saved.tracks.check` | Check if tracks are saved | `{ids: string[]}` | Boolean array of save status |
| `library.saved.albums.*` | Album library operations | Similar to tracks | Album-specific operations |

### 🎶 Queue Management

| Tool | Description | Input | Output |
|------|-------------|--------|---------|
| `queue.add` | Add track to queue | `{uri: string, deviceId?: string}` | Queue operation result |

> **📖 Detailed Schemas**: See [`packages/mcp/src/schemas/`](packages/mcp/src/schemas/) for complete input/output specifications.

## ⚙️ Configuration

### Environment Variables

```bash
# Optional: Custom config path
export SPOTIFY_MCP_CONFIG=/path/to/config.json

# Development: Enable debug logging
export SPOTIFY_MCP_LOG_LEVEL=debug
```

### Configuration File

Create `config.local.json` (see [`config.local.example.json`](config.local.example.json)):

```json
{
  "spotify": {
    "clientId": "your-spotify-client-id",
    "redirectUri": "https://localhost:8888/callback",
    "scopes": [
      "user-read-playback-state",
      "user-modify-playback-state",
      "playlist-read-private",
      "playlist-modify-private",
      "user-library-read",
      "user-library-modify"
    ]
  },
  "auth": {
    "storage": {
      "type": "file",
      "path": ".secrets/tokens.json"
    }
  },
  "logging": {
    "level": "info",
    "format": "json"
  },
  "server": {
    "https": {
      "enabled": true,
      "cert": ".cert/localhost.crt",
      "key": ".cert/localhost.key"
    }
  }
}
```

## 🔧 Troubleshooting

### Common Issues

#### 🔐 Authentication Problems

**Issue**: `401 Unauthorized` errors
- **Check**: Spotify app credentials in config
- **Verify**: Redirect URI matches Spotify app settings exactly
- **Solution**: Run `pnpm oauth` to re-authenticate

**Issue**: `403 Forbidden` errors
- **Check**: Required scopes in config match your usage
- **Solution**: Add missing scopes and re-run OAuth

#### 🚦 Rate Limiting

**Issue**: `429 Too Many Requests` errors
- **Behavior**: Server automatically retries with exponential backoff
- **Monitoring**: Check logs for `retryAfterMs` values
- **Solution**: Reduce request frequency or add delays between calls

#### 🌐 Network & HTTPS

**Issue**: OAuth callback fails
- **Check**: HTTPS certificates are valid (`pnpm dev:cert`)
- **Verify**: Port 8888 is available during OAuth flow
- **Solution**: Regenerate certificates if expired

**Issue**: `SSL_ERROR` during OAuth
- **Check**: Certificate files exist in `.cert/` directory
- **Solution**: Run `pnpm dev:cert` to generate new certificates

#### 🎵 Playbook Control

**Issue**: `No active device` errors
- **Requirement**: Spotify app must be open on a device
- **Solution**: Start Spotify on phone/computer before using playback controls

### Debug Mode

Enable detailed logging:

```bash
# Set log level to debug
export SPOTIFY_MCP_LOG_LEVEL=debug

# Run with debug output
pnpm dev 2>debug.log
```

### Getting Help

1. **Check logs**: Review structured JSON logs for error details
2. **Test tools**: Use [`examples/`](examples/) for known-good requests
3. **Verify auth**: Ensure tokens haven't expired (tokens auto-refresh)
4. **Check scopes**: Verify your Spotify app has required permissions

## 🔒 Security Notes

### HTTPS Enforcement

- **OAuth Flow**: HTTPS required for secure token exchange
- **Certificates**: Self-signed certificates for local development
- **Production**: Use proper SSL certificates in production

### Token Security

- **Storage**: Tokens stored in local file with restricted permissions
- **Logging**: Access tokens never logged (automatically redacted)
- **Rotation**: Refresh tokens used automatically for expired access tokens

### API Security

- **Input Validation**: All inputs validated with Zod schemas
- **Rate Limiting**: Built-in respect for Spotify API rate limits
- **Error Sanitization**: Internal errors never expose sensitive data

## 🏗️ Architecture

This implementation follows **hexagonal architecture** principles:

- **Domain** (`packages/core/`): Pure business logic, no I/O dependencies
- **Adapters** (`packages/spotify/`, `packages/auth/`, `packages/platform/`): External integrations
- **Application** (`packages/mcp/`): MCP tool handlers that orchestrate domain + adapters
- **Infrastructure** (`apps/server/`): Composition root wiring everything together

### Key Design Principles

1. **Type Safety**: Zod validation on all external boundaries
2. **Structured Logging**: Request correlation, timing, and structured errors
3. **Resilience**: Retry/backoff for 5xx/429 responses with jitter
4. **Domain Purity**: No I/O in core business logic
5. **Security**: HTTPS enforced, secrets never logged, minimal scopes

## 🧪 Development

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit          # Unit tests only
pnpm test:e2e           # End-to-end tests
pnpm test:mcp           # MCP package tests
pnpm test:spotify       # Spotify adapter tests

# Run functional parity tests
pnpm parity             # Compare with legacy server

# Full CI pipeline
pnpm ci                 # lint + typecheck + test + parity
```

### Code Quality

```bash
# Linting and formatting
pnpm lint               # ESLint check
pnpm format             # Prettier format
pnpm typecheck          # TypeScript check

# Build
pnpm build              # Build all packages
```

### Debugging

```bash
# Debug mode with verbose logging
SPOTIFY_MCP_LOG_LEVEL=debug pnpm dev

# Record Spotify API interactions (for tests)
RECORD=1 pnpm test:spotify
```

## 📝 Example Transcripts

### Search for Tracks

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tracks.search",
    "arguments": {
      "query": "bohemian rhapsody",
      "limit": 3
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\n  \"items\": [\n    {\n      \"uri\": \"spotify:track:4u7EnebtmKWzUH433cf5Qv\",\n      \"id\": \"4u7EnebtmKWzUH433cf5Qv\",\n      \"name\": \"Bohemian Rhapsody\",\n      \"artists\": [\"Queen\"],\n      \"durationMs\": 355000,\n      \"explicit\": false,\n      \"popularity\": 89\n    }\n  ],\n  \"total\": 1000,\n  \"limit\": 3,\n  \"offset\": 0,\n  \"hasMore\": true\n}"
    }]
  }
}
```

**Logs (Redacted):**
```json
{"level":"info","timestamp":"2024-01-15T10:30:00.000Z","component":"mcp-tools","toolName":"tracks.search","requestId":"req_1234567890_abc123","message":"Tool invocation started","args":{"query":"bohemian rhapsody","limit":3}}
{"level":"info","timestamp":"2024-01-15T10:30:01.234Z","component":"mcp-tools","toolName":"tracks.search","requestId":"req_1234567890_abc123","message":"Tool invocation completed","durationMs":1234}
```

### Add Tracks to Playlist (Dry Run)

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "playlists.tracks.add",
    "arguments": {
      "playlistId": "37i9dQZF1DX0XUsuxWHRQd",
      "uris": [
        "spotify:track:4u7EnebtmKWzUH433cf5Qv",
        "spotify:track:7tFiyTwD0nx5a1eklYtX2J"
      ],
      "dedupe": true,
      "dryRun": true
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\n  \"success\": true,\n  \"message\": \"Would add 2 tracks (0 duplicates skipped)\",\n  \"plannedAdds\": 2,\n  \"duplicatesSkipped\": 0\n}"
    }]
  }
}
```

### Pause Playback

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "playback.control.set",
    "arguments": {
      "action": "pause"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\n  \"success\": true,\n  \"message\": \"Playback paused\",\n  \"action\": \"pause\"\n}"
    }]
  }
}
```

## 📦 Release Process

### Version Management

We follow [Semantic Versioning](https://semver.org/):

- **PATCH**: Bug fixes, security updates
- **MINOR**: New tools, non-breaking features
- **MAJOR**: Breaking changes to tool APIs

### Creating a Release

```bash
# Run full test suite
pnpm ci

# Update version and create tag
npm version patch|minor|major

# Push with tags
git push --follow-tags

# GitHub Actions will handle the release
```

See [`RELEASING.md`](RELEASING.md) for detailed release procedures.

## 🐳 Docker Support

### Build Image

```bash
docker build -t spotify-mcp .
```

### Run Container

```bash
# Create config and secrets directories
mkdir -p .cert .secrets

# Run with volume mounts
docker run -it \
  -v $(pwd)/.cert:/app/.cert \
  -v $(pwd)/.secrets:/app/.secrets \
  -v $(pwd)/config.local.json:/app/config.local.json \
  spotify-mcp
```

The Docker image:
- ✅ Runs as non-root user
- ✅ Multi-stage build (minimal runtime)
- ✅ Health check on HTTPS port
- ✅ Proper volume mounts for secrets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests
4. Run quality checks: `pnpm ci`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines

- **Tests Required**: All new features must include tests
- **Type Safety**: Use TypeScript strictly, no `any` types
- **Documentation**: Update README and schemas for API changes
- **Security**: Never commit secrets or credentials
- **Performance**: Consider impact of changes on request latency

## 📄 License

MIT License - see [`LICENSE`](LICENSE) file for details.

---

**🎵 Happy coding with Spotify MCP!** 🎵

For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/spotify-mcp/spotify-mcp).

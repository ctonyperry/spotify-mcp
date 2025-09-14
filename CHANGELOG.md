# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial implementation of Spotify MCP server with hexagonal architecture
- Complete MCP tool catalog with 17 tools across 5 categories
- HTTPS OAuth flow with PKCE for secure authentication
- Functional parity verification suite
- Resilience and performance hardening tests
- Comprehensive documentation and examples
- Docker support with health checks
- CI/CD pipeline with security scanning

## [0.1.0] - 2024-01-15

### Added
- **Search & Discovery Tools**
  - `tracks.search` - Search for tracks with pagination
  - `albums.search` - Search for albums with pagination
  - `artists.search` - Search for artists with pagination

- **Playback Control Tools**
  - `playback.state.get` - Get current playback state
  - `playback.control.set` - Control playback (play/pause/next/previous)

- **Playlist Management Tools**
  - `playlists.list.mine` - List user's playlists with pagination
  - `playlists.tracks.get` - Get playlist tracks with pagination
  - `playlists.create` - Create new playlist
  - `playlists.tracks.add` - Add tracks with deduplication support

- **Library Management Tools**
  - `library.saved.tracks.get` - Get saved tracks
  - `library.saved.tracks.save` - Save tracks to library
  - `library.saved.tracks.remove` - Remove tracks from library
  - `library.saved.tracks.check` - Check if tracks are saved
  - `library.saved.albums.get` - Get saved albums
  - `library.saved.albums.save` - Save albums to library
  - `library.saved.albums.remove` - Remove albums from library
  - `library.saved.albums.check` - Check if albums are saved

- **Queue Management Tools**
  - `queue.add` - Add track to playback queue

- **Core Infrastructure**
  - Hexagonal architecture with pure domain services
  - Type-safe Zod validation on all boundaries
  - Structured logging with request correlation
  - Exponential backoff retry logic for API failures
  - Secure token storage with automatic refresh
  - Comprehensive error handling and sanitization

- **Development & Quality**
  - Full TypeScript strict mode
  - ESLint and Prettier configuration
  - Vitest testing framework
  - 90%+ test coverage on core logic
  - Functional parity tests against legacy server
  - Performance and resilience testing
  - Docker containerization

### Security
- HTTPS-only OAuth flows
- Token redaction in all logs
- Minimal OAuth scopes
- Secure file permissions for token storage
- Input validation on all tool parameters

## [0.1.0-alpha.1] - 2024-01-10

### Added
- Project scaffold with pnpm workspace
- Basic package structure following hexagonal architecture
- Platform utilities (config, logging, HTTP client)
- OAuth authentication with PKCE flow
- Initial Spotify Web API client
- Core domain services foundation

### Changed
- Migrated from original spotify-mcp-server codebase
- Adopted TypeScript strict mode
- Implemented ports & adapters pattern

### Removed
- Legacy implementation dependencies
- Insecure authentication methods
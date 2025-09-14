# Contributing to Spotify MCP

Thank you for your interest in contributing to the Spotify MCP server! This guide will help you get started with development and ensure your contributions meet our quality standards.

## 🚀 Quick Start for Contributors

### 1. Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/spotify-mcp.git
cd spotify-mcp

# Install dependencies
pnpm install

# Set up OAuth for testing
pnpm oauth

# Run tests to ensure everything works
pnpm test
```

### 2. Development Workflow

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... edit code ...

# Run quality checks
pnpm ci

# Commit your changes
git commit -m "feat: add awesome feature"

# Push and create PR
git push origin feature/your-feature-name
```

## 📋 Contribution Guidelines

### Code Style & Standards

#### TypeScript Best Practices
- Use **strict TypeScript** - no `any` types allowed
- All functions must have explicit return types
- Use Zod schemas for all external data validation
- Prefer `interface` over `type` for object definitions

```typescript
// ✅ Good
interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
}

async function searchTracks(options: SearchOptions): Promise<Track[]> {
  // Implementation
}

// ❌ Bad
function searchTracks(options: any): any {
  // Implementation
}
```

#### Architecture Constraints

**Domain Layer** (`packages/core/`)
- ✅ Pure functions only
- ✅ No I/O dependencies
- ❌ No `fetch`, file system, or database calls
- ❌ No logging (pass logger as parameter)

**Adapter Layer** (`packages/spotify/`, `packages/auth/`, `packages/platform/`)
- ✅ Handle all external integrations
- ✅ Map external data to domain types
- ✅ Implement retry/error handling

**Application Layer** (`packages/mcp/`)
- ✅ Orchestrate domain + adapters
- ✅ Input/output validation
- ❌ No business logic (delegate to domain)

### Testing Requirements

#### Unit Tests (Required for all PRs)
```bash
# Run unit tests
pnpm test:unit

# Run with coverage
pnpm test:unit --coverage
```

**Coverage Requirements:**
- **Domain logic**: 100% line coverage
- **Adapters**: 90%+ line coverage
- **MCP handlers**: 95%+ line coverage

#### Integration Tests
```bash
# Run integration tests
pnpm test:integration

# End-to-end tests
pnpm test:e2e
```

#### Parity Tests (Critical)
```bash
# Ensure functional parity with legacy server
pnpm parity
```

**Parity Requirements:**
- All existing tools must continue to work
- Same input/output behavior
- No regressions in error handling

### Security Guidelines

#### Secrets & Credentials
- **Never commit** API keys, tokens, or secrets
- Use `config.local.json` for sensitive data (gitignored)
- Ensure token redaction in logs

```typescript
// ✅ Good - tokens are automatically redacted
logger.info('OAuth token received', { tokenType: 'access' });

// ❌ Bad - exposes actual token
logger.info('OAuth token', { accessToken: token });
```

#### Input Validation
- Validate all inputs with Zod schemas
- Sanitize error messages (no internal details)
- Use parameterized queries if adding database features

### Documentation

#### Code Documentation
- Document all public APIs with JSDoc
- Include usage examples for complex functions
- Explain business logic decisions

```typescript
/**
 * Deduplicates track URIs from a playlist to prevent duplicate additions
 *
 * @param existingTracks - Current tracks in the playlist
 * @param newTracks - Tracks to be added
 * @returns Tracks that don't already exist in the playlist
 *
 * @example
 * ```typescript
 * const unique = deduplicateTracks(existing, ['spotify:track:123']);
 * ```
 */
async function deduplicateTracks(
  existingTracks: Track[],
  newTracks: string[]
): Promise<string[]> {
  // Implementation
}
```

#### Schema Documentation
- Update tool schemas for any API changes
- Include examples in schema descriptions
- Document error conditions

## 🏗️ Architecture Deep Dive

### Adding New Tools

1. **Define Domain Logic** (`packages/core/src/services/`)
```typescript
// Pure function - no I/O
export function planPlaylistCreation(
  name: string,
  options: CreatePlaylistOptions
): PlaylistCreationPlan {
  // Business logic here
}
```

2. **Create MCP Schema** (`packages/mcp/src/schemas/`)
```typescript
export const CreatePlaylistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  public: z.boolean().default(false),
});
```

3. **Implement MCP Handler** (`packages/mcp/src/handlers/`)
```typescript
export async function createPlaylistHandler(
  input: unknown,
  context: MCPContext
): Promise<PlaylistResult> {
  const args = CreatePlaylistSchema.parse(input);
  const plan = planPlaylistCreation(args.name, args);
  return await context.spotify.createPlaylist(plan);
}
```

4. **Register Tool** (`packages/mcp/src/registry.ts`)
```typescript
tools.push({
  name: 'playlists.create',
  description: 'Create a new playlist',
  inputSchema: CreatePlaylistSchema,
  handler: createPlaylistHandler,
});
```

### Error Handling Patterns

#### Domain Errors
```typescript
// Domain layer - structured errors
export class PlaylistValidationError extends Error {
  constructor(
    message: string,
    public readonly violations: string[]
  ) {
    super(message);
    this.name = 'PlaylistValidationError';
  }
}
```

#### Adapter Error Mapping
```typescript
// Adapter layer - map HTTP errors to domain errors
function mapSpotifyError(error: SpotifyHttpError): DomainError {
  switch (error.status) {
    case 401:
      return new AuthenticationError('Spotify token expired');
    case 403:
      return new AuthorizationError('Insufficient permissions');
    case 429:
      return new RateLimitError('Rate limit exceeded');
    default:
      return new ServiceError('Spotify API error');
  }
}
```

## 🧪 Testing Strategy

### Test Structure
```
packages/*/test/
├── unit/           # Pure function tests
├── integration/    # Cross-layer tests
└── fixtures/       # Test data
```

### Writing Good Tests

#### Unit Tests
```typescript
describe('deduplicateTracks', () => {
  it('should remove duplicate URIs', () => {
    const existing = [{ uri: 'spotify:track:123' }];
    const newTracks = ['spotify:track:123', 'spotify:track:456'];

    const result = deduplicateTracks(existing, newTracks);

    expect(result).toEqual(['spotify:track:456']);
  });
});
```

#### Integration Tests
```typescript
describe('playlists.create integration', () => {
  it('should create playlist via MCP protocol', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'playlists.create',
        arguments: { name: 'Test Playlist' }
      }
    };

    const response = await mcpServer.handle(request);

    expect(response.result.content[0].text).toContain('playlist created');
  });
});
```

## 📦 Release Process

### Version Bumps
- **Patch** (`0.1.1`): Bug fixes, security updates
- **Minor** (`0.2.0`): New tools, non-breaking features
- **Major** (`1.0.0`): Breaking changes to tool APIs

### Pre-Release Checklist
- [ ] All tests pass (`pnpm ci`)
- [ ] Parity tests pass (`pnpm parity`)
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Security review completed

### Release Commands
```bash
# Update version and create git tag
npm version patch|minor|major

# Push with tags (GitHub Actions handles release)
git push --follow-tags
```

## 🐛 Bug Reports

### Security Issues
For security vulnerabilities, email: `security@spotify-mcp.com`
**Do not** open public GitHub issues for security problems.

### Regular Bug Reports
Include this information:
1. **Environment**: Node.js version, OS, pnpm version
2. **Configuration**: Redacted config file
3. **Steps to Reproduce**: Exact commands/requests
4. **Expected vs Actual**: What should happen vs what happened
5. **Logs**: Relevant log output (with tokens redacted)

### Bug Report Template
```markdown
**Environment**
- Node.js: 18.17.0
- OS: macOS 13.4
- pnpm: 8.6.0

**Configuration**
```json
{
  "spotify": { "clientId": "xxx" },
  "logging": { "level": "debug" }
}
```

**Steps to Reproduce**
1. Run `pnpm cli tracks search "test"`
2. Server returns 500 error

**Expected Behavior**
Should return track search results

**Actual Behavior**
Internal server error with no results

**Logs**
```json
{"level":"error","message":"Failed to search tracks","error":"..."}
```
```

## 🎯 Feature Requests

### Before Submitting
1. Check if feature already exists
2. Review architecture - does it fit our hexagonal design?
3. Consider security implications
4. Estimate effort and value

### Feature Request Template
```markdown
**Problem Statement**
As a [user type], I want [goal] so that [benefit].

**Proposed Solution**
Describe your solution approach.

**Alternatives Considered**
What other solutions did you consider?

**Implementation Notes**
- Domain changes needed
- New adapters required
- Breaking changes (if any)
```

## 🏆 Recognition

Contributors are recognized in:
- GitHub contributors graph
- CHANGELOG.md release notes
- README.md contributors section (for significant contributions)

### Contribution Types
- 🐛 **Bug fixes**
- ✨ **New features**
- 📚 **Documentation**
- 🧪 **Tests**
- 🔧 **Tooling/CI**
- 🎨 **Code quality**

## ❓ Getting Help

### Community Channels
- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and feature requests
- **Pull Request Reviews**: Code-specific discussions

### Code Review Process
1. **Automated Checks**: All tests and linting must pass
2. **Architecture Review**: Ensure hexagonal design compliance
3. **Security Review**: Check for security implications
4. **Parity Check**: Verify no functionality regressions
5. **Documentation Review**: Ensure docs are updated

### Review Expectations
- **Response Time**: Within 2-3 business days
- **Feedback Style**: Constructive and specific
- **Approval**: 2+ approvals required for non-trivial changes

---

## 🎵 Welcome to the Team!

Thank you for contributing to Spotify MCP! Your contributions help make music automation more accessible and powerful for developers worldwide.

**Happy coding!** 🎶
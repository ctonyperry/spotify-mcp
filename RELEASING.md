# Release Process

This document describes the process for creating and publishing releases of the Spotify MCP Server.

## Overview

We follow [Semantic Versioning](https://semver.org/) and use automated CI/CD for releases. All releases are tagged and published through GitHub Actions.

## Version Bumping Strategy

### PATCH (x.y.Z)
- Bug fixes
- Security patches
- Documentation updates
- Performance optimizations (no API changes)

### MINOR (x.Y.0)
- New MCP tools
- New features (backward compatible)
- Additional configuration options
- New optional parameters

### MAJOR (X.0.0)
- Breaking changes to tool APIs
- Removal of tools
- Changes to configuration schema
- Node.js version requirements changes

## Pre-Release Checklist

Before creating a release, ensure:

- [ ] All tests pass locally: `pnpm ci`
- [ ] Functional parity tests pass: `pnpm parity`
- [ ] Documentation is up to date
- [ ] CHANGELOG.md has entries for the new version
- [ ] No security vulnerabilities: `pnpm audit`
- [ ] Docker build succeeds: `docker build -t spotify-mcp .`

## Release Process

### 1. Prepare the Release

```bash
# Ensure you're on the main branch and up to date
git checkout main
git pull origin main

# Run full test suite
pnpm ci

# Verify parity with legacy server
pnpm parity

# Update dependencies if needed
pnpm update

# Run tests again after updates
pnpm ci
```

### 2. Update Version and Changelog

```bash
# For patch release
npm version patch

# For minor release
npm version minor

# For major release
npm version major
```

This will:
- Bump version in `package.json` and all workspace packages
- Create a git commit with the version bump
- Create a git tag

### 3. Update Changelog

Edit `CHANGELOG.md`:
- Move items from `[Unreleased]` to the new version section
- Add release date
- Create a new empty `[Unreleased]` section

```bash
# Commit changelog updates
git add CHANGELOG.md
git commit -m "docs: update changelog for v$(node -p "require('./package.json').version")"
```

### 4. Push Release

```bash
# Push commits and tags
git push origin main --follow-tags
```

### 5. Create GitHub Release

The CI pipeline will automatically:
- Build and test the release
- Run parity tests
- Create Docker images
- Generate release artifacts

Manually create the GitHub release:
1. Go to GitHub Releases page
2. Click "Create a new release"
3. Select the version tag
4. Use changelog content for release notes
5. Attach any additional artifacts

## NPM Package Publishing

This project publishes two main NPM packages:

### @spotify-mcp/core
Pure domain logic package for embedding in other applications:

```bash
# Publish core package
pnpm publish:core

# Or manually
pnpm --filter=@spotify-mcp/core publish
```

### @spotify-mcp/mcp
MCP protocol integration for existing MCP servers:

```bash
# Publish MCP package
pnpm publish:mcp

# Or manually
pnpm --filter=@spotify-mcp/mcp publish
```

### Publishing All Packages

```bash
# Publish both packages at once
pnpm publish:all
```

**Usage by consumers:**

```typescript
// Install core package
import { searchTracks, createPlaylist } from '@spotify-mcp/core';

// Install MCP package
import { createMCPRegistry } from '@spotify-mcp/mcp';
```

## Release Artifacts

Each release includes:
- **Source code** (tar.gz and zip)
- **Docker image** pushed to registry
- **NPM packages** published to registry
- **Parity test report** showing compatibility
- **Performance benchmarks** from CI runs

## Hotfix Process

For critical security or bug fixes:

1. Create hotfix branch from the release tag:
   ```bash
   git checkout -b hotfix/v1.2.1 v1.2.0
   ```

2. Apply the fix and test thoroughly
3. Update version (patch only): `npm version patch`
4. Update changelog with hotfix details
5. Push and create pull request to main
6. After merge, follow normal release process

## Post-Release

After a successful release:

1. **Update documentation** if needed
2. **Notify users** through appropriate channels
3. **Monitor** for issues in the first 24 hours
4. **Update examples** if new features were added

## Release Branch Strategy

- **main**: Production-ready code, all releases cut from here
- **develop**: Integration branch for new features (if used)
- **feature/***: Feature development branches
- **hotfix/***: Emergency fixes for production issues

## Versioning Examples

```
1.0.0 -> 1.0.1  (bug fix)
1.0.1 -> 1.1.0  (new tool added)
1.1.0 -> 2.0.0  (tool API changed)
```

## Rollback Process

If a release has critical issues:

1. **Immediate**: Communicate issue to users
2. **Assess**: Determine if hotfix or rollback is needed
3. **Rollback**: Revert to previous release if necessary
4. **Fix**: Address the issue properly
5. **Re-release**: Follow normal release process

## Security Releases

Security releases follow a special process:

1. **Coordinate** with security team
2. **Minimal disclosure** until fix is available
3. **Expedited testing** and review
4. **Immediate release** once fix is validated
5. **Security advisory** published with release

## Quality Gates

All releases must pass:
- ✅ Lint and format checks
- ✅ TypeScript compilation
- ✅ Unit tests (90%+ coverage)
- ✅ Integration tests
- ✅ End-to-end tests
- ✅ Functional parity tests
- ✅ Security audit
- ✅ Docker build
- ✅ Performance benchmarks

## Contact

For questions about the release process:
- Create an issue in the repository
- Contact the maintainer team
- Check the troubleshooting guide

## Automation

The release process is partially automated through GitHub Actions:
- **CI**: Runs on all PRs and pushes
- **Release**: Triggered by version tags
- **Security**: Daily security scans
- **Dependencies**: Weekly dependency updates

---

**Note**: This process may evolve as the project grows. Always check this document for the latest procedures.
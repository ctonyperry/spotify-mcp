# @spotify-mcp/auth

HTTPS OAuth 2.0 authentication for Spotify with PKCE support, secure token storage, and automatic refresh handling.

## Features

- ✅ **HTTPS-only OAuth 2.0** with Authorization Code + PKCE flow
- 🔐 **Secure token storage** with restricted file permissions
- 🔄 **Automatic token refresh** with single-flight protection
- 🌐 **Interactive browser authentication** with local callback server
- 📱 **PKCE support** for enhanced security (RFC 7636)
- 🛡️ **Type-safe configuration** with Zod validation
- 📊 **Structured logging** with request correlation

## Quick Start

```typescript
import { SpotifyAuthClient, FileTokenStore } from '@spotify-mcp/auth';
import { createLogger } from '@spotify-mcp/platform';

// Create auth client
const logger = createLogger('info');
const tokenStore = new FileTokenStore('.secrets/tokens.json');
const authClient = new SpotifyAuthClient(
  {
    clientId: 'your-spotify-client-id',
    clientSecret: 'your-spotify-client-secret', // Optional for PKCE
    redirectUri: 'https://localhost:8443/callback',
    scopes: 'user-read-private user-modify-playback-state',
    tlsKeyPath: './localhost.key',
    tlsCertPath: './localhost.crt',
  },
  tokenStore,
  logger
);

// Interactive OAuth setup (opens browser)
await authClient.authorizeInteractive();

// Get access token (auto-refreshes if needed)
const accessToken = await authClient.getAccessToken();
```

## OAuth Flow

The authentication flow follows OAuth 2.0 Authorization Code with PKCE:

1. **Generate PKCE challenge** - Creates cryptographically secure code verifier and challenge
2. **Start HTTPS callback server** - Listens for the authorization callback
3. **Open browser** - Redirects user to Spotify's authorization page
4. **Handle callback** - Receives authorization code and exchanges for tokens
5. **Store tokens securely** - Saves tokens with restricted file permissions
6. **Auto-refresh** - Automatically refreshes expired tokens

## Configuration

### Required Configuration

```typescript
interface AuthConfig {
  clientId: string;              // Spotify app client ID
  redirectUri: string;           // Must use HTTPS (e.g., https://localhost:8443/callback)
  scopes: string;               // Space-separated OAuth scopes
  tlsKeyPath: string;           // Path to TLS private key
  tlsCertPath: string;          // Path to TLS certificate
  
  // Optional for PKCE-only flow
  clientSecret?: string;        // Spotify app client secret
}
```

### Environment Variables

You can also configure via environment variables:

```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret  # Optional
SPOTIFY_REDIRECT_URI=https://localhost:8443/callback
SCOPES="user-read-private user-modify-playbook-state"
TLS_KEY_PATH=./localhost.key
TLS_CERT_PATH=./localhost.crt
TOKEN_STORE_PATH=.secrets/tokens.json
```

## Token Storage

Tokens are stored securely using the `FileTokenStore`:

```typescript
interface TokenData {
  accessToken: string;
  refreshToken: string;
  scope: string;
  tokenType: string;
  expiresAtEpochMs: number;
}
```

### Security Features

- **Restricted permissions**: Files are created with 0600 permissions (read/write owner only)
- **Schema validation**: All token data is validated with Zod
- **No secrets in logs**: Sensitive fields are automatically masked
- **Atomic operations**: File operations are atomic to prevent corruption

## PKCE Support

PKCE (Proof Key for Code Exchange) provides enhanced security for OAuth flows:

```typescript
import { generatePkceChallenge, verifyPkceChallenge } from '@spotify-mcp/auth';

// Generate challenge
const pkce = generatePkceChallenge();
console.log(pkce.codeVerifier);     // Random 43-128 character string
console.log(pkce.codeChallenge);    // SHA256 hash of verifier (base64url)
console.log(pkce.codeChallengeMethod); // "S256"

// Verify challenge (used internally)
const isValid = verifyPkceChallenge(pkce.codeVerifier, pkce.codeChallenge);
```

## Error Handling

The package provides typed errors for different failure scenarios:

```typescript
import { AuthError } from '@spotify-mcp/platform';

try {
  await authClient.getAccessToken();
} catch (error) {
  if (error instanceof AuthError) {
    switch (error.code) {
      case 'NO_TOKENS':
        console.log('Run authorization flow first');
        break;
      case 'REFRESH_FAILED':
        console.log('Token refresh failed, re-authorization needed');
        break;
      case 'CALLBACK_TIMEOUT':
        console.log('OAuth callback timed out');
        break;
    }
  }
}
```

## Advanced Usage

### Custom Token Store

Implement the `TokenStore` interface for custom storage:

```typescript
import { TokenStore, TokenData } from '@spotify-mcp/auth';

class CustomTokenStore implements TokenStore {
  async load(): Promise<TokenData | null> {
    // Your implementation
  }
  
  async save(tokens: TokenData): Promise<void> {
    // Your implementation
  }
  
  async clear(): Promise<void> {
    // Your implementation
  }
}
```

### Single-Flight Refresh

The auth client ensures only one token refresh happens at a time:

```typescript
// Multiple concurrent calls will wait for the same refresh
const promises = [
  authClient.getAccessToken(),
  authClient.getAccessToken(),
  authClient.getAccessToken(),
];

const tokens = await Promise.all(promises);
// All tokens are identical, only one HTTP request was made
```

## Development Setup

1. **Generate self-signed certificates:**
   ```bash
   pnpm dev:cert
   ```

2. **Set up Spotify app:**
   - Create app at https://developer.spotify.com/dashboard
   - Add `https://localhost:8443/callback` to redirect URIs

3. **Run OAuth flow:**
   ```bash
   pnpm oauth
   ```

## Testing

The package includes comprehensive tests:

```bash
# Run all auth tests
pnpm test

# Run with coverage
pnpm test --coverage
```

Test coverage includes:
- PKCE challenge generation and verification
- Token storage and validation
- OAuth client core logic
- Error handling scenarios
- File permission checks (Unix only)

## Security Considerations

- **HTTPS required**: All OAuth flows must use HTTPS
- **Token storage**: Uses restrictive file permissions (0600)
- **No logging of secrets**: Sensitive data is automatically masked
- **PKCE enforcement**: Code challenges prevent authorization code interception
- **Short-lived tokens**: Access tokens expire and are automatically refreshed
- **Minimal scopes**: Request only the OAuth scopes you need

## Architecture

This package follows the hexagonal architecture pattern:

- **Domain**: Pure OAuth logic and PKCE calculations
- **Storage Adapter**: File-based token persistence
- **HTTP Adapter**: HTTPS server for OAuth callbacks
- **Platform Integration**: Logging, configuration, and error handling

The design ensures the core OAuth logic is testable and the adapters can be easily replaced.
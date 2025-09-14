# 🚀 5-Minute Quickstart Guide

Get your Spotify MCP server up and running in 5 minutes! This guide covers the essential steps to authenticate, start the server, and make your first API call.

## ⏱️ Prerequisites (1 minute)

1. **Node.js** >= 18.0.0 installed
2. **pnpm** >= 8.0.0 installed
3. **Spotify Developer Account**: Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

## 📋 Step-by-Step Setup

### 1. Create Spotify App (1 minute)

1. Visit [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **"Create App"**
3. Fill in app details:
   - **App Name**: `My MCP Server`
   - **App Description**: `Local MCP server for testing`
   - **Website**: `http://localhost`
   - **Redirect URI**: `https://localhost:8888/callback`
4. Click **"Save"**
5. Copy your **Client ID** (you'll need this)

> 💡 **Important**: Make sure the redirect URI is exactly `https://localhost:8888/callback`

### 2. Install & Setup (2 minutes)

```bash
# Clone and install
git clone https://github.com/your-org/spotify-mcp.git
cd spotify-mcp
pnpm install

# Generate HTTPS certificates for OAuth
pnpm dev:cert

# Interactive OAuth setup
pnpm oauth
```

The OAuth setup will prompt you for:
- **Client ID**: From your Spotify app
- **Client Secret**: From your Spotify app (click "Show Client Secret")

It will then:
1. Open your browser to Spotify's authorization page
2. Ask you to log in and grant permissions
3. Save tokens securely to `.secrets/tokens.json`

### 3. Test the Server (1 minute)

```bash
# Start the development server
pnpm dev
```

In another terminal, test with the demo CLI:

```bash
# Search for tracks
pnpm cli tracks search "bohemian rhapsody" --limit 3

# List your playlists
pnpm cli playlists list --limit 5

# Check current playback (Premium required)
pnpm cli playback state
```

### 4. Test MCP Protocol (1 minute)

Test with raw MCP protocol:

```bash
# List available tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | pnpm dev

# Search for tracks
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"tracks.search","arguments":{"query":"sandstorm","limit":2}}}' | pnpm dev
```

## ✅ Success Indicators

You'll know everything is working when:

1. **OAuth**: Browser opens and you successfully grant permissions
2. **Server**: Logs show `"Spotify MCP server started successfully"`
3. **CLI**: Commands return actual Spotify data (not errors)
4. **MCP**: Raw JSON calls return structured tool responses

## 🔧 Common Issues & Quick Fixes

### OAuth Fails
```bash
# Regenerate certificates
pnpm dev:cert

# Try OAuth again
pnpm oauth
```

### "No active device" Error
- Open Spotify on your phone or computer
- Start playing any song
- Try the playback commands again

### Rate Limiting
- Wait a few seconds between requests
- The server automatically retries with backoff

### Permission Errors
Make sure your Spotify app has these redirect URIs:
- `https://localhost:8888/callback`

## 🎯 Next Steps

Now that you're set up:

1. **Explore Tools**: Check out the [full tool catalog](../README.md#-tool-catalog)
2. **Build Integration**: Connect to your AI assistant or application
3. **Customize Config**: Modify `config.local.json` for your needs
4. **Development**: Read [CONTRIBUTING.md](../CONTRIBUTING.md) to contribute

## 🔍 Example Commands to Try

```bash
# Music Discovery
pnpm cli tracks search "new music friday" --limit 10
pnpm cli artists search "taylor swift" --limit 3

# Playlist Management
pnpm cli playlists create "My Test Playlist" --description "Created via MCP"

# Library Operations
pnpm cli library tracks --limit 20
pnpm cli library save-track "4u7EnebtmKWzUH433cf5Qv"  # Bohemian Rhapsody

# Queue Management (Premium)
pnpm cli queue add "spotify:track:4u7EnebtmKWzUH433cf5Qv"

# Dry Run Mode (safe testing)
pnpm cli playlists add <playlist-id> --uris "spotify:track:123" --dry-run
```

## 📚 Configuration Reference

Your `config.local.json` should look like this:

```json
{
  "spotify": {
    "clientId": "your_client_id",
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
  }
}
```

## 🎵 You're Ready!

Your Spotify MCP server is now running and ready to integrate with AI assistants, automation tools, or your custom applications. The server provides 15+ tools for comprehensive Spotify control.

For detailed documentation, see the [main README](../README.md) and [architecture docs](architecture.md).

---

⏰ **Total Time**: ~5 minutes | 🎯 **Result**: Fully functional Spotify MCP server
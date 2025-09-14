# Demo CLI Examples

This file contains example CLI commands and their expected outputs to demonstrate the Spotify MCP server functionality.

## Setup

```bash
# Install dependencies
pnpm install

# Run OAuth setup
pnpm oauth

# Start the server (in another terminal)
pnpm dev
```

## Basic Commands

### Search for Tracks

```bash
$ pnpm cli tracks search "bohemian rhapsody" --limit 3
```

**Expected Output:**
```
┌──────────┬─────────────────────┬─────────────────┬──────────────┐
│ NAME     │ ARTISTS             │ URI             │ DURATION_MS  │
├──────────┼─────────────────────┼─────────────────┼──────────────┤
│ Bohemian │ Queen               │ spotify:track:4 │ 355000       │
│ Rhapsody │                     │ u7EnebtmKWzUH4  │              │
├──────────┼─────────────────────┼─────────────────┼──────────────┤
│ Bohemian │ Queen               │ spotify:track:7 │ 355000       │
│ Rhapsody │                     │ tFiyTwD0nx5a1e  │              │
└──────────┴─────────────────────┴─────────────────┴──────────────┘
```

### List User Playlists

```bash
$ pnpm cli playlists list --limit 5
```

**Expected Output:**
```
┌──────────────────────┬─────────────────────┬──────┬───────────┐
│ NAME                 │ ID                  │ PUBL │ TRACK_CNT │
├──────────────────────┼─────────────────────┼──────┼───────────┤
│ My Awesome Playlist  │ 37i9dQZF1DX0XUsux   │ fals │ 45        │
├──────────────────────┼─────────────────────┼──────┼───────────┤
│ Workout Mix          │ 5FVd6KXrgO9B3JPmh   │ true │ 23        │
├──────────────────────┼─────────────────────┼──────┼───────────┤
│ Chill Vibes          │ 1A2B3C4D5E6F7G8H9   │ fals │ 67        │
└──────────────────────┴─────────────────────┴──────┴───────────┘
```

### Check Playback State

```bash
$ pnpm cli playback state
```

**Expected Output (if music is playing):**
```
is_playing: true
track_name: Bohemian Rhapsody
artist_name: Queen
album_name: A Night at the Opera
progress_ms: 125000
duration_ms: 355000
device_name: iPhone
volume_percent: 75
```

**Expected Output (if nothing is playing):**
```
is_playing: false
device_name: iPhone
volume_percent: 75
message: No track currently playing
```

## Advanced Commands

### Dry Run Playlist Operations

```bash
$ pnpm cli playlists add 37i9dQZF1DX0XUsux --uris "spotify:track:4u7EnebtmKWzUH433cf5Qv" --dry-run
```

**Expected Output:**
```
🔍 DRY RUN - Would execute:
Would add 1 tracks to playlist: 37i9dQZF1DX0XUsux
Track URIs: spotify:track:4u7EnebtmKWzUH433cf5Qv
✅ Would add tracks to playlist
```

### JSON Output

```bash
$ pnpm cli tracks search "sandstorm" --json --limit 2
```

**Expected Output:**
```json
{
  "items": [
    {
      "uri": "spotify:track:6y0igZArWVi6Iz0rj35c1Y",
      "id": "6y0igZArWVi6Iz0rj35c1Y",
      "name": "Sandstorm",
      "artists": ["Darude"],
      "album": "Before the Storm",
      "durationMs": 236000,
      "explicit": false,
      "popularity": 78
    },
    {
      "uri": "spotify:track:2WfaOiMkCvy7F5fcp2zZ8L",
      "id": "2WfaOiMkCvy7F5fcp2zZ8L",
      "name": "Sandstorm (Radio Edit)",
      "artists": ["Darude"],
      "album": "Sandstorm",
      "durationMs": 215000,
      "explicit": false,
      "popularity": 65
    }
  ],
  "total": 1000,
  "limit": 2,
  "offset": 0,
  "hasMore": true
}
```

### Playback Control

```bash
$ pnpm cli playback control pause
```

**Expected Output:**
```
✅ Playback pause command sent
```

```bash
$ pnpm cli playback control play
```

**Expected Output:**
```
✅ Playback play command sent
```

### Queue Management

```bash
$ pnpm cli queue add "spotify:track:4u7EnebtmKWzUH433cf5Qv"
```

**Expected Output:**
```
✅ Added track to queue: spotify:track:4u7EnebtmKWzUH433cf5Qv
```

### Library Operations

```bash
$ pnpm cli library tracks --limit 5
```

**Expected Output:**
```
┌─────────────────────┬─────────────────┬─────────────────────┬──────────────┐
│ NAME                │ ARTISTS         │ ALBUM               │ ADDED_AT     │
├─────────────────────┼─────────────────┼─────────────────────┼──────────────┤
│ Bohemian Rhapsody   │ Queen           │ A Night at the Oper │ 2024-01-15   │
├─────────────────────┼─────────────────┼─────────────────────┼──────────────┤
│ Stairway to Heaven  │ Led Zeppelin    │ Led Zeppelin IV     │ 2024-01-14   │
├─────────────────────┼─────────────────┼─────────────────────┼──────────────┤
│ Hotel California    │ Eagles          │ Hotel California    │ 2024-01-13   │
└─────────────────────┴─────────────────┴─────────────────────┴──────────────┘
```

### Save Track to Library

```bash
$ pnpm cli library save-track "4u7EnebtmKWzUH433cf5Qv"
```

**Expected Output:**
```
✅ Saved track to library: 4u7EnebtmKWzUH433cf5Qv
{
  "success": true,
  "trackId": "4u7EnebtmKWzUH433cf5Qv",
  "message": "Track saved successfully"
}
```

### Check if Track is Saved

```bash
$ pnpm cli library check-track "4u7EnebtmKWzUH433cf5Qv"
```

**Expected Output:**
```
Track 4u7EnebtmKWzUH433cf5Qv is saved in library
trackId: 4u7EnebtmKWzUH433cf5Qv
saved: true
```

## Error Scenarios

### No Active Device

```bash
$ pnpm cli playback control play
```

**Expected Output:**
```
❌ Failed to play playback
   No active device found. Please start Spotify on a device first.
```

### Invalid Track URI

```bash
$ pnpm cli queue add "invalid-uri"
```

**Expected Output:**
```
❌ Failed to add track to queue
   Track URI must be in format "spotify:track:ID" or just the track ID
```

### Authentication Required

```bash
$ pnpm cli tracks search "test"
```

**Expected Output (if not authenticated):**
```
❌ Failed to initialize Spotify MCP:
   Authentication required. Run 'pnpm oauth' to authenticate.
```

### Rate Limiting

```bash
$ pnpm cli tracks search "test"
```

**Expected Output (if rate limited):**
```
⚠️  Rate limited by Spotify API. Retrying in 5 seconds...
✅ Search completed successfully after retry
[results...]
```

## Performance Examples

### Timing Information

All commands show execution timing in debug mode:

```bash
$ SPOTIFY_MCP_LOG_LEVEL=debug pnpm cli tracks search "bohemian rhapsody"
```

**Expected Debug Output:**
```json
{"level":"debug","ts":"2024-01-15T10:30:00.000Z","component":"spotify-client","message":"HTTP request completed","method":"GET","url":"https://api.spotify.com/v1/search","status":200,"durationMs":245}
{"level":"info","ts":"2024-01-15T10:30:00.245Z","component":"mcp-tools","toolName":"tracks.search","message":"Tool invocation completed","durationMs":267}
[table output...]
```

## Comparison: CLI vs Raw MCP

### CLI Command
```bash
pnpm cli tracks search "bohemian rhapsody" --limit 3
```

### Equivalent Raw MCP Request
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tracks.search","arguments":{"query":"bohemian rhapsody","limit":3}}}' | pnpm dev
```

The CLI provides a much more user-friendly interface while using the same underlying MCP tools.

## Usage in Scripts

The CLI can be used in shell scripts and automation:

```bash
#!/bin/bash

# Search for a track and save the first result
TRACK_ID=$(pnpm cli tracks search "$1" --json --limit 1 | jq -r '.items[0].id')

if [ "$TRACK_ID" != "null" ]; then
    echo "Saving track: $TRACK_ID"
    pnpm cli library save-track "$TRACK_ID"
else
    echo "No tracks found for: $1"
fi
```

This demonstrates how the CLI can be integrated into larger automation workflows.
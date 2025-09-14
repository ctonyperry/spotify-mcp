/**
 * MCP Tool Registry - Register all tools with schemas and handlers
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '@spotify-mcp/platform';
import { SpotifyClient } from '@spotify-mcp/spotify';
import { withMCPContext } from './context.js';

// Import schemas
import {
  TracksSearchInputSchema,
  TracksSearchOutputSchema,
  AlbumsSearchInputSchema,
  AlbumsSearchOutputSchema,
  ArtistsSearchInputSchema,
  ArtistsSearchOutputSchema,
} from './schemas/search.js';
import {
  PlaybackStateInputSchema,
  PlaybackStateOutputSchema,
  PlaybackControlInputSchema,
  PlaybackControlOutputSchema,
} from './schemas/playback.js';
import {
  PlaylistsListInputSchema,
  PlaylistsListOutputSchema,
  PlaylistTracksGetInputSchema,
  PlaylistTracksGetOutputSchema,
  PlaylistsCreateInputSchema,
  PlaylistsCreateOutputSchema,
  PlaylistTracksAddInputSchema,
  PlaylistTracksAddOutputSchema,
} from './schemas/playlists.js';
import {
  LibrarySavedTracksGetInputSchema,
  LibrarySavedTracksGetOutputSchema,
  LibrarySavedTracksSaveInputSchema,
  LibrarySavedTracksSaveOutputSchema,
  LibrarySavedTracksRemoveInputSchema,
  LibrarySavedTracksRemoveOutputSchema,
  LibrarySavedTracksCheckInputSchema,
  LibrarySavedTracksCheckOutputSchema,
  LibrarySavedAlbumsGetInputSchema,
  LibrarySavedAlbumsGetOutputSchema,
  LibrarySavedAlbumsSaveInputSchema,
  LibrarySavedAlbumsSaveOutputSchema,
  LibrarySavedAlbumsRemoveInputSchema,
  LibrarySavedAlbumsRemoveOutputSchema,
  LibrarySavedAlbumsCheckInputSchema,
  LibrarySavedAlbumsCheckOutputSchema,
} from './schemas/library.js';
import {
  QueueAddInputSchema,
  QueueAddOutputSchema,
} from './schemas/queue.js';

// Import handlers
import {
  tracksSearchHandler,
  albumsSearchHandler,
  artistsSearchHandler,
  SearchHandlerDeps,
} from './handlers/search.js';
import {
  playbackStateGetHandler,
  playbackControlSetHandler,
  PlaybackHandlerDeps,
} from './handlers/playback.js';
import {
  playlistsListMineHandler,
  playlistTracksGetHandler,
  playlistsCreateHandler,
  playlistTracksAddHandler,
  PlaylistHandlerDeps,
} from './handlers/playlists.js';
import {
  librarySavedTracksGetHandler,
  librarySavedTracksSaveHandler,
  librarySavedTracksRemoveHandler,
  librarySavedTracksCheckHandler,
  librarySavedAlbumsGetHandler,
  librarySavedAlbumsSaveHandler,
  librarySavedAlbumsRemoveHandler,
  librarySavedAlbumsCheckHandler,
  LibraryHandlerDeps,
} from './handlers/library.js';
import {
  queueAddHandler,
  QueueHandlerDeps,
} from './handlers/queue.js';

export interface MCPRegistryDeps {
  spotify: SpotifyClient;
  logger: Logger;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: unknown) => Promise<unknown>;
}

/**
 * Create MCP tool registry with all Spotify tools
 */
export function createMCPRegistry(deps: MCPRegistryDeps): MCPTool[] {
  const { spotify, logger } = deps;

  const searchDeps: SearchHandlerDeps = { spotify };
  const playbackDeps: PlaybackHandlerDeps = { spotify };
  const playlistDeps: PlaylistHandlerDeps = { spotify };
  const libraryDeps: LibraryHandlerDeps = { spotify };
  const queueDeps: QueueHandlerDeps = { spotify };

  return [
    // Search & Discovery
    {
      name: 'tracks.search',
      description: 'Search for tracks on Spotify',
      inputSchema: TracksSearchInputSchema,
      handler: async (args: unknown) => {
        const input = TracksSearchInputSchema.parse(args);
        return withMCPContext(logger, 'tracks.search',
          (context) => tracksSearchHandler(context, searchDeps, input), input);
      },
    },
    {
      name: 'albums.search',
      description: 'Search for albums on Spotify',
      inputSchema: AlbumsSearchInputSchema,
      handler: async (args: unknown) => {
        const input = AlbumsSearchInputSchema.parse(args);
        return withMCPContext(logger, 'albums.search',
          (context) => albumsSearchHandler(context, searchDeps, input), input);
      },
    },
    {
      name: 'artists.search',
      description: 'Search for artists on Spotify',
      inputSchema: ArtistsSearchInputSchema,
      handler: async (args: unknown) => {
        const input = ArtistsSearchInputSchema.parse(args);
        return withMCPContext(logger, 'artists.search',
          (context) => artistsSearchHandler(context, searchDeps, input), input);
      },
    },

    // Playback
    {
      name: 'playback.state.get',
      description: 'Get current playback state',
      inputSchema: PlaybackStateInputSchema,
      handler: async (args: unknown) => {
        const input = PlaybackStateInputSchema.parse(args);
        return withMCPContext(logger, 'playback.state.get',
          (context) => playbackStateGetHandler(context, playbackDeps, input), input);
      },
    },
    {
      name: 'playback.control.set',
      description: 'Control Spotify playback (play/pause/next/previous)',
      inputSchema: PlaybackControlInputSchema,
      handler: async (args: unknown) => {
        const input = PlaybackControlInputSchema.parse(args);
        return withMCPContext(logger, 'playback.control.set',
          (context) => playbackControlSetHandler(context, playbackDeps, input), input);
      },
    },

    // Playlists
    {
      name: 'playlists.list.mine',
      description: 'List user\'s playlists',
      inputSchema: PlaylistsListInputSchema,
      handler: async (args: unknown) => {
        const input = PlaylistsListInputSchema.parse(args);
        return withMCPContext(logger, 'playlists.list.mine',
          (context) => playlistsListMineHandler(context, playlistDeps, input), input);
      },
    },
    {
      name: 'playlists.tracks.get',
      description: 'Get tracks from a playlist',
      inputSchema: PlaylistTracksGetInputSchema,
      handler: async (args: unknown) => {
        const input = PlaylistTracksGetInputSchema.parse(args);
        return withMCPContext(logger, 'playlists.tracks.get',
          (context) => playlistTracksGetHandler(context, playlistDeps, input), input);
      },
    },
    {
      name: 'playlists.create',
      description: 'Create a new playlist',
      inputSchema: PlaylistsCreateInputSchema,
      handler: async (args: unknown) => {
        const input = PlaylistsCreateInputSchema.parse(args);
        return withMCPContext(logger, 'playlists.create',
          (context) => playlistsCreateHandler(context, playlistDeps, input), input);
      },
    },
    {
      name: 'playlists.tracks.add',
      description: 'Add tracks to a playlist with deduplication support',
      inputSchema: PlaylistTracksAddInputSchema,
      handler: async (args: unknown) => {
        const input = PlaylistTracksAddInputSchema.parse(args);
        return withMCPContext(logger, 'playlists.tracks.add',
          (context) => playlistTracksAddHandler(context, playlistDeps, input), input);
      },
    },

    // Library - Tracks
    {
      name: 'library.saved.tracks.get',
      description: 'Get user\'s saved tracks',
      inputSchema: LibrarySavedTracksGetInputSchema,
      handler: async (args: unknown) => {
        const input = LibrarySavedTracksGetInputSchema.parse(args);
        return withMCPContext(logger, 'library.saved.tracks.get',
          (context) => librarySavedTracksGetHandler(context, libraryDeps, input), input);
      },
    },
    {
      name: 'library.saved.tracks.save',
      description: 'Save tracks to user\'s library',
      inputSchema: LibrarySavedTracksSaveInputSchema,
      handler: async (args: unknown) => {
        const input = LibrarySavedTracksSaveInputSchema.parse(args);
        return withMCPContext(logger, 'library.saved.tracks.save',
          (context) => librarySavedTracksSaveHandler(context, libraryDeps, input), input);
      },
    },
    {
      name: 'library.saved.tracks.remove',
      description: 'Remove tracks from user\'s library',
      inputSchema: LibrarySavedTracksRemoveInputSchema,
      handler: async (args: unknown) => {
        const input = LibrarySavedTracksRemoveInputSchema.parse(args);
        return withMCPContext(logger, 'library.saved.tracks.remove',
          (context) => librarySavedTracksRemoveHandler(context, libraryDeps, input), input);
      },
    },
    {
      name: 'library.saved.tracks.check',
      description: 'Check if tracks are saved in user\'s library',
      inputSchema: LibrarySavedTracksCheckInputSchema,
      handler: async (args: unknown) => {
        const input = LibrarySavedTracksCheckInputSchema.parse(args);
        return withMCPContext(logger, 'library.saved.tracks.check',
          (context) => librarySavedTracksCheckHandler(context, libraryDeps, input), input);
      },
    },

    // Library - Albums
    {
      name: 'library.saved.albums.get',
      description: 'Get user\'s saved albums',
      inputSchema: LibrarySavedAlbumsGetInputSchema,
      handler: async (args: unknown) => {
        const input = LibrarySavedAlbumsGetInputSchema.parse(args);
        return withMCPContext(logger, 'library.saved.albums.get',
          (context) => librarySavedAlbumsGetHandler(context, libraryDeps, input), input);
      },
    },
    {
      name: 'library.saved.albums.save',
      description: 'Save albums to user\'s library',
      inputSchema: LibrarySavedAlbumsSaveInputSchema,
      handler: async (args: unknown) => {
        const input = LibrarySavedAlbumsSaveInputSchema.parse(args);
        return withMCPContext(logger, 'library.saved.albums.save',
          (context) => librarySavedAlbumsSaveHandler(context, libraryDeps, input), input);
      },
    },
    {
      name: 'library.saved.albums.remove',
      description: 'Remove albums from user\'s library',
      inputSchema: LibrarySavedAlbumsRemoveInputSchema,
      handler: async (args: unknown) => {
        const input = LibrarySavedAlbumsRemoveInputSchema.parse(args);
        return withMCPContext(logger, 'library.saved.albums.remove',
          (context) => librarySavedAlbumsRemoveHandler(context, libraryDeps, input), input);
      },
    },
    {
      name: 'library.saved.albums.check',
      description: 'Check if albums are saved in user\'s library',
      inputSchema: LibrarySavedAlbumsCheckInputSchema,
      handler: async (args: unknown) => {
        const input = LibrarySavedAlbumsCheckInputSchema.parse(args);
        return withMCPContext(logger, 'library.saved.albums.check',
          (context) => librarySavedAlbumsCheckHandler(context, libraryDeps, input), input);
      },
    },

    // Queue
    {
      name: 'queue.add',
      description: 'Add a track to the playback queue',
      inputSchema: QueueAddInputSchema,
      handler: async (args: unknown) => {
        const input = QueueAddInputSchema.parse(args);
        return withMCPContext(logger, 'queue.add',
          (context) => queueAddHandler(context, queueDeps, input), input);
      },
    },
  ];
}

/**
 * Get tool count for logging
 */
export function getToolCount(): number {
  return 17; // Total number of tools registered
}
/**
 * Playlist Tool Handlers - Pure orchestration with domain services
 */

import { SpotifyClient } from '@spotify-mcp/spotify';
import { deduplicateTracks } from '@spotify-mcp/core/rules/dedupe';
import { mapToMCPError } from '../errors.js';
import type { MCPContext } from '../context.js';
import type {
  PlaylistsListInput,
  PlaylistsListOutput,
  PlaylistTracksGetInput,
  PlaylistTracksGetOutput,
  PlaylistsCreateInput,
  PlaylistsCreateOutput,
  PlaylistTracksAddInput,
  PlaylistTracksAddOutput,
} from '../schemas/playlists.js';

export interface PlaylistHandlerDeps {
  spotify: SpotifyClient;
}

/**
 * playlists.list.mine - List user's playlists
 */
export async function playlistsListMineHandler(
  context: MCPContext,
  deps: PlaylistHandlerDeps,
  input: PlaylistsListInput
): Promise<PlaylistsListOutput> {
  try {
    context.logger.debug('Listing user playlists', { limit: input.limit, offset: input.offset });

    const result = await deps.spotify.getUserPlaylists({
      limit: input.limit,
      offset: input.offset,
    });

    return {
      items: result.items.map(playlist => ({
        uri: playlist.uri,
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        owner: playlist.owner.displayName || playlist.owner.id,
        public: playlist.public,
        collaborative: playlist.collaborative,
        trackCount: playlist.tracks.total,
      })),
      total: result.total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + input.limit < result.total,
    };
  } catch (error) {
    context.logger.error('List playlists failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * playlists.tracks.get - Get playlist tracks
 */
export async function playlistTracksGetHandler(
  context: MCPContext,
  deps: PlaylistHandlerDeps,
  input: PlaylistTracksGetInput
): Promise<PlaylistTracksGetOutput> {
  try {
    context.logger.debug('Getting playlist tracks', { playlistId: input.playlistId, limit: input.limit, offset: input.offset });

    const result = await deps.spotify.getPlaylistTracks({
      playlistId: input.playlistId,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      items: result.items.map(item => ({
        uri: item.track.uri,
        id: item.track.id,
        name: item.track.name,
        artists: item.track.artists,
        durationMs: item.track.durationMs,
        explicit: item.track.explicit,
        popularity: item.track.popularity,
      })),
      total: result.total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + input.limit < result.total,
    };
  } catch (error) {
    context.logger.error('Get playlist tracks failed', { error, playlistId: input.playlistId });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * playlists.create - Create a new playlist
 */
export async function playlistsCreateHandler(
  context: MCPContext,
  deps: PlaylistHandlerDeps,
  input: PlaylistsCreateInput
): Promise<PlaylistsCreateOutput> {
  try {
    context.logger.debug('Creating playlist', { name: input.name, public: input.public });

    const user = await deps.spotify.getCurrentUser();
    const playlist = await deps.spotify.createPlaylist({
      userId: user.id,
      name: input.name,
      description: input.description,
      public: input.public,
      collaborative: input.collaborative,
    });

    return {
      playlist: {
        uri: playlist.uri,
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        owner: playlist.owner.displayName || playlist.owner.id,
        public: playlist.public,
        collaborative: playlist.collaborative,
        trackCount: 0,
      },
      message: `Created playlist "${playlist.name}"`,
    };
  } catch (error) {
    context.logger.error('Create playlist failed', { error, name: input.name });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * playlists.tracks.add - Add tracks to playlist with deduplication
 */
export async function playlistTracksAddHandler(
  context: MCPContext,
  deps: PlaylistHandlerDeps,
  input: PlaylistTracksAddInput
): Promise<PlaylistTracksAddOutput> {
  try {
    context.logger.debug('Adding tracks to playlist', {
      playlistId: input.playlistId,
      trackCount: input.uris.length,
      dedupe: input.dedupe,
      dryRun: input.dryRun
    });

    let tracksToAdd = input.uris;
    let duplicatesSkipped = 0;

    // Apply deduplication if requested
    if (input.dedupe) {
      // Get existing playlist tracks for deduplication
      const existingTracks = await deps.spotify.getAllPlaylistTracks(input.playlistId);

      // Create TrackRef objects for domain service
      const existingTrackRefs = existingTracks.map(item => ({
        uri: item.track.uri,
        id: item.track.id,
        name: item.track.name,
        artists: item.track.artists,
        durationMs: item.track.durationMs,
        explicit: item.track.explicit,
        popularity: item.track.popularity,
      }));

      const newTrackRefs = input.uris.map(uri => ({
        uri,
        id: uri.split(':')[2],
        name: '', // We don't have this info, but domain service can handle it
        artists: [],
        durationMs: 0,
      }));

      // Use domain service for deduplication
      const dedupeResult = deduplicateTracks([...existingTrackRefs, ...newTrackRefs], {
        dedupeBy: ['uri'],
      });

      // Extract only the new tracks that weren't duplicates
      tracksToAdd = dedupeResult.deduped
        .slice(existingTrackRefs.length)
        .map(track => track.uri);

      duplicatesSkipped = input.uris.length - tracksToAdd.length;
    }

    const plannedAdds = tracksToAdd.length;

    if (input.dryRun) {
      return {
        success: true,
        message: `Would add ${plannedAdds} tracks (${duplicatesSkipped} duplicates skipped)`,
        plannedAdds,
        duplicatesSkipped,
      };
    }

    // Execute the addition
    if (plannedAdds > 0) {
      const result = await deps.spotify.addTracksToPlaylist({
        playlistId: input.playlistId,
        uris: tracksToAdd,
        position: input.position,
      });

      return {
        success: true,
        message: `Added ${plannedAdds} tracks to playlist (${duplicatesSkipped} duplicates skipped)`,
        plannedAdds,
        actualAdds: plannedAdds,
        duplicatesSkipped,
        snapshot: result.snapshotId,
      };
    } else {
      return {
        success: true,
        message: `No new tracks to add (${duplicatesSkipped} duplicates skipped)`,
        plannedAdds: 0,
        actualAdds: 0,
        duplicatesSkipped,
      };
    }

  } catch (error) {
    context.logger.error('Add tracks to playlist failed', { error, playlistId: input.playlistId });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}
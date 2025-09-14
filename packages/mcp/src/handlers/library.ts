/**
 * Library Tool Handlers - Pure orchestration with domain services
 */

import { SpotifyClient } from '@spotify-mcp/spotify';
import { computeLibraryDiff, optimizeLibraryOperations } from '@spotify-mcp/core/services/library';
import { mapToMCPError } from '../errors.js';
import type { MCPContext } from '../context.js';
import type {
  LibrarySavedTracksGetInput,
  LibrarySavedTracksGetOutput,
  LibrarySavedTracksSaveInput,
  LibrarySavedTracksSaveOutput,
  LibrarySavedTracksRemoveInput,
  LibrarySavedTracksRemoveOutput,
  LibrarySavedTracksCheckInput,
  LibrarySavedTracksCheckOutput,
  LibrarySavedAlbumsGetInput,
  LibrarySavedAlbumsGetOutput,
  LibrarySavedAlbumsSaveInput,
  LibrarySavedAlbumsSaveOutput,
  LibrarySavedAlbumsRemoveInput,
  LibrarySavedAlbumsRemoveOutput,
  LibrarySavedAlbumsCheckInput,
  LibrarySavedAlbumsCheckOutput,
} from '../schemas/library.js';

export interface LibraryHandlerDeps {
  spotify: SpotifyClient;
}

/**
 * library.saved.tracks.get - Get user's saved tracks
 */
export async function librarySavedTracksGetHandler(
  context: MCPContext,
  deps: LibraryHandlerDeps,
  input: LibrarySavedTracksGetInput
): Promise<LibrarySavedTracksGetOutput> {
  try {
    context.logger.debug('Getting saved tracks', { limit: input.limit, offset: input.offset });

    const result = await deps.spotify.getSavedTracks({
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
        addedAt: item.addedAt,
      })),
      total: result.total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + input.limit < result.total,
    };
  } catch (error) {
    context.logger.error('Get saved tracks failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * library.saved.tracks.save - Save tracks to library
 */
export async function librarySavedTracksSaveHandler(
  context: MCPContext,
  deps: LibraryHandlerDeps,
  input: LibrarySavedTracksSaveInput
): Promise<LibrarySavedTracksSaveOutput> {
  try {
    context.logger.debug('Saving tracks to library', { trackCount: input.ids.length });

    // Check which tracks are already saved for idempotency
    const checkResult = await deps.spotify.checkSavedTracks(input.ids);
    const alreadySaved = checkResult.filter(result => result).length;
    const toSave = input.ids.filter((_, index) => !checkResult[index]);

    if (toSave.length > 0) {
      await deps.spotify.saveTracks(toSave);
    }

    const saved = toSave.length;

    return {
      success: true,
      message: `Saved ${saved} tracks (${alreadySaved} already saved)`,
      saved,
      alreadySaved,
    };

  } catch (error) {
    context.logger.error('Save tracks failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * library.saved.tracks.remove - Remove tracks from library
 */
export async function librarySavedTracksRemoveHandler(
  context: MCPContext,
  deps: LibraryHandlerDeps,
  input: LibrarySavedTracksRemoveInput
): Promise<LibrarySavedTracksRemoveOutput> {
  try {
    context.logger.debug('Removing tracks from library', { trackCount: input.ids.length });

    // Check which tracks are actually saved
    const checkResult = await deps.spotify.checkSavedTracks(input.ids);
    const saved = checkResult.filter(result => result).length;
    const notFound = input.ids.length - saved;
    const toRemove = input.ids.filter((_, index) => checkResult[index]);

    if (toRemove.length > 0) {
      await deps.spotify.removeTracks(toRemove);
    }

    return {
      success: true,
      message: `Removed ${toRemove.length} tracks (${notFound} not found)`,
      removed: toRemove.length,
      notFound,
    };

  } catch (error) {
    context.logger.error('Remove tracks failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * library.saved.tracks.check - Check if tracks are saved
 */
export async function librarySavedTracksCheckHandler(
  context: MCPContext,
  deps: LibraryHandlerDeps,
  input: LibrarySavedTracksCheckInput
): Promise<LibrarySavedTracksCheckOutput> {
  try {
    context.logger.debug('Checking saved tracks', { trackCount: input.ids.length });

    const results = await deps.spotify.checkSavedTracks(input.ids);

    return {
      results: input.ids.map((id, index) => ({
        id,
        saved: results[index],
      })),
    };

  } catch (error) {
    context.logger.error('Check saved tracks failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * library.saved.albums.get - Get user's saved albums
 */
export async function librarySavedAlbumsGetHandler(
  context: MCPContext,
  deps: LibraryHandlerDeps,
  input: LibrarySavedAlbumsGetInput
): Promise<LibrarySavedAlbumsGetOutput> {
  try {
    context.logger.debug('Getting saved albums', { limit: input.limit, offset: input.offset });

    const result = await deps.spotify.getSavedAlbums({
      limit: input.limit,
      offset: input.offset,
    });

    return {
      items: result.items.map(item => ({
        uri: item.album.uri,
        id: item.album.id,
        name: item.album.name,
        artists: item.album.artists,
        releaseDate: item.album.releaseDate,
        totalTracks: item.album.totalTracks,
        addedAt: item.addedAt,
      })),
      total: result.total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + input.limit < result.total,
    };
  } catch (error) {
    context.logger.error('Get saved albums failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * library.saved.albums.save - Save albums to library
 */
export async function librarySavedAlbumsSaveHandler(
  context: MCPContext,
  deps: LibraryHandlerDeps,
  input: LibrarySavedAlbumsSaveInput
): Promise<LibrarySavedAlbumsSaveOutput> {
  try {
    context.logger.debug('Saving albums to library', { albumCount: input.ids.length });

    // Check which albums are already saved
    const checkResult = await deps.spotify.checkSavedAlbums(input.ids);
    const alreadySaved = checkResult.filter(result => result).length;
    const toSave = input.ids.filter((_, index) => !checkResult[index]);

    if (toSave.length > 0) {
      await deps.spotify.saveAlbums(toSave);
    }

    const saved = toSave.length;

    return {
      success: true,
      message: `Saved ${saved} albums (${alreadySaved} already saved)`,
      saved,
      alreadySaved,
    };

  } catch (error) {
    context.logger.error('Save albums failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * library.saved.albums.remove - Remove albums from library
 */
export async function librarySavedAlbumsRemoveHandler(
  context: MCPContext,
  deps: LibraryHandlerDeps,
  input: LibrarySavedAlbumsRemoveInput
): Promise<LibrarySavedAlbumsRemoveOutput> {
  try {
    context.logger.debug('Removing albums from library', { albumCount: input.ids.length });

    // Check which albums are actually saved
    const checkResult = await deps.spotify.checkSavedAlbums(input.ids);
    const saved = checkResult.filter(result => result).length;
    const notFound = input.ids.length - saved;
    const toRemove = input.ids.filter((_, index) => checkResult[index]);

    if (toRemove.length > 0) {
      await deps.spotify.removeAlbums(toRemove);
    }

    return {
      success: true,
      message: `Removed ${toRemove.length} albums (${notFound} not found)`,
      removed: toRemove.length,
      notFound,
    };

  } catch (error) {
    context.logger.error('Remove albums failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * library.saved.albums.check - Check if albums are saved
 */
export async function librarySavedAlbumsCheckHandler(
  context: MCPContext,
  deps: LibraryHandlerDeps,
  input: LibrarySavedAlbumsCheckInput
): Promise<LibrarySavedAlbumsCheckOutput> {
  try {
    context.logger.debug('Checking saved albums', { albumCount: input.ids.length });

    const results = await deps.spotify.checkSavedAlbums(input.ids);

    return {
      results: input.ids.map((id, index) => ({
        id,
        saved: results[index],
      })),
    };

  } catch (error) {
    context.logger.error('Check saved albums failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}
/**
 * Search Tool Handlers - Pure orchestration
 */

import { SpotifyClient } from '@spotify-mcp/spotify';
import { mapToMCPError } from '../errors.js';
import type { MCPContext } from '../context.js';
import type {
  TracksSearchInput,
  TracksSearchOutput,
  AlbumsSearchInput,
  AlbumsSearchOutput,
  ArtistsSearchInput,
  ArtistsSearchOutput,
} from '../schemas/search.js';

export interface SearchHandlerDeps {
  spotify: SpotifyClient;
}

/**
 * tracks.search - Search for tracks
 */
export async function tracksSearchHandler(
  context: MCPContext,
  deps: SearchHandlerDeps,
  input: TracksSearchInput
): Promise<TracksSearchOutput> {
  try {
    context.logger.debug('Searching tracks', { query: input.query, limit: input.limit, offset: input.offset });

    const result = await deps.spotify.searchTracks({
      query: input.query,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      items: result.tracks.map(track => ({
        uri: track.uri,
        id: track.id,
        name: track.name,
        artists: track.artists,
        durationMs: track.durationMs,
        explicit: track.explicit,
        popularity: track.popularity,
      })),
      total: result.total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + input.limit < result.total,
    };
  } catch (error) {
    context.logger.error('Track search failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * albums.search - Search for albums
 */
export async function albumsSearchHandler(
  context: MCPContext,
  deps: SearchHandlerDeps,
  input: AlbumsSearchInput
): Promise<AlbumsSearchOutput> {
  try {
    context.logger.debug('Searching albums', { query: input.query, limit: input.limit, offset: input.offset });

    const result = await deps.spotify.searchAlbums({
      query: input.query,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      items: result.albums.map(album => ({
        uri: album.uri,
        id: album.id,
        name: album.name,
        artists: album.artists,
        releaseDate: album.releaseDate,
        totalTracks: album.totalTracks,
      })),
      total: result.total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + input.limit < result.total,
    };
  } catch (error) {
    context.logger.error('Album search failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * artists.search - Search for artists
 */
export async function artistsSearchHandler(
  context: MCPContext,
  deps: SearchHandlerDeps,
  input: ArtistsSearchInput
): Promise<ArtistsSearchOutput> {
  try {
    context.logger.debug('Searching artists', { query: input.query, limit: input.limit, offset: input.offset });

    const result = await deps.spotify.searchArtists({
      query: input.query,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      items: result.artists.map(artist => ({
        uri: artist.uri,
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        followers: artist.followers,
      })),
      total: result.total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + input.limit < result.total,
    };
  } catch (error) {
    context.logger.error('Artist search failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}
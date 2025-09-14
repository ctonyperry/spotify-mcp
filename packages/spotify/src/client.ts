import { validateResponse } from './schemas.js';
import {
  UserSchema,
  PlaybackStateSchema,
  SearchResultSchema,
  PaginatedPlaylistsSchema,
  PaginatedPlaylistTracksSchema,
  PlaylistSchema,
  PaginatedPlayHistorySchema,
  PaginatedSavedTracksSchema,
  PaginatedSavedAlbumsSchema,
  PaginatedTracksSchema,
  AlbumSchema,
} from './schemas.js';
import {
  mapUser,
  mapPlaybackState,
  mapPlaylist,
  mapTrack,
  mapAlbum,
  extractSpotifyId,
  deduplicateById,
} from './mappers.js';
import { mapHttpError } from './errors.js';
import { buildPaginationQuery, extractPaginationInfo, normalizePaginationParams } from './pagination.js';
import type {
  SpotifyClient,
  SpotifyClientDeps,
  SearchParams,
  PlaybackControlParams,
  CreatePlaylistParams,
  AddTracksToPlaylistParams,
  AddToQueueParams,
  RecentlyPlayedParams,
  PageParams,
  Page,
  NormalizedUser,
  NormalizedPlaybackState,
  SearchResult,
  NormalizedPlaylist,
  NormalizedTrack,
  NormalizedAlbum,
  PlayHistory,
  SavedTrack,
  SavedAlbum,
} from './types.js';

export class SpotifyApiClient implements SpotifyClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => Promise<string>;
  private readonly http: SpotifyClientDeps['http'];
  private readonly logger: SpotifyClientDeps['logger'];
  private readonly rateLimiter?: SpotifyClientDeps['rateLimiter'];

  constructor(deps: SpotifyClientDeps) {
    this.baseUrl = deps.baseUrl ?? 'https://api.spotify.com';
    this.getAccessToken = deps.getAccessToken;
    this.http = deps.http;
    this.logger = deps.logger;
    this.rateLimiter = deps.rateLimiter;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    context?: string
  ): Promise<T> {
    try {
      // Check rate limit if available
      await this.rateLimiter?.checkLimit();

      const token = await this.getAccessToken();
      const url = `${this.baseUrl}${endpoint}`;

      const response = await this.http.fetchJSON<T>(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      this.logger.debug('Spotify API request successful', {
        endpoint,
        method: options.method || 'GET',
        context,
      });

      return response;
    } catch (error) {
      this.logger.error('Spotify API request failed', {
        endpoint,
        method: options.method || 'GET',
        context,
        error: error instanceof Error ? error.message : String(error),
      });

      throw mapHttpError(error as Error, context);
    }
  }

  async getMe(): Promise<NormalizedUser> {
    const response = await this.makeRequest<any>('/v1/me', {}, 'getMe');
    const user = validateResponse(response, UserSchema);
    return mapUser(user);
  }

  async playbackState(): Promise<NormalizedPlaybackState> {
    const response = await this.makeRequest<any>('/v1/me/player', {}, 'playbackState');
    const state = validateResponse(response, PlaybackStateSchema);
    return mapPlaybackState(state);
  }

  async playbackControl(params: PlaybackControlParams): Promise<void> {
    const { action, deviceId } = params;

    let endpoint: string;
    let method: string = 'PUT';

    switch (action) {
      case 'play':
        endpoint = '/v1/me/player/play';
        break;
      case 'pause':
        endpoint = '/v1/me/player/pause';
        break;
      case 'next':
        endpoint = '/v1/me/player/next';
        method = 'POST';
        break;
      case 'previous':
        endpoint = '/v1/me/player/previous';
        method = 'POST';
        break;
      default:
        throw new Error(`Invalid playback action: ${action}`);
    }

    const query = new URLSearchParams();
    if (deviceId) {
      query.set('device_id', deviceId);
    }

    const url = query.toString() ? `${endpoint}?${query}` : endpoint;

    await this.makeRequest(url, { method }, `playbackControl:${action}`);
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const { q, types, ...paginationParams } = params;

    const query = buildPaginationQuery(paginationParams);
    query.set('q', q);
    query.set('type', types.join(','));

    const response = await this.makeRequest<any>(
      `/v1/search?${query}`,
      {},
      'search'
    );

    return validateResponse(response, SearchResultSchema);
  }

  async myPlaylists(params?: PageParams): Promise<Page<NormalizedPlaylist>> {
    const query = buildPaginationQuery(params);

    const response = await this.makeRequest<any>(
      `/v1/me/playlists?${query}`,
      {},
      'myPlaylists'
    );

    const playlists = validateResponse(response, PaginatedPlaylistsSchema);

    return {
      ...extractPaginationInfo(playlists),
      items: playlists.items.map(mapPlaylist),
    };
  }

  async playlistTracks(id: string, params?: PageParams): Promise<Page<NormalizedTrack>> {
    const query = buildPaginationQuery(params);

    const response = await this.makeRequest<any>(
      `/v1/playlists/${id}/tracks?${query}`,
      {},
      'playlistTracks'
    );

    const tracks = validateResponse(response, PaginatedPlaylistTracksSchema);

    return {
      ...extractPaginationInfo(tracks),
      items: tracks.items
        .filter(item => item.track !== null)
        .map(item => mapTrack(item.track!)),
    };
  }

  async createPlaylist(params: CreatePlaylistParams): Promise<NormalizedPlaylist> {
    const { userId, name, description, public: isPublic } = params;

    const body = {
      name,
      description: description || '',
      public: isPublic ?? false,
    };

    const response = await this.makeRequest<any>(
      `/v1/users/${userId}/playlists`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      'createPlaylist'
    );

    const playlist = validateResponse(response, PlaylistSchema);
    return mapPlaylist(playlist);
  }

  async addTracksToPlaylist(params: AddTracksToPlaylistParams): Promise<void> {
    const { playlistId, uris } = params;

    // Deduplicate URIs to avoid adding the same track multiple times
    const uniqueUris = Array.from(new Set(uris));

    const body = {
      uris: uniqueUris,
    };

    await this.makeRequest(
      `/v1/playlists/${playlistId}/tracks`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      'addTracksToPlaylist'
    );
  }

  async addToQueue(params: AddToQueueParams): Promise<void> {
    const { uri, deviceId } = params;

    const query = new URLSearchParams();
    query.set('uri', uri);
    if (deviceId) {
      query.set('device_id', deviceId);
    }

    await this.makeRequest(
      `/v1/me/player/queue?${query}`,
      { method: 'POST' },
      'addToQueue'
    );
  }

  async recentlyPlayed(params?: RecentlyPlayedParams): Promise<Page<PlayHistory>> {
    const query = new URLSearchParams();

    if (params?.limit) {
      query.set('limit', Math.min(params.limit, 50).toString());
    }

    if (params?.afterMs) {
      query.set('after', params.afterMs.toString());
    }

    if (params?.beforeMs) {
      query.set('before', params.beforeMs.toString());
    }

    const response = await this.makeRequest<any>(
      `/v1/me/player/recently-played?${query}`,
      {},
      'recentlyPlayed'
    );

    return validateResponse(response, PaginatedPlayHistorySchema);
  }

  async savedTracks(params?: PageParams): Promise<Page<SavedTrack>> {
    const query = buildPaginationQuery(params);

    const response = await this.makeRequest<any>(
      `/v1/me/tracks?${query}`,
      {},
      'savedTracks'
    );

    return validateResponse(response, PaginatedSavedTracksSchema);
  }

  async savedAlbums(params?: PageParams): Promise<Page<SavedAlbum>> {
    const query = buildPaginationQuery(params);

    const response = await this.makeRequest<any>(
      `/v1/me/albums?${query}`,
      {},
      'savedAlbums'
    );

    return validateResponse(response, PaginatedSavedAlbumsSchema);
  }

  async albums(ids: string[]): Promise<NormalizedAlbum[]> {
    if (ids.length === 0) {
      return [];
    }

    // Spotify allows up to 20 albums per request
    const chunks = this.chunkArray(ids, 20);
    const allAlbums: NormalizedAlbum[] = [];

    for (const chunk of chunks) {
      const query = new URLSearchParams();
      query.set('ids', chunk.join(','));

      const response = await this.makeRequest<any>(
        `/v1/albums?${query}`,
        {},
        'albums'
      );

      if (response.albums) {
        allAlbums.push(...response.albums.map((album: any) => {
          const validatedAlbum = validateResponse(album, AlbumSchema);
          return mapAlbum(validatedAlbum);
        }));
      }
    }

    return allAlbums;
  }

  async albumTracks(id: string, params?: PageParams): Promise<Page<NormalizedTrack>> {
    const query = buildPaginationQuery(params);

    const response = await this.makeRequest<any>(
      `/v1/albums/${id}/tracks?${query}`,
      {},
      'albumTracks'
    );

    const tracks = validateResponse(response, PaginatedTracksSchema);

    return {
      ...extractPaginationInfo(tracks),
      items: tracks.items.map(mapTrack),
    };
  }

  async checkSavedTracks(ids: string[]): Promise<boolean[]> {
    if (ids.length === 0) {
      return [];
    }

    // Spotify allows up to 50 IDs per request
    const chunks = this.chunkArray(ids, 50);
    const allResults: boolean[] = [];

    for (const chunk of chunks) {
      const query = new URLSearchParams();
      query.set('ids', chunk.join(','));

      const response = await this.makeRequest<boolean[]>(
        `/v1/me/tracks/contains?${query}`,
        {},
        'checkSavedTracks'
      );

      allResults.push(...response);
    }

    return allResults;
  }

  async checkSavedAlbums(ids: string[]): Promise<boolean[]> {
    if (ids.length === 0) {
      return [];
    }

    // Spotify allows up to 50 IDs per request
    const chunks = this.chunkArray(ids, 50);
    const allResults: boolean[] = [];

    for (const chunk of chunks) {
      const query = new URLSearchParams();
      query.set('ids', chunk.join(','));

      const response = await this.makeRequest<boolean[]>(
        `/v1/me/albums/contains?${query}`,
        {},
        'checkSavedAlbums'
      );

      allResults.push(...response);
    }

    return allResults;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export function createSpotifyClient(deps: SpotifyClientDeps): SpotifyClient {
  return new SpotifyApiClient(deps);
}
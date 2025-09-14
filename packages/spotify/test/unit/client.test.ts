import { describe, it, expect, beforeEach } from 'vitest';
import { createSpotifyClient } from '../../src/client.js';
import { SpotifyAuthError, SpotifyApiError } from '../../src/errors.js';
import { MockHttpClient, MockLogger, MockRateLimiter, createMockAccessTokenGetter, testDataFactory, expectThrows } from '../helpers.js';

describe('SpotifyClient', () => {
  let mockHttp: MockHttpClient;
  let mockLogger: MockLogger;
  let mockRateLimiter: MockRateLimiter;
  let getAccessToken: () => Promise<string>;
  let client: ReturnType<typeof createSpotifyClient>;

  beforeEach(() => {
    mockHttp = new MockHttpClient();
    mockLogger = new MockLogger();
    mockRateLimiter = new MockRateLimiter();
    getAccessToken = createMockAccessTokenGetter('test-token');

    client = createSpotifyClient({
      baseUrl: 'https://api.spotify.com',
      getAccessToken,
      http: mockHttp,
      logger: mockLogger,
      rateLimiter: mockRateLimiter,
    });
  });

  describe('getMe', () => {
    it('should fetch and map current user', async () => {
      const userData = testDataFactory.user();
      mockHttp.setMockResponse('/v1/me', userData);

      const result = await client.getMe();

      expect(result.id).toBe(userData.id);
      expect(result.displayName).toBe(userData.display_name);
      expect(mockHttp.wasRequestMade('/v1/me', 'GET')).toBe(true);
      expect(mockLogger.hasLog('debug', 'Spotify API request successful')).toBe(true);
    });

    it('should handle authentication error', async () => {
      const { HttpError } = await import('@spotify-mcp/platform');
      const authError = new HttpError('Unauthorized', 401, 'https://api.spotify.com/v1/me');
      mockHttp.setMockError('/v1/me', authError);

      await expectThrows(
        () => client.getMe(),
        'Invalid or expired Spotify access token'
      );

      expect(mockLogger.hasLog('error', 'Spotify API request failed')).toBe(true);
    });
  });

  describe('playbackState', () => {
    it('should fetch and map playback state', async () => {
      const playbackData = testDataFactory.playbackState();
      mockHttp.setMockResponse('/v1/me/player', playbackData);

      const result = await client.playbackState();

      expect(result.device.id).toBe(playbackData.device.id);
      expect(result.isPlaying).toBe(playbackData.is_playing);
      expect(result.progressMs).toBe(playbackData.progress_ms);
      expect(mockHttp.wasRequestMade('/v1/me/player', 'GET')).toBe(true);
    });
  });

  describe('playbackControl', () => {
    it('should send play command', async () => {
      mockHttp.setMockResponse('/v1/me/player/play', {}, 'PUT');

      await client.playbackControl({ action: 'play' });

      expect(mockHttp.wasRequestMade('/v1/me/player/play', 'PUT')).toBe(true);
    });

    it('should send pause command', async () => {
      mockHttp.setMockResponse('/v1/me/player/pause', {}, 'PUT');

      await client.playbackControl({ action: 'pause' });

      expect(mockHttp.wasRequestMade('/v1/me/player/pause', 'PUT')).toBe(true);
    });

    it('should send next command', async () => {
      mockHttp.setMockResponse('/v1/me/player/next', {}, 'POST');

      await client.playbackControl({ action: 'next' });

      expect(mockHttp.wasRequestMade('/v1/me/player/next', 'POST')).toBe(true);
    });

    it('should send previous command', async () => {
      mockHttp.setMockResponse('/v1/me/player/previous', {}, 'POST');

      await client.playbackControl({ action: 'previous' });

      expect(mockHttp.wasRequestMade('/v1/me/player/previous', 'POST')).toBe(true);
    });

    it('should include device ID in query', async () => {
      mockHttp.setMockResponse('/v1/me/player/play', {}, 'PUT');

      await client.playbackControl({ action: 'play', deviceId: 'device-123' });

      const requests = mockHttp.getRequestLog();
      const request = requests.find(r => r.url.includes('/v1/me/player/play'));
      expect(request?.url).toContain('device_id=device-123');
    });

    it('should throw error for invalid action', async () => {
      await expectThrows(
        () => client.playbackControl({ action: 'invalid' as any }),
        'Invalid playback action'
      );
    });
  });

  describe('search', () => {
    it('should search for tracks, albums, and artists', async () => {
      const searchResult = {
        tracks: testDataFactory.paginatedResponse([testDataFactory.track()]),
        albums: testDataFactory.paginatedResponse([testDataFactory.album()]),
        artists: testDataFactory.paginatedResponse([testDataFactory.artist()]),
      };
      mockHttp.setMockResponse('/v1/search', searchResult);

      const result = await client.search({
        q: 'test query',
        types: ['track', 'album', 'artist'],
        limit: 10,
        offset: 0,
      });

      expect(result.tracks?.items).toHaveLength(1);
      expect(result.albums?.items).toHaveLength(1);
      expect(result.artists?.items).toHaveLength(1);

      const requests = mockHttp.getRequestLog();
      const request = requests.find(r => r.url.includes('/v1/search'));
      expect(request?.url).toContain('q=test+query');
      expect(request?.url).toContain('type=track%2Calbum%2Cartist');
      expect(request?.url).toContain('limit=10');
      expect(request?.url).toContain('offset=0');
    });
  });

  describe('myPlaylists', () => {
    it('should fetch user playlists', async () => {
      const playlistsData = testDataFactory.paginatedResponse([
        testDataFactory.playlist(),
        testDataFactory.playlist({ id: 'playlist-2', name: 'Playlist 2' }),
      ]);
      mockHttp.setMockResponse('/v1/me/playlists', playlistsData);

      const result = await client.myPlaylists({ limit: 20, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Test Playlist');
      expect(result.items[1].name).toBe('Playlist 2');
      expect(result.total).toBe(2);
    });
  });

  describe('playlistTracks', () => {
    it('should fetch playlist tracks', async () => {
      const tracksData = testDataFactory.paginatedResponse([
        { added_at: '2023-01-01T00:00:00Z', added_by: testDataFactory.user(), is_local: false, track: testDataFactory.track() },
        { added_at: '2023-01-02T00:00:00Z', added_by: testDataFactory.user(), is_local: false, track: testDataFactory.track({ id: 'track-2' }) },
      ]);
      mockHttp.setMockResponse('/v1/playlists/playlist-123/tracks', tracksData);

      const result = await client.playlistTracks('playlist-123', { limit: 50 });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('test-track-id');
      expect(result.items[1].id).toBe('track-2');
    });

    it('should filter out null tracks', async () => {
      const tracksData = testDataFactory.paginatedResponse([
        { added_at: '2023-01-01T00:00:00Z', added_by: testDataFactory.user(), is_local: false, track: testDataFactory.track() },
        { added_at: '2023-01-02T00:00:00Z', added_by: testDataFactory.user(), is_local: false, track: null },
      ]);
      mockHttp.setMockResponse('/v1/playlists/playlist-123/tracks', tracksData);

      const result = await client.playlistTracks('playlist-123');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('test-track-id');
    });
  });

  describe('createPlaylist', () => {
    it('should create playlist with all parameters', async () => {
      const playlistData = testDataFactory.playlist({
        name: 'New Playlist',
        description: 'A new playlist',
        public: false,
      });
      mockHttp.setMockResponse('/v1/users/user-123/playlists', playlistData, 'POST');

      const result = await client.createPlaylist({
        userId: 'user-123',
        name: 'New Playlist',
        description: 'A new playlist',
        public: false,
      });

      expect(result.name).toBe('New Playlist');
      expect(result.description).toBe('A new playlist');
      expect(result.public).toBe(false);

      const requests = mockHttp.getRequestLog();
      const request = requests.find(r => r.url.includes('/v1/users/user-123/playlists') && r.options.method === 'POST');
      expect(request).toBeDefined();

      const body = JSON.parse(request!.options.body);
      expect(body.name).toBe('New Playlist');
      expect(body.description).toBe('A new playlist');
      expect(body.public).toBe(false);
    });

    it('should create playlist with minimal parameters', async () => {
      const playlistData = testDataFactory.playlist({ name: 'Simple Playlist' });
      mockHttp.setMockResponse('/v1/users/user-123/playlists', playlistData, 'POST');

      const result = await client.createPlaylist({
        userId: 'user-123',
        name: 'Simple Playlist',
      });

      expect(result.name).toBe('Simple Playlist');

      const requests = mockHttp.getRequestLog();
      const request = requests.find(r => r.options.method === 'POST');
      const body = JSON.parse(request!.options.body);
      expect(body.description).toBe('');
      expect(body.public).toBe(false);
    });
  });

  describe('addTracksToPlaylist', () => {
    it('should add tracks to playlist', async () => {
      mockHttp.setMockResponse('/v1/playlists/playlist-123/tracks', {}, 'POST');

      await client.addTracksToPlaylist({
        playlistId: 'playlist-123',
        uris: ['spotify:track:track1', 'spotify:track:track2'],
      });

      const requests = mockHttp.getRequestLog();
      const request = requests.find(r => r.options.method === 'POST');
      const body = JSON.parse(request!.options.body);
      expect(body.uris).toEqual(['spotify:track:track1', 'spotify:track:track2']);
    });

    it('should deduplicate URIs', async () => {
      mockHttp.setMockResponse('/v1/playlists/playlist-123/tracks', {}, 'POST');

      await client.addTracksToPlaylist({
        playlistId: 'playlist-123',
        uris: ['spotify:track:track1', 'spotify:track:track2', 'spotify:track:track1'],
      });

      const requests = mockHttp.getRequestLog();
      const request = requests.find(r => r.options.method === 'POST');
      const body = JSON.parse(request!.options.body);
      expect(body.uris).toEqual(['spotify:track:track1', 'spotify:track:track2']);
    });
  });

  describe('addToQueue', () => {
    it('should add track to queue', async () => {
      mockHttp.setMockResponse('/v1/me/player/queue', {}, 'POST');

      await client.addToQueue({ uri: 'spotify:track:track1' });

      const requests = mockHttp.getRequestLog();
      const request = requests.find(r => r.url.includes('/v1/me/player/queue'));
      expect(request?.url).toContain('uri=spotify%3Atrack%3Atrack1');
    });

    it('should include device ID when provided', async () => {
      mockHttp.setMockResponse('/v1/me/player/queue', {}, 'POST');

      await client.addToQueue({
        uri: 'spotify:track:track1',
        deviceId: 'device-123',
      });

      const requests = mockHttp.getRequestLog();
      const request = requests.find(r => r.url.includes('/v1/me/player/queue'));
      expect(request?.url).toContain('device_id=device-123');
    });
  });

  describe('checkSavedTracks', () => {
    it('should check if tracks are saved', async () => {
      mockHttp.setMockResponse('/v1/me/tracks/contains', [true, false, true]);

      const result = await client.checkSavedTracks(['track1', 'track2', 'track3']);

      expect(result).toEqual([true, false, true]);

      const requests = mockHttp.getRequestLog();
      const request = requests.find(r => r.url.includes('/v1/me/tracks/contains'));
      expect(request?.url).toContain('ids=track1%2Ctrack2%2Ctrack3');
    });

    it('should handle empty array', async () => {
      const result = await client.checkSavedTracks([]);
      expect(result).toEqual([]);
    });

    it('should chunk large arrays', async () => {
      const ids = Array.from({ length: 75 }, (_, i) => `track${i}`);
      // First chunk: 50 items
      mockHttp.setMockResponse('/v1/me/tracks/contains', Array(50).fill(true));
      // Second chunk: 25 items
      mockHttp.setMockResponse('/v1/me/tracks/contains', Array(25).fill(false));

      const result = await client.checkSavedTracks(ids);

      expect(result).toHaveLength(75);
      expect(mockHttp.getRequestLog().filter(r => r.url.includes('/v1/me/tracks/contains'))).toHaveLength(2);
    });
  });

  describe('rate limiting', () => {
    it('should check rate limit before making requests', async () => {
      mockRateLimiter.setRateLimited(true, 1000);
      mockHttp.setMockResponse('/v1/me', testDataFactory.user());

      await expectThrows(() => client.getMe());

      // Should not have made HTTP request due to rate limiting
      expect(mockHttp.wasRequestMade('/v1/me')).toBe(false);
    });

    it('should proceed when rate limiter allows', async () => {
      mockRateLimiter.setRateLimited(false);
      mockHttp.setMockResponse('/v1/me', testDataFactory.user());

      await client.getMe();

      expect(mockHttp.wasRequestMade('/v1/me')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should map HTTP errors to Spotify errors', async () => {
      const { HttpError } = await import('@spotify-mcp/platform');
      const httpError = new HttpError('Forbidden', 403, 'https://api.spotify.com/v1/me');
      mockHttp.setMockError('/v1/me', httpError);

      const error = await expectThrows(() => client.getMe());
      expect(error).toBeInstanceOf(SpotifyAuthError);
    });

    it('should include context in error mapping', async () => {
      const httpError = new Error('Not Found');
      (httpError as any).status = 404;
      mockHttp.setMockError('/v1/me', httpError);

      const error = await expectThrows(() => client.getMe());
      expect(error.message).toContain('(getMe)');
    });
  });

  describe('authorization header', () => {
    it('should include authorization header in requests', async () => {
      mockHttp.setMockResponse('/v1/me', testDataFactory.user());

      await client.getMe();

      const requests = mockHttp.getRequestLog();
      const request = requests[0];
      expect(request.options.headers.Authorization).toBe('Bearer test-token');
    });

    it('should fetch fresh token for each request', async () => {
      let tokenCount = 0;
      const getAccessToken = async () => `token-${++tokenCount}`;

      const clientWithDynamicToken = createSpotifyClient({
        getAccessToken,
        http: mockHttp,
        logger: mockLogger,
      });

      mockHttp.setMockResponse('/v1/me', testDataFactory.user());

      await clientWithDynamicToken.getMe();
      await clientWithDynamicToken.getMe();

      const requests = mockHttp.getRequestLog();
      expect(requests[0].options.headers.Authorization).toBe('Bearer token-1');
      expect(requests[1].options.headers.Authorization).toBe('Bearer token-2');
    });
  });
});
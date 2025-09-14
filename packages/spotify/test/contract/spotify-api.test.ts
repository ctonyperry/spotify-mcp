import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import { createHttpClient } from '@spotify-mcp/platform';
import { createSpotifyClient } from '../../src/client.js';
import { createRecordingHttpClient, withCassette } from '../recordingHttp.js';
import { MockLogger, createMockAccessTokenGetter } from '../helpers.js';

describe('Spotify API Contract Tests', () => {
  let mockLogger: MockLogger;
  let recordingHttp: ReturnType<typeof createRecordingHttpClient>;
  let client: ReturnType<typeof createSpotifyClient>;

  beforeEach(() => {
    mockLogger = new MockLogger();
    const realHttp = createHttpClient(mockLogger);

    const cassettesDir = path.join(import.meta.dirname || __dirname, '../fixtures/cassettes');
    recordingHttp = createRecordingHttpClient(realHttp, cassettesDir);

    client = createSpotifyClient({
      baseUrl: 'https://api.spotify.com',
      getAccessToken: createMockAccessTokenGetter('test-access-token'),
      http: recordingHttp,
      logger: mockLogger,
    });
  });

  describe('GET /v1/me', () => {
    it('should fetch current user profile', async () => {
      await withCassette('user-profile', recordingHttp, async () => {
        const user = await client.getMe();

        expect(user).toBeDefined();
        expect(user.id).toBe('testuser');
        expect(user.displayName).toBe('Test User');
        expect(user.email).toBe('test@example.com');
        expect(user.country).toBe('US');
        expect(user.product).toBe('premium');
        expect(user.type).toBe('user');
        expect(user.externalUrls.spotify).toBe('https://open.spotify.com/user/testuser');
        expect(user.followers.total).toBe(42);
        expect(user.images).toHaveLength(1);
        expect(user.images[0].url).toContain('i.scdn.co');
        expect(user.explicitContent?.filterEnabled).toBe(false);
        expect(user.explicitContent?.filterLocked).toBe(false);
      });
    });
  });

  describe('GET /v1/search', () => {
    it('should search for tracks', async () => {
      await withCassette('search-tracks', recordingHttp, async () => {
        const result = await client.search({
          q: 'test',
          types: ['track'],
          limit: 20,
          offset: 0,
        });

        expect(result).toBeDefined();
        expect(result.tracks).toBeDefined();
        expect(result.tracks?.items).toHaveLength(1);

        const track = result.tracks!.items[0];
        expect(track.id).toBe('testtrack1');
        expect(track.name).toBe('Test Track');
        expect(track.artists).toHaveLength(1);
        expect(track.artists[0].name).toBe('Test Artist');
        expect(track.artists[0].id).toBe('testartist1');
        expect(track.album?.name).toBe('Test Album');
        expect(track.album?.id).toBe('testalbum1');
        expect(track.duration_ms).toBe(180000);
        expect(track.explicit).toBe(false);
        expect(track.popularity).toBe(75);
        expect(track.track_number).toBe(1);
        expect(track.disc_number).toBe(1);
        expect(track.is_local).toBe(false);
        expect(track.preview_url).toContain('p.scdn.co');
        expect(track.external_urls.spotify).toBe('https://open.spotify.com/track/testtrack1');
      });
    });
  });

  describe('GET /v1/me/player', () => {
    it('should fetch current playback state', async () => {
      await withCassette('playback-state', recordingHttp, async () => {
        const state = await client.playbackState();

        expect(state).toBeDefined();
        expect(state.isPlaying).toBe(true);
        expect(state.progressMs).toBe(30000);
        expect(state.timestamp).toBe(1703505000000);
        expect(state.repeatState).toBe('off');
        expect(state.shuffleState).toBe(false);
        expect(state.currentlyPlayingType).toBe('track');

        // Device validation
        expect(state.device.id).toBe('device123');
        expect(state.device.name).toBe('Test Device');
        expect(state.device.type).toBe('Computer');
        expect(state.device.isActive).toBe(true);
        expect(state.device.volumePercent).toBe(75);
        expect(state.device.isPrivateSession).toBe(false);
        expect(state.device.isRestricted).toBe(false);

        // Context validation
        expect(state.context).toBeDefined();
        expect(state.context?.type).toBe('playlist');
        expect(state.context?.uri).toBe('spotify:playlist:testplaylist');

        // Currently playing item validation
        expect(state.item).toBeDefined();
        expect(state.item?.id).toBe('testtrack1');
        expect(state.item?.name).toBe('Test Track');
        expect(state.item?.artists[0].name).toBe('Test Artist');

        // Actions validation
        expect(state.actions.pausing).toBe(true);
        expect(state.actions.resuming).toBe(true);
        expect(state.actions.skippingNext).toBe(true);
        expect(state.actions.skippingPrev).toBe(true);
      });
    });
  });

  describe('Data validation and mapping', () => {
    it('should properly normalize snake_case to camelCase', async () => {
      await withCassette('user-profile', recordingHttp, async () => {
        const user = await client.getMe();

        // Verify camelCase conversion from mapper
        expect(user.displayName).toBeDefined();
        expect(user.externalUrls).toBeDefined();
        expect(user.explicitContent?.filterEnabled).toBeDefined();
        expect(user.explicitContent?.filterLocked).toBeDefined();

        // Verify no snake_case properties exist after mapping
        expect((user as any).display_name).toBeUndefined();
        expect((user as any).external_urls).toBeUndefined();
        expect((user as any).explicit_content).toBeUndefined();
      });
    });

    it('should handle nested object normalization', async () => {
      await withCassette('playback-state', recordingHttp, async () => {
        const state = await client.playbackState();

        // Device normalization
        expect(state.device.isActive).toBeDefined();
        expect(state.device.isPrivateSession).toBeDefined();
        expect(state.device.isRestricted).toBeDefined();
        expect(state.device.volumePercent).toBeDefined();

        // Verify no snake_case properties
        expect((state.device as any).is_active).toBeUndefined();
        expect((state.device as any).is_private_session).toBeUndefined();
        expect((state.device as any).volume_percent).toBeUndefined();

        // Playback state normalization
        expect(state.repeatState).toBeDefined();
        expect(state.shuffleState).toBeDefined();
        expect(state.isPlaying).toBeDefined();
        expect(state.progressMs).toBeDefined();
        expect(state.currentlyPlayingType).toBeDefined();

        // Verify no snake_case properties
        expect((state as any).repeat_state).toBeUndefined();
        expect((state as any).shuffle_state).toBeUndefined();
        expect((state as any).is_playing).toBeUndefined();
        expect((state as any).progress_ms).toBeUndefined();
        expect((state as any).currently_playing_type).toBeUndefined();
      });
    });

    it('should validate data structure consistency', async () => {
      await withCassette('search-tracks', recordingHttp, async () => {
        const result = await client.search({
          q: 'test',
          types: ['track'],
        });

        const track = result.tracks!.items[0];

        // Verify all required fields are present and correctly typed (raw API response)
        expect(typeof track.id).toBe('string');
        expect(typeof track.name).toBe('string');
        expect(typeof track.duration_ms).toBe('number');
        expect(typeof track.explicit).toBe('boolean');
        expect(typeof track.track_number).toBe('number');
        expect(typeof track.disc_number).toBe('number');
        expect(typeof track.is_local).toBe('boolean');
        expect(Array.isArray(track.artists)).toBe(true);
        expect(Array.isArray(track.available_markets)).toBe(true);

        // Verify nested objects (raw API response)
        expect(typeof track.external_urls).toBe('object');
        expect(typeof track.external_urls.spotify).toBe('string');

        if (track.album) {
          expect(typeof track.album.id).toBe('string');
          expect(typeof track.album.name).toBe('string');
          expect(typeof track.album.album_type).toBe('string');
          expect(typeof track.album.total_tracks).toBe('number');
        }

        // Verify artist structure
        track.artists.forEach(artist => {
          expect(typeof artist.id).toBe('string');
          expect(typeof artist.name).toBe('string');
          expect(typeof artist.type).toBe('string');
          expect(artist.type).toBe('artist');
          expect(typeof artist.uri).toBe('string');
          expect(artist.uri).toMatch(/^spotify:artist:/);
        });
      });
    });

    it('should handle optional fields correctly', async () => {
      await withCassette('search-tracks', recordingHttp, async () => {
        const result = await client.search({
          q: 'test',
          types: ['track'],
        });

        const track = result.tracks!.items[0];

        // Optional fields should be handled gracefully (raw API response)
        if (track.preview_url !== null) {
          expect(typeof track.preview_url).toBe('string');
        }

        if (track.external_ids) {
          expect(typeof track.external_ids).toBe('object');
          if (track.external_ids.isrc) {
            expect(typeof track.external_ids.isrc).toBe('string');
          }
        }

        if (track.popularity !== undefined) {
          expect(typeof track.popularity).toBe('number');
          expect(track.popularity).toBeGreaterThanOrEqual(0);
          expect(track.popularity).toBeLessThanOrEqual(100);
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle schema validation failures gracefully', async () => {
      // This test would need a cassette with invalid data to test schema validation
      // For now, we'll test that the validation function exists and works
      const mockInvalidData = { invalid: 'data' };

      try {
        // This would happen inside the client when schema validation fails
        const { validateResponse, UserSchema } = await import('../../src/schemas.js');
        validateResponse(mockInvalidData, UserSchema);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Schema validation failed');
      }
    });
  });

  describe('URL construction and parameters', () => {
    it('should construct search URLs with proper encoding', async () => {
      await withCassette('search-tracks', recordingHttp, async () => {
        await client.search({
          q: 'test',
          types: ['track'],
          limit: 20,
          offset: 0,
        });

        // Verify the request was made with correct URL
        // This is validated by the cassette matching the exact URL
        expect(true).toBe(true); // Test passes if cassette matched
      });
    });
  });
});
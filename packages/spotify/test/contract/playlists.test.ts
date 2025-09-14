import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import { createHttpClient } from '@spotify-mcp/platform';
import { createSpotifyClient } from '../../src/client.js';
import { createRecordingHttpClient, withCassette } from '../recordingHttp.js';
import { MockLogger, createMockAccessTokenGetter } from '../helpers.js';

describe('Spotify Playlists API Contract Tests', () => {
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

  describe('GET /v1/me/playlists', () => {
    it('should fetch user playlists with pagination', async () => {
      await withCassette('my-playlists', recordingHttp, async () => {
        const result = await client.myPlaylists({ limit: 20, offset: 0 });

        expect(result).toBeDefined();
        expect(result.items).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.limit).toBe(20);
        expect(result.offset).toBe(0);
        expect(result.next).toBeNull();
        expect(result.previous).toBeNull();

        // Validate first playlist
        const playlist1 = result.items[0];
        expect(playlist1.id).toBe('playlist1');
        expect(playlist1.name).toBe('My Favorites');
        expect(playlist1.description).toBe('My favorite tracks');
        expect(playlist1.collaborative).toBe(false);
        expect(playlist1.public).toBe(true);
        expect(playlist1.snapshotId).toBe('snap1');
        expect(playlist1.tracks.total).toBe(10);
        expect(playlist1.followers.total).toBe(5);
        expect(playlist1.images).toHaveLength(1);
        expect(playlist1.owner.id).toBe('testuser');
        expect(playlist1.owner.displayName).toBe('Test User');

        // Validate second playlist
        const playlist2 = result.items[1];
        expect(playlist2.id).toBe('playlist2');
        expect(playlist2.name).toBe('Collaborative Mix');
        expect(playlist2.description).toBeNull();
        expect(playlist2.collaborative).toBe(true);
        expect(playlist2.public).toBe(false);
        expect(playlist2.snapshotId).toBe('snap2');
        expect(playlist2.tracks.total).toBe(25);
        expect(playlist2.followers.total).toBe(12);
        expect(playlist2.images).toHaveLength(0);
      });
    });

    it('should properly normalize playlist data', async () => {
      await withCassette('my-playlists', recordingHttp, async () => {
        const result = await client.myPlaylists();

        const playlist = result.items[0];

        // Verify camelCase conversion
        expect(playlist.snapshotId).toBeDefined();
        expect(playlist.externalUrls).toBeDefined();

        // Verify no snake_case properties
        expect((playlist as any).snapshot_id).toBeUndefined();
        expect((playlist as any).external_urls).toBeUndefined();

        // Verify owner normalization
        expect(playlist.owner.displayName).toBeDefined();
        expect((playlist.owner as any).display_name).toBeUndefined();
      });
    });
  });

  describe('Playlist data structure validation', () => {
    it('should validate playlist objects have all required fields', async () => {
      await withCassette('my-playlists', recordingHttp, async () => {
        const result = await client.myPlaylists();

        result.items.forEach(playlist => {
          // Required string fields
          expect(typeof playlist.id).toBe('string');
          expect(typeof playlist.name).toBe('string');
          expect(typeof playlist.href).toBe('string');
          expect(typeof playlist.uri).toBe('string');
          expect(typeof playlist.type).toBe('string');
          expect(playlist.type).toBe('playlist');
          expect(typeof playlist.snapshotId).toBe('string');

          // Required boolean fields
          expect(typeof playlist.collaborative).toBe('boolean');

          // Required object fields
          expect(typeof playlist.externalUrls).toBe('object');
          expect(typeof playlist.externalUrls.spotify).toBe('string');
          expect(typeof playlist.followers).toBe('object');
          expect(typeof playlist.followers.total).toBe('number');
          expect(typeof playlist.tracks).toBe('object');
          expect(typeof playlist.tracks.total).toBe('number');
          expect(typeof playlist.owner).toBe('object');

          // Required arrays
          expect(Array.isArray(playlist.images)).toBe(true);

          // Optional fields
          if (playlist.description !== null) {
            expect(typeof playlist.description).toBe('string');
          }

          if (playlist.public !== null) {
            expect(typeof playlist.public).toBe('boolean');
          }

          // Validate image structure
          playlist.images.forEach(image => {
            expect(typeof image.url).toBe('string');
            if (image.height !== null) {
              expect(typeof image.height).toBe('number');
            }
            if (image.width !== null) {
              expect(typeof image.width).toBe('number');
            }
          });

          // Validate owner structure
          expect(typeof playlist.owner.id).toBe('string');
          expect(typeof playlist.owner.type).toBe('string');
          expect(playlist.owner.type).toBe('user');
          expect(typeof playlist.owner.uri).toBe('string');
          expect(playlist.owner.uri).toMatch(/^spotify:user:/);
        });
      });
    });

    it('should handle edge cases in playlist data', async () => {
      await withCassette('my-playlists', recordingHttp, async () => {
        const result = await client.myPlaylists();

        // Find playlist with null description
        const playlistWithNullDesc = result.items.find(p => p.description === null);
        expect(playlistWithNullDesc).toBeDefined();
        expect(playlistWithNullDesc!.description).toBeNull();

        // Find playlist with empty images array
        const playlistWithoutImages = result.items.find(p => p.images.length === 0);
        expect(playlistWithoutImages).toBeDefined();
        expect(playlistWithoutImages!.images).toEqual([]);

        // Verify collaborative vs non-collaborative playlists
        const collaborativePlaylist = result.items.find(p => p.collaborative);
        const nonCollaborativePlaylist = result.items.find(p => !p.collaborative);
        expect(collaborativePlaylist).toBeDefined();
        expect(nonCollaborativePlaylist).toBeDefined();

        // Verify public vs private playlists
        const publicPlaylist = result.items.find(p => p.public === true);
        const privatePlaylist = result.items.find(p => p.public === false);
        expect(publicPlaylist).toBeDefined();
        expect(privatePlaylist).toBeDefined();
      });
    });
  });

  describe('Pagination structure', () => {
    it('should properly structure pagination metadata', async () => {
      await withCassette('my-playlists', recordingHttp, async () => {
        const result = await client.myPlaylists();

        // Validate pagination structure
        expect(typeof result.href).toBe('string');
        expect(typeof result.limit).toBe('number');
        expect(typeof result.offset).toBe('number');
        expect(typeof result.total).toBe('number');
        expect(Array.isArray(result.items)).toBe(true);

        // For this fixture, next and previous should be null
        expect(result.next).toBeNull();
        expect(result.previous).toBeNull();

        // Validate that limit matches what was requested
        expect(result.limit).toBe(20);
        expect(result.offset).toBe(0);

        // Validate total makes sense
        expect(result.total).toBeGreaterThanOrEqual(result.items.length);
      });
    });
  });
});
import { describe, it, expect } from 'vitest';
import {
  mapUser,
  mapArtist,
  mapTrack,
  mapAlbum,
  mapPlaylist,
  mapPlaybackState,
  parseTimestamp,
  formatTimestamp,
  formatDuration,
  extractSpotifyId,
  createSpotifyUri,
  isValidSpotifyUri,
  deduplicateById,
  sortByName,
  sortByPopularity,
} from '../../src/mappers.js';
import { testDataFactory } from '../helpers.js';

describe('mappers', () => {
  describe('mapUser', () => {
    it('should map user with all fields', () => {
      const user = testDataFactory.user({
        country: 'US',
        display_name: 'John Doe',
        email: 'john@example.com',
        explicit_content: {
          filter_enabled: true,
          filter_locked: false,
        },
        product: 'premium',
      });

      const mapped = mapUser(user);

      expect(mapped.country).toBe('US');
      expect(mapped.displayName).toBe('John Doe');
      expect(mapped.email).toBe('john@example.com');
      expect(mapped.explicitContent).toEqual({
        filterEnabled: true,
        filterLocked: false,
      });
      expect(mapped.product).toBe('premium');
      expect(mapped.externalUrls.spotify).toBe(user.external_urls.spotify);
      expect(mapped.followers.total).toBe(user.followers.total);
    });

    it('should map user with minimal fields', () => {
      const user = testDataFactory.user({
        display_name: null,
        country: undefined,
        email: undefined,
        explicit_content: undefined,
        product: undefined,
      });

      const mapped = mapUser(user);

      expect(mapped.displayName).toBeNull();
      expect(mapped.country).toBeUndefined();
      expect(mapped.email).toBeUndefined();
      expect(mapped.explicitContent).toBeUndefined();
      expect(mapped.product).toBeUndefined();
      expect(mapped.id).toBe(user.id);
    });
  });

  describe('mapArtist', () => {
    it('should map artist with all fields', () => {
      const artist = testDataFactory.artist({
        followers: { href: null, total: 1000000 },
        genres: ['pop', 'rock'],
        images: [{ url: 'https://example.com/image.jpg', height: 640, width: 640 }],
        popularity: 85,
      });

      const mapped = mapArtist(artist);

      expect(mapped.followers).toEqual({
        href: null,
        total: 1000000,
      });
      expect(mapped.genres).toEqual(['pop', 'rock']);
      expect(mapped.images).toEqual([{
        url: 'https://example.com/image.jpg',
        height: 640,
        width: 640,
      }]);
      expect(mapped.popularity).toBe(85);
      expect(mapped.name).toBe(artist.name);
    });

    it('should map artist with minimal fields', () => {
      const artist = testDataFactory.artist({
        followers: undefined,
        genres: undefined,
        images: undefined,
        popularity: undefined,
      });

      const mapped = mapArtist(artist);

      expect(mapped.followers).toBeUndefined();
      expect(mapped.genres).toBeUndefined();
      expect(mapped.images).toBeUndefined();
      expect(mapped.popularity).toBeUndefined();
      expect(mapped.name).toBe(artist.name);
    });
  });

  describe('mapTrack', () => {
    it('should map track with all fields', () => {
      const track = testDataFactory.track({
        external_ids: {
          isrc: 'USUM71703861',
          ean: '123456789012',
          upc: '123456789012',
        },
        linked_from: {
          external_urls: { spotify: 'https://open.spotify.com/track/linked' },
          href: 'https://api.spotify.com/v1/tracks/linked',
          id: 'linked-track-id',
          type: 'track',
          uri: 'spotify:track:linked-track-id',
        },
        restrictions: {
          reason: 'market',
        },
        is_playable: true,
        popularity: 75,
      });

      const mapped = mapTrack(track);

      expect(mapped.externalIds).toEqual({
        isrc: 'USUM71703861',
        ean: '123456789012',
        upc: '123456789012',
      });
      expect(mapped.linkedFrom).toEqual({
        externalUrls: { spotify: 'https://open.spotify.com/track/linked' },
        href: 'https://api.spotify.com/v1/tracks/linked',
        id: 'linked-track-id',
        type: 'track',
        uri: 'spotify:track:linked-track-id',
      });
      expect(mapped.restrictions).toEqual({ reason: 'market' });
      expect(mapped.isPlayable).toBe(true);
      expect(mapped.popularity).toBe(75);
      expect(mapped.durationMs).toBe(track.duration_ms);
      expect(mapped.trackNumber).toBe(track.track_number);
    });

    it('should map track with minimal fields', () => {
      const track = testDataFactory.track({
        album: undefined,
        external_ids: undefined,
        linked_from: undefined,
        restrictions: undefined,
        is_playable: undefined,
        popularity: undefined,
      });

      const mapped = mapTrack(track);

      expect(mapped.album).toBeUndefined();
      expect(mapped.externalIds).toBeUndefined();
      expect(mapped.linkedFrom).toBeUndefined();
      expect(mapped.restrictions).toBeUndefined();
      expect(mapped.isPlayable).toBeUndefined();
      expect(mapped.popularity).toBeUndefined();
      expect(mapped.name).toBe(track.name);
    });
  });

  describe('mapAlbum', () => {
    it('should map album with all fields', () => {
      const album = testDataFactory.album({
        tracks: {
          href: 'https://api.spotify.com/v1/albums/test/tracks',
          limit: 50,
          next: null,
          offset: 0,
          previous: null,
          total: 12,
          items: [testDataFactory.track()],
        },
        copyrights: [
          { text: '2023 Test Records', type: 'C' },
          { text: '2023 Test Publishing', type: 'P' },
        ],
        external_ids: { upc: '123456789012' },
        genres: ['pop', 'rock'],
        label: 'Test Records',
        popularity: 75,
      });

      const mapped = mapAlbum(album);

      expect(mapped.albumType).toBe(album.album_type);
      expect(mapped.totalTracks).toBe(album.total_tracks);
      expect(mapped.releaseDate).toBe(album.release_date);
      expect(mapped.releaseDatePrecision).toBe(album.release_date_precision);
      expect(mapped.tracks).toBeDefined();
      expect(mapped.tracks?.items).toHaveLength(1);
      expect(mapped.copyrights).toEqual([
        { text: '2023 Test Records', type: 'C' },
        { text: '2023 Test Publishing', type: 'P' },
      ]);
      expect(mapped.externalIds).toEqual({ upc: '123456789012' });
      expect(mapped.genres).toEqual(['pop', 'rock']);
      expect(mapped.label).toBe('Test Records');
      expect(mapped.popularity).toBe(75);
    });
  });

  describe('mapPlaylist', () => {
    it('should map playlist correctly', () => {
      const playlist = testDataFactory.playlist({
        collaborative: true,
        description: 'My awesome playlist',
        public: false,
      });

      const mapped = mapPlaylist(playlist);

      expect(mapped.collaborative).toBe(true);
      expect(mapped.description).toBe('My awesome playlist');
      expect(mapped.public).toBe(false);
      expect(mapped.snapshotId).toBe(playlist.snapshot_id);
      expect(mapped.owner).toBeDefined();
      expect(mapped.tracks.total).toBe(playlist.tracks.total);
    });
  });

  describe('mapPlaybackState', () => {
    it('should map playback state correctly', () => {
      const state = testDataFactory.playbackState({
        device: {
          id: 'device-123',
          is_active: true,
          is_private_session: false,
          is_restricted: false,
          name: 'My Speaker',
          type: 'Speaker',
          volume_percent: 80,
        },
        repeat_state: 'context',
        shuffle_state: true,
        progress_ms: 45000,
        is_playing: true,
      });

      const mapped = mapPlaybackState(state);

      expect(mapped.device.id).toBe('device-123');
      expect(mapped.device.isActive).toBe(true);
      expect(mapped.device.name).toBe('My Speaker');
      expect(mapped.device.volumePercent).toBe(80);
      expect(mapped.repeatState).toBe('context');
      expect(mapped.shuffleState).toBe(true);
      expect(mapped.progressMs).toBe(45000);
      expect(mapped.isPlaying).toBe(true);
      expect(mapped.currentlyPlayingType).toBe(state.currently_playing_type);
    });
  });

  describe('utility functions', () => {
    describe('parseTimestamp', () => {
      it('should parse ISO timestamp to Date', () => {
        const timestamp = '2023-12-25T10:30:00.000Z';
        const date = parseTimestamp(timestamp);
        expect(date).toBeInstanceOf(Date);
        expect(date.toISOString()).toBe(timestamp);
      });
    });

    describe('formatTimestamp', () => {
      it('should format millisecond timestamp to ISO string', () => {
        const timestampMs = 1703505000000;
        const formatted = formatTimestamp(timestampMs);
        expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(new Date(formatted).getTime()).toBe(timestampMs);
      });
    });

    describe('formatDuration', () => {
      it('should format duration in milliseconds to MM:SS', () => {
        expect(formatDuration(180000)).toBe('3:00');
        expect(formatDuration(125000)).toBe('2:05');
        expect(formatDuration(65000)).toBe('1:05');
        expect(formatDuration(5000)).toBe('0:05');
      });
    });

    describe('extractSpotifyId', () => {
      it('should extract ID from Spotify URI', () => {
        expect(extractSpotifyId('spotify:track:4uLU6hMCjMI75M1A2tKUQC')).toBe('4uLU6hMCjMI75M1A2tKUQC');
        expect(extractSpotifyId('spotify:album:1DFixLWuPkv3KT3TnV35m3')).toBe('1DFixLWuPkv3KT3TnV35m3');
        expect(extractSpotifyId('spotify:artist:0LcJLqbBmaGUft1e9Mm8HV')).toBe('0LcJLqbBmaGUft1e9Mm8HV');
      });
    });

    describe('createSpotifyUri', () => {
      it('should create Spotify URI from type and ID', () => {
        expect(createSpotifyUri('track', '4uLU6hMCjMI75M1A2tKUQC')).toBe('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
        expect(createSpotifyUri('album', '1DFixLWuPkv3KT3TnV35m3')).toBe('spotify:album:1DFixLWuPkv3KT3TnV35m3');
        expect(createSpotifyUri('artist', '0LcJLqbBmaGUft1e9Mm8HV')).toBe('spotify:artist:0LcJLqbBmaGUft1e9Mm8HV');
      });
    });

    describe('isValidSpotifyUri', () => {
      it('should validate correct Spotify URIs', () => {
        expect(isValidSpotifyUri('spotify:track:4uLU6hMCjMI75M1A2tKUQC')).toBe(true);
        expect(isValidSpotifyUri('spotify:album:1DFixLWuPkv3KT3TnV35m3')).toBe(true);
        expect(isValidSpotifyUri('spotify:artist:0LcJLqbBmaGUft1e9Mm8HV')).toBe(true);
        expect(isValidSpotifyUri('spotify:playlist:37i9dQZF1DX0XUsuxWHRQd')).toBe(true);
      });

      it('should reject invalid Spotify URIs', () => {
        expect(isValidSpotifyUri('invalid:track:123')).toBe(false);
        expect(isValidSpotifyUri('spotify:invalid')).toBe(false);
        expect(isValidSpotifyUri('spotify:track:')).toBe(false);
        expect(isValidSpotifyUri('track:123')).toBe(false);
        expect(isValidSpotifyUri('')).toBe(false);
      });
    });

    describe('deduplicateById', () => {
      it('should remove duplicates based on ID', () => {
        const items = [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
          { id: '1', name: 'Item 1 Duplicate' },
          { id: '3', name: 'Item 3' },
          { id: '2', name: 'Item 2 Duplicate' },
        ];

        const deduplicated = deduplicateById(items);

        expect(deduplicated).toHaveLength(3);
        expect(deduplicated.map(item => item.id)).toEqual(['1', '2', '3']);
        expect(deduplicated[0].name).toBe('Item 1'); // First occurrence kept
        expect(deduplicated[1].name).toBe('Item 2');
      });

      it('should handle empty array', () => {
        const result = deduplicateById([]);
        expect(result).toEqual([]);
      });

      it('should handle array with no duplicates', () => {
        const items = [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
          { id: '3', name: 'Item 3' },
        ];

        const result = deduplicateById(items);
        expect(result).toEqual(items);
      });
    });

    describe('sortByName', () => {
      it('should sort items by name in ascending order', () => {
        const items = [
          { name: 'Zebra' },
          { name: 'Apple' },
          { name: 'Banana' },
        ];

        const sorted = sortByName(items);

        expect(sorted.map(item => item.name)).toEqual(['Apple', 'Banana', 'Zebra']);
        expect(sorted).not.toBe(items); // Should not mutate original
      });

      it('should handle case-insensitive sorting', () => {
        const items = [
          { name: 'zebra' },
          { name: 'Apple' },
          { name: 'banana' },
        ];

        const sorted = sortByName(items);

        expect(sorted.map(item => item.name)).toEqual(['Apple', 'banana', 'zebra']);
      });
    });

    describe('sortByPopularity', () => {
      it('should sort items by popularity in descending order', () => {
        const items = [
          { popularity: 50 },
          { popularity: 90 },
          { popularity: 75 },
        ];

        const sorted = sortByPopularity(items);

        expect(sorted.map(item => item.popularity)).toEqual([90, 75, 50]);
        expect(sorted).not.toBe(items); // Should not mutate original
      });

      it('should handle items without popularity', () => {
        const items = [
          { popularity: 50 },
          {},
          { popularity: 75 },
        ];

        const sorted = sortByPopularity(items);

        expect(sorted.map(item => item.popularity ?? 0)).toEqual([75, 50, 0]);
      });

      it('should handle all items without popularity', () => {
        const items = [{}, {}, {}];
        const sorted = sortByPopularity(items);

        expect(sorted).toHaveLength(3);
        expect(sorted.every(item => (item.popularity ?? 0) === 0)).toBe(true);
      });
    });
  });
});
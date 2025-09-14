import { describe, it, expect } from 'vitest';
import { validateResponse, UserSchema, TrackSchema, AlbumSchema, PlaylistSchema } from '../../src/schemas.js';
import { testDataFactory } from '../helpers.js';

describe('schemas', () => {
  describe('validateResponse', () => {
    it('should validate and return data when schema matches', () => {
      const userData = testDataFactory.user();
      const result = validateResponse(userData, UserSchema);
      expect(result).toEqual(userData);
    });

    it('should throw error when data does not match schema', () => {
      const invalidData = { id: 123 }; // id should be string
      expect(() => validateResponse(invalidData, UserSchema)).toThrow('Schema validation failed');
    });

    it('should throw error with detailed message for validation failure', () => {
      const invalidData = {};
      try {
        validateResponse(invalidData, UserSchema);
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('Schema validation failed');
      }
    });
  });

  describe('UserSchema', () => {
    it('should validate complete user object', () => {
      const user = testDataFactory.user({
        country: 'US',
        display_name: 'John Doe',
        email: 'john@example.com',
        explicit_content: {
          filter_enabled: false,
          filter_locked: false,
        },
        product: 'premium',
      });

      const result = UserSchema.safeParse(user);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(user.id);
        expect(result.data.display_name).toBe(user.display_name);
        expect(result.data.email).toBe(user.email);
      }
    });

    it('should validate minimal user object', () => {
      const user = testDataFactory.user({
        display_name: null,
        country: undefined,
        email: undefined,
        explicit_content: undefined,
        product: undefined,
      });

      const result = UserSchema.safeParse(user);
      expect(result.success).toBe(true);
    });

    it('should reject user with invalid type', () => {
      const user = testDataFactory.user({ type: 'invalid' });
      const result = UserSchema.safeParse(user);
      expect(result.success).toBe(false);
    });
  });

  describe('TrackSchema', () => {
    it('should validate complete track object', () => {
      const track = testDataFactory.track({
        duration_ms: 180000,
        explicit: true,
        popularity: 85,
        preview_url: 'https://example.com/preview.mp3',
        external_ids: {
          isrc: 'USUM71703861',
          ean: '123456789012',
          upc: '123456789012',
        },
      });

      const result = TrackSchema.safeParse(track);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.duration_ms).toBe(180000);
        expect(result.data.explicit).toBe(true);
        expect(result.data.external_ids?.isrc).toBe('USUM71703861');
      }
    });

    it('should validate track with null preview_url', () => {
      const track = testDataFactory.track({ preview_url: null });
      const result = TrackSchema.safeParse(track);
      expect(result.success).toBe(true);
    });

    it('should reject track with invalid duration_ms', () => {
      const track = testDataFactory.track({ duration_ms: 'invalid' });
      const result = TrackSchema.safeParse(track);
      expect(result.success).toBe(false);
    });

    it('should validate track without optional fields', () => {
      const track = testDataFactory.track({
        album: undefined,
        external_ids: undefined,
        popularity: undefined,
        linked_from: undefined,
        restrictions: undefined,
        is_playable: undefined,
      });

      const result = TrackSchema.safeParse(track);
      expect(result.success).toBe(true);
    });
  });

  describe('AlbumSchema', () => {
    it('should validate complete album object', () => {
      const album = testDataFactory.album({
        album_type: 'album',
        release_date_precision: 'day',
        copyrights: [
          { text: '2023 Test Records', type: 'C' },
          { text: '2023 Test Publishing', type: 'P' },
        ],
        external_ids: {
          upc: '123456789012',
        },
        genres: ['pop', 'rock'],
        label: 'Test Records',
        popularity: 75,
      });

      const result = AlbumSchema.safeParse(album);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.album_type).toBe('album');
        expect(result.data.copyrights).toHaveLength(2);
        expect(result.data.genres).toEqual(['pop', 'rock']);
      }
    });

    it('should validate different album types', () => {
      const albumTypes = ['album', 'single', 'compilation'] as const;

      albumTypes.forEach(albumType => {
        const album = testDataFactory.album({ album_type: albumType });
        const result = AlbumSchema.safeParse(album);
        expect(result.success).toBe(true);
      });
    });

    it('should validate different release date precisions', () => {
      const precisions = ['year', 'month', 'day'] as const;

      precisions.forEach(precision => {
        const album = testDataFactory.album({ release_date_precision: precision });
        const result = AlbumSchema.safeParse(album);
        expect(result.success).toBe(true);
      });
    });

    it('should reject album with invalid album_type', () => {
      const album = testDataFactory.album({ album_type: 'invalid' });
      const result = AlbumSchema.safeParse(album);
      expect(result.success).toBe(false);
    });
  });

  describe('PlaylistSchema', () => {
    it('should validate complete playlist object', () => {
      const playlist = testDataFactory.playlist({
        collaborative: true,
        description: 'My awesome playlist',
        public: false,
      });

      const result = PlaylistSchema.safeParse(playlist);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collaborative).toBe(true);
        expect(result.data.description).toBe('My awesome playlist');
        expect(result.data.public).toBe(false);
      }
    });

    it('should validate playlist with null description', () => {
      const playlist = testDataFactory.playlist({ description: null });
      const result = PlaylistSchema.safeParse(playlist);
      expect(result.success).toBe(true);
    });

    it('should validate playlist with null public flag', () => {
      const playlist = testDataFactory.playlist({ public: null });
      const result = PlaylistSchema.safeParse(playlist);
      expect(result.success).toBe(true);
    });

    it('should reject playlist with invalid type', () => {
      const playlist = testDataFactory.playlist({ type: 'invalid' });
      const result = PlaylistSchema.safeParse(playlist);
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases and unknown fields', () => {
    it('should handle objects with unknown fields by including them', () => {
      const userWithUnknownFields = {
        ...testDataFactory.user(),
        unknown_field: 'should be included',
        nested_unknown: {
          field: 'value',
        },
      };

      const result = UserSchema.safeParse(userWithUnknownFields);
      expect(result.success).toBe(true);
      // Note: By default, Zod includes unknown fields unless .strict() is used
    });

    it('should handle empty arrays', () => {
      const track = testDataFactory.track({
        artists: [],
        available_markets: [],
      });

      const result = TrackSchema.safeParse(track);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artists).toEqual([]);
        expect(result.data.available_markets).toEqual([]);
      }
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const track = testDataFactory.track({ name: longString });

      const result = TrackSchema.safeParse(track);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe(longString);
      }
    });

    it('should handle unicode characters', () => {
      const unicodeName = '🎵 Test Track with émojis and ñ characters 中文';
      const track = testDataFactory.track({ name: unicodeName });

      const result = TrackSchema.safeParse(track);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe(unicodeName);
      }
    });
  });
});
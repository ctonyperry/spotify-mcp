import { z } from 'zod';

// Utility schemas
const PaginationSchema = z.object({
  href: z.string(),
  limit: z.number(),
  next: z.string().nullable(),
  offset: z.number(),
  previous: z.string().nullable(),
  total: z.number(),
});

const ImageSchema = z.object({
  url: z.string(),
  height: z.number().nullable(),
  width: z.number().nullable(),
});

const ExternalUrlsSchema = z.object({
  spotify: z.string(),
});

const ExternalIdsSchema = z.object({
  isrc: z.string().optional(),
  ean: z.string().optional(),
  upc: z.string().optional(),
});

const FollowersSchema = z.object({
  href: z.string().nullable(),
  total: z.number(),
});

const RestrictionsSchema = z.object({
  reason: z.string(),
});

// User schemas
export const UserSchema = z.object({
  country: z.string().optional(),
  display_name: z.string().nullable(),
  email: z.string().optional(),
  explicit_content: z.object({
    filter_enabled: z.boolean(),
    filter_locked: z.boolean(),
  }).optional(),
  external_urls: ExternalUrlsSchema,
  followers: FollowersSchema,
  href: z.string(),
  id: z.string(),
  images: z.array(ImageSchema),
  product: z.string().optional(),
  type: z.literal('user'),
  uri: z.string(),
});

// Artist schemas
export const ArtistSchema = z.object({
  external_urls: ExternalUrlsSchema,
  followers: FollowersSchema.optional(),
  genres: z.array(z.string()).optional(),
  href: z.string(),
  id: z.string(),
  images: z.array(ImageSchema).optional(),
  name: z.string(),
  popularity: z.number().optional(),
  type: z.literal('artist'),
  uri: z.string(),
});

// Album schemas
const AlbumTypeSchema = z.enum(['album', 'single', 'compilation']);
const ReleaseDatePrecisionSchema = z.enum(['year', 'month', 'day']);

export const AlbumSchema = z.object({
  album_type: AlbumTypeSchema,
  total_tracks: z.number(),
  available_markets: z.array(z.string()),
  external_urls: ExternalUrlsSchema,
  href: z.string(),
  id: z.string(),
  images: z.array(ImageSchema),
  name: z.string(),
  release_date: z.string(),
  release_date_precision: ReleaseDatePrecisionSchema,
  restrictions: RestrictionsSchema.optional(),
  type: z.literal('album'),
  uri: z.string(),
  artists: z.array(ArtistSchema),
  tracks: z.object({
    href: z.string(),
    limit: z.number(),
    next: z.string().nullable(),
    offset: z.number(),
    previous: z.string().nullable(),
    total: z.number(),
    items: z.array(z.object({
      artists: z.array(ArtistSchema),
      available_markets: z.array(z.string()),
      disc_number: z.number(),
      duration_ms: z.number(),
      explicit: z.boolean(),
      external_urls: ExternalUrlsSchema,
      href: z.string(),
      id: z.string(),
      is_playable: z.boolean().optional(),
      linked_from: z.object({
        external_urls: ExternalUrlsSchema,
        href: z.string(),
        id: z.string(),
        type: z.string(),
        uri: z.string(),
      }).optional(),
      restrictions: RestrictionsSchema.optional(),
      name: z.string(),
      preview_url: z.string().nullable(),
      track_number: z.number(),
      type: z.literal('track'),
      uri: z.string(),
      is_local: z.boolean(),
    })),
  }).optional(),
  copyrights: z.array(z.object({
    text: z.string(),
    type: z.string(),
  })).optional(),
  external_ids: ExternalIdsSchema.optional(),
  genres: z.array(z.string()).optional(),
  label: z.string().optional(),
  popularity: z.number().optional(),
});

// Track schemas
export const TrackSchema = z.object({
  album: AlbumSchema.optional(),
  artists: z.array(ArtistSchema),
  available_markets: z.array(z.string()),
  disc_number: z.number(),
  duration_ms: z.number(),
  explicit: z.boolean(),
  external_ids: ExternalIdsSchema.optional(),
  external_urls: ExternalUrlsSchema,
  href: z.string(),
  id: z.string(),
  is_playable: z.boolean().optional(),
  linked_from: z.object({
    external_urls: ExternalUrlsSchema,
    href: z.string(),
    id: z.string(),
    type: z.string(),
    uri: z.string(),
  }).optional(),
  restrictions: RestrictionsSchema.optional(),
  name: z.string(),
  popularity: z.number().optional(),
  preview_url: z.string().nullable(),
  track_number: z.number(),
  type: z.literal('track'),
  uri: z.string(),
  is_local: z.boolean(),
});

// Device schemas
export const DeviceSchema = z.object({
  id: z.string().nullable(),
  is_active: z.boolean(),
  is_private_session: z.boolean(),
  is_restricted: z.boolean(),
  name: z.string(),
  type: z.string(),
  volume_percent: z.number().nullable(),
});

// Playback schemas
export const PlaybackStateSchema = z.object({
  device: DeviceSchema,
  repeat_state: z.enum(['off', 'track', 'context']),
  shuffle_state: z.boolean(),
  context: z.object({
    type: z.string(),
    href: z.string(),
    external_urls: ExternalUrlsSchema,
    uri: z.string(),
  }).nullable(),
  timestamp: z.number(),
  progress_ms: z.number().nullable(),
  is_playing: z.boolean(),
  item: TrackSchema.nullable(),
  currently_playing_type: z.enum(['track', 'episode', 'ad', 'unknown']),
  actions: z.object({
    interrupting_playback: z.boolean().optional(),
    pausing: z.boolean().optional(),
    resuming: z.boolean().optional(),
    seeking: z.boolean().optional(),
    skipping_next: z.boolean().optional(),
    skipping_prev: z.boolean().optional(),
    toggling_repeat_context: z.boolean().optional(),
    toggling_shuffle: z.boolean().optional(),
    toggling_repeat_track: z.boolean().optional(),
    transferring_playback: z.boolean().optional(),
  }),
});

// Playlist schemas
export const PlaylistSchema = z.object({
  collaborative: z.boolean(),
  description: z.string().nullable(),
  external_urls: ExternalUrlsSchema,
  followers: FollowersSchema,
  href: z.string(),
  id: z.string(),
  images: z.array(ImageSchema),
  name: z.string(),
  owner: UserSchema,
  public: z.boolean().nullable(),
  snapshot_id: z.string(),
  tracks: z.object({
    href: z.string(),
    total: z.number(),
  }),
  type: z.literal('playlist'),
  uri: z.string(),
});

export const PlaylistTrackSchema = z.object({
  added_at: z.string().nullable(),
  added_by: UserSchema.nullable(),
  is_local: z.boolean(),
  track: TrackSchema.nullable(),
});

// Search schemas
export const SearchResultSchema = z.object({
  tracks: z.object({
    ...PaginationSchema.shape,
    items: z.array(TrackSchema),
  }).optional(),
  artists: z.object({
    ...PaginationSchema.shape,
    items: z.array(ArtistSchema),
  }).optional(),
  albums: z.object({
    ...PaginationSchema.shape,
    items: z.array(AlbumSchema),
  }).optional(),
  playlists: z.object({
    ...PaginationSchema.shape,
    items: z.array(PlaylistSchema),
  }).optional(),
});

// Saved item schemas
export const SavedTrackSchema = z.object({
  added_at: z.string(),
  track: TrackSchema,
});

export const SavedAlbumSchema = z.object({
  added_at: z.string(),
  album: AlbumSchema,
});

// Play history schemas
export const PlayHistorySchema = z.object({
  track: TrackSchema,
  played_at: z.string(),
  context: z.object({
    type: z.string(),
    href: z.string(),
    external_urls: ExternalUrlsSchema,
    uri: z.string(),
  }).nullable(),
});

// Paginated response schemas
export const PaginatedTracksSchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(TrackSchema),
});

export const PaginatedAlbumsSchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(AlbumSchema),
});

export const PaginatedPlaylistsSchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(PlaylistSchema),
});

export const PaginatedPlaylistTracksSchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(PlaylistTrackSchema),
});

export const PaginatedSavedTracksSchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(SavedTrackSchema),
});

export const PaginatedSavedAlbumsSchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(SavedAlbumSchema),
});

export const PaginatedPlayHistorySchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(PlayHistorySchema),
});

// Utility schema for striping unknown fields
export function stripUnknown<T extends z.ZodTypeAny>(schema: T) {
  return schema.strict();
}

// Request/Response validation helpers
export function validateResponse<T>(data: unknown, schema: z.ZodSchema<T>): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${result.error.message}`);
  }
  return result.data;
}
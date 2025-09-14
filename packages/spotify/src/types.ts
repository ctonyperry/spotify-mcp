import { z } from 'zod';
import {
  UserSchema,
  ArtistSchema,
  AlbumSchema,
  TrackSchema,
  DeviceSchema,
  PlaybackStateSchema,
  PlaylistSchema,
  PlaylistTrackSchema,
  SearchResultSchema,
  SavedTrackSchema,
  SavedAlbumSchema,
  PlayHistorySchema,
  PaginatedTracksSchema,
  PaginatedAlbumsSchema,
  PaginatedPlaylistsSchema,
  PaginatedPlaylistTracksSchema,
  PaginatedSavedTracksSchema,
  PaginatedSavedAlbumsSchema,
  PaginatedPlayHistorySchema,
} from './schemas.js';

// Core Spotify API types
export type User = z.infer<typeof UserSchema>;
export type Artist = z.infer<typeof ArtistSchema>;
export type Album = z.infer<typeof AlbumSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type PlaybackState = z.infer<typeof PlaybackStateSchema>;
export type Playlist = z.infer<typeof PlaylistSchema>;
export type PlaylistTrack = z.infer<typeof PlaylistTrackSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SavedTrack = z.infer<typeof SavedTrackSchema>;
export type SavedAlbum = z.infer<typeof SavedAlbumSchema>;
export type PlayHistory = z.infer<typeof PlayHistorySchema>;

// Paginated types
export type Page<T> = {
  href: string;
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
  items: T[];
};

export type PaginatedTracks = z.infer<typeof PaginatedTracksSchema>;
export type PaginatedAlbums = z.infer<typeof PaginatedAlbumsSchema>;
export type PaginatedPlaylists = z.infer<typeof PaginatedPlaylistsSchema>;
export type PaginatedPlaylistTracks = z.infer<typeof PaginatedPlaylistTracksSchema>;
export type PaginatedSavedTracks = z.infer<typeof PaginatedSavedTracksSchema>;
export type PaginatedSavedAlbums = z.infer<typeof PaginatedSavedAlbumsSchema>;
export type PaginatedPlayHistory = z.infer<typeof PaginatedPlayHistorySchema>;

// Request parameter types
export interface PageParams {
  limit?: number;
  offset?: number;
}

export interface SearchParams extends PageParams {
  q: string;
  types: Array<'track' | 'album' | 'artist' | 'playlist'>;
}

export interface PlaybackControlParams {
  action: 'play' | 'pause' | 'next' | 'previous';
  deviceId?: string;
}

export interface CreatePlaylistParams {
  userId: string;
  name: string;
  description?: string;
  public?: boolean;
}

export interface AddTracksToPlaylistParams {
  playlistId: string;
  uris: string[];
}

export interface AddToQueueParams {
  uri: string;
  deviceId?: string;
}

export interface RecentlyPlayedParams {
  afterMs?: number;
  beforeMs?: number;
  limit?: number;
}

// Normalized types with camelCase conversion
export interface NormalizedUser {
  country?: string;
  displayName: string | null;
  email?: string;
  explicitContent?: {
    filterEnabled: boolean;
    filterLocked: boolean;
  };
  externalUrls: {
    spotify: string;
  };
  followers: {
    href: string | null;
    total: number;
  };
  href: string;
  id: string;
  images: Array<{
    url: string;
    height: number | null;
    width: number | null;
  }>;
  product?: string;
  type: 'user';
  uri: string;
}

export interface NormalizedTrack {
  album?: NormalizedAlbum;
  artists: NormalizedArtist[];
  availableMarkets: string[];
  discNumber: number;
  durationMs: number;
  explicit: boolean;
  externalIds?: {
    isrc?: string;
    ean?: string;
    upc?: string;
  };
  externalUrls: {
    spotify: string;
  };
  href: string;
  id: string;
  isPlayable?: boolean;
  linkedFrom?: {
    externalUrls: { spotify: string };
    href: string;
    id: string;
    type: string;
    uri: string;
  };
  restrictions?: {
    reason: string;
  };
  name: string;
  popularity?: number;
  previewUrl: string | null;
  trackNumber: number;
  type: 'track';
  uri: string;
  isLocal: boolean;
}

export interface NormalizedArtist {
  externalUrls: {
    spotify: string;
  };
  followers?: {
    href: string | null;
    total: number;
  };
  genres?: string[];
  href: string;
  id: string;
  images?: Array<{
    url: string;
    height: number | null;
    width: number | null;
  }>;
  name: string;
  popularity?: number;
  type: 'artist';
  uri: string;
}

export interface NormalizedAlbum {
  albumType: 'album' | 'single' | 'compilation';
  totalTracks: number;
  availableMarkets: string[];
  externalUrls: {
    spotify: string;
  };
  href: string;
  id: string;
  images: Array<{
    url: string;
    height: number | null;
    width: number | null;
  }>;
  name: string;
  releaseDate: string;
  releaseDatePrecision: 'year' | 'month' | 'day';
  restrictions?: {
    reason: string;
  };
  type: 'album';
  uri: string;
  artists: NormalizedArtist[];
  tracks?: {
    href: string;
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
    items: NormalizedTrack[];
  };
  copyrights?: Array<{
    text: string;
    type: string;
  }>;
  externalIds?: {
    isrc?: string;
    ean?: string;
    upc?: string;
  };
  genres?: string[];
  label?: string;
  popularity?: number;
}

export interface NormalizedPlaylist {
  collaborative: boolean;
  description: string | null;
  externalUrls: {
    spotify: string;
  };
  followers: {
    href: string | null;
    total: number;
  };
  href: string;
  id: string;
  images: Array<{
    url: string;
    height: number | null;
    width: number | null;
  }>;
  name: string;
  owner: NormalizedUser;
  public: boolean | null;
  snapshotId: string;
  tracks: {
    href: string;
    total: number;
  };
  type: 'playlist';
  uri: string;
}

export interface NormalizedPlaybackState {
  device: {
    id: string | null;
    isActive: boolean;
    isPrivateSession: boolean;
    isRestricted: boolean;
    name: string;
    type: string;
    volumePercent: number | null;
  };
  repeatState: 'off' | 'track' | 'context';
  shuffleState: boolean;
  context: {
    type: string;
    href: string;
    externalUrls: { spotify: string };
    uri: string;
  } | null;
  timestamp: number;
  progressMs: number | null;
  isPlaying: boolean;
  item: NormalizedTrack | null;
  currentlyPlayingType: 'track' | 'episode' | 'ad' | 'unknown';
  actions: {
    interruptingPlayback?: boolean;
    pausing?: boolean;
    resuming?: boolean;
    seeking?: boolean;
    skippingNext?: boolean;
    skippingPrev?: boolean;
    togglingRepeatContext?: boolean;
    togglingShuffle?: boolean;
    togglingRepeatTrack?: boolean;
    transferringPlayback?: boolean;
  };
}

// Client interface type
export interface SpotifyClient {
  getMe(): Promise<NormalizedUser>;
  playbackState(): Promise<NormalizedPlaybackState>;
  playbackControl(params: PlaybackControlParams): Promise<void>;
  search(params: SearchParams): Promise<SearchResult>;
  myPlaylists(params?: PageParams): Promise<Page<NormalizedPlaylist>>;
  playlistTracks(id: string, params?: PageParams): Promise<Page<NormalizedTrack>>;
  createPlaylist(params: CreatePlaylistParams): Promise<NormalizedPlaylist>;
  addTracksToPlaylist(params: AddTracksToPlaylistParams): Promise<void>;
  addToQueue(params: AddToQueueParams): Promise<void>;
  recentlyPlayed(params?: RecentlyPlayedParams): Promise<Page<PlayHistory>>;
  savedTracks(params?: PageParams): Promise<Page<SavedTrack>>;
  savedAlbums(params?: PageParams): Promise<Page<SavedAlbum>>;
  albums(ids: string[]): Promise<NormalizedAlbum[]>;
  albumTracks(id: string, params?: PageParams): Promise<Page<NormalizedTrack>>;
  checkSavedTracks(ids: string[]): Promise<boolean[]>;
  checkSavedAlbums(ids: string[]): Promise<boolean[]>;
}

// Dependencies interface for client creation
export interface SpotifyClientDeps {
  baseUrl?: string;
  getAccessToken: () => Promise<string>;
  http: HttpLike;
  logger: LoggerLike;
  rateLimiter?: RateLimiterLike;
}

// External dependencies interfaces
export interface HttpLike {
  fetchJSON<T = unknown>(url: string, options?: any): Promise<T>;
  setHooks?(hooks: any): void;
}

export interface LoggerLike {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

export interface RateLimiterLike {
  checkLimit(): Promise<void>;
  updateLimit(retryAfterMs: number): void;
}
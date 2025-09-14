import type {
  User,
  Artist,
  Album,
  Track,
  Playlist,
  PlaybackState,
  NormalizedUser,
  NormalizedArtist,
  NormalizedAlbum,
  NormalizedTrack,
  NormalizedPlaylist,
  NormalizedPlaybackState,
} from './types.js';

/**
 * Converts snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively converts object keys from snake_case to camelCase
 */
function convertKeysToCamelCase<T>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysToCamelCase(item)) as T;
  }

  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = toCamelCase(key);
      converted[camelKey] = convertKeysToCamelCase(value);
    }
    return converted;
  }

  return obj;
}

/**
 * Maps User from API response to normalized format
 */
export function mapUser(user: User): NormalizedUser {
  return {
    country: user.country,
    displayName: user.display_name,
    email: user.email,
    explicitContent: user.explicit_content
      ? {
          filterEnabled: user.explicit_content.filter_enabled,
          filterLocked: user.explicit_content.filter_locked,
        }
      : undefined,
    externalUrls: {
      spotify: user.external_urls.spotify,
    },
    followers: {
      href: user.followers.href,
      total: user.followers.total,
    },
    href: user.href,
    id: user.id,
    images: user.images.map(img => ({
      url: img.url,
      height: img.height,
      width: img.width,
    })),
    product: user.product,
    type: user.type,
    uri: user.uri,
  };
}

/**
 * Maps Artist from API response to normalized format
 */
export function mapArtist(artist: Artist): NormalizedArtist {
  return {
    externalUrls: {
      spotify: artist.external_urls.spotify,
    },
    followers: artist.followers
      ? {
          href: artist.followers.href,
          total: artist.followers.total,
        }
      : undefined,
    genres: artist.genres,
    href: artist.href,
    id: artist.id,
    images: artist.images?.map(img => ({
      url: img.url,
      height: img.height,
      width: img.width,
    })),
    name: artist.name,
    popularity: artist.popularity,
    type: artist.type,
    uri: artist.uri,
  };
}

/**
 * Maps Track from API response to normalized format
 */
export function mapTrack(track: Track): NormalizedTrack {
  return {
    album: track.album ? mapAlbum(track.album) : undefined,
    artists: track.artists.map(mapArtist),
    availableMarkets: track.available_markets,
    discNumber: track.disc_number,
    durationMs: track.duration_ms,
    explicit: track.explicit,
    externalIds: track.external_ids
      ? {
          isrc: track.external_ids.isrc,
          ean: track.external_ids.ean,
          upc: track.external_ids.upc,
        }
      : undefined,
    externalUrls: {
      spotify: track.external_urls.spotify,
    },
    href: track.href,
    id: track.id,
    isPlayable: track.is_playable,
    linkedFrom: track.linked_from
      ? {
          externalUrls: { spotify: track.linked_from.external_urls.spotify },
          href: track.linked_from.href,
          id: track.linked_from.id,
          type: track.linked_from.type,
          uri: track.linked_from.uri,
        }
      : undefined,
    restrictions: track.restrictions
      ? {
          reason: track.restrictions.reason,
        }
      : undefined,
    name: track.name,
    popularity: track.popularity,
    previewUrl: track.preview_url,
    trackNumber: track.track_number,
    type: track.type,
    uri: track.uri,
    isLocal: track.is_local,
  };
}

/**
 * Maps Album from API response to normalized format
 */
export function mapAlbum(album: Album): NormalizedAlbum {
  return {
    albumType: album.album_type,
    totalTracks: album.total_tracks,
    availableMarkets: album.available_markets,
    externalUrls: {
      spotify: album.external_urls.spotify,
    },
    href: album.href,
    id: album.id,
    images: album.images.map(img => ({
      url: img.url,
      height: img.height,
      width: img.width,
    })),
    name: album.name,
    releaseDate: album.release_date,
    releaseDatePrecision: album.release_date_precision,
    restrictions: album.restrictions
      ? {
          reason: album.restrictions.reason,
        }
      : undefined,
    type: album.type,
    uri: album.uri,
    artists: album.artists.map(mapArtist),
    tracks: album.tracks
      ? {
          href: album.tracks.href,
          limit: album.tracks.limit,
          next: album.tracks.next,
          offset: album.tracks.offset,
          previous: album.tracks.previous,
          total: album.tracks.total,
          items: album.tracks.items.map(mapTrack),
        }
      : undefined,
    copyrights: album.copyrights?.map(copyright => ({
      text: copyright.text,
      type: copyright.type,
    })),
    externalIds: album.external_ids
      ? {
          isrc: album.external_ids.isrc,
          ean: album.external_ids.ean,
          upc: album.external_ids.upc,
        }
      : undefined,
    genres: album.genres,
    label: album.label,
    popularity: album.popularity,
  };
}

/**
 * Maps Playlist from API response to normalized format
 */
export function mapPlaylist(playlist: Playlist): NormalizedPlaylist {
  return {
    collaborative: playlist.collaborative,
    description: playlist.description,
    externalUrls: {
      spotify: playlist.external_urls.spotify,
    },
    followers: {
      href: playlist.followers.href,
      total: playlist.followers.total,
    },
    href: playlist.href,
    id: playlist.id,
    images: playlist.images.map(img => ({
      url: img.url,
      height: img.height,
      width: img.width,
    })),
    name: playlist.name,
    owner: mapUser(playlist.owner),
    public: playlist.public,
    snapshotId: playlist.snapshot_id,
    tracks: {
      href: playlist.tracks.href,
      total: playlist.tracks.total,
    },
    type: playlist.type,
    uri: playlist.uri,
  };
}

/**
 * Maps PlaybackState from API response to normalized format
 */
export function mapPlaybackState(state: PlaybackState): NormalizedPlaybackState {
  return {
    device: {
      id: state.device.id,
      isActive: state.device.is_active,
      isPrivateSession: state.device.is_private_session,
      isRestricted: state.device.is_restricted,
      name: state.device.name,
      type: state.device.type,
      volumePercent: state.device.volume_percent,
    },
    repeatState: state.repeat_state,
    shuffleState: state.shuffle_state,
    context: state.context
      ? {
          type: state.context.type,
          href: state.context.href,
          externalUrls: { spotify: state.context.external_urls.spotify },
          uri: state.context.uri,
        }
      : null,
    timestamp: state.timestamp,
    progressMs: state.progress_ms,
    isPlaying: state.is_playing,
    item: state.item ? mapTrack(state.item) : null,
    currentlyPlayingType: state.currently_playing_type,
    actions: {
      interruptingPlayback: state.actions.interrupting_playback,
      pausing: state.actions.pausing,
      resuming: state.actions.resuming,
      seeking: state.actions.seeking,
      skippingNext: state.actions.skipping_next,
      skippingPrev: state.actions.skipping_prev,
      togglingRepeatContext: state.actions.toggling_repeat_context,
      togglingShuffle: state.actions.toggling_shuffle,
      togglingRepeatTrack: state.actions.toggling_repeat_track,
      transferringPlayback: state.actions.transferring_playback,
    },
  };
}

/**
 * Converts ISO timestamp strings to Date objects
 */
export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}

/**
 * Converts millisecond timestamps to ISO strings
 */
export function formatTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

/**
 * Formats duration from milliseconds to human-readable format
 */
export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Extracts Spotify ID from URI
 */
export function extractSpotifyId(uri: string): string {
  const parts = uri.split(':');
  return parts[parts.length - 1];
}

/**
 * Creates Spotify URI from type and ID
 */
export function createSpotifyUri(type: string, id: string): string {
  return `spotify:${type}:${id}`;
}

/**
 * Validates Spotify URI format
 */
export function isValidSpotifyUri(uri: string): boolean {
  const pattern = /^spotify:[a-z]+:[a-zA-Z0-9]+$/;
  return pattern.test(uri);
}

/**
 * Removes duplicates from an array of items with IDs
 */
export function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

/**
 * Sorts items by name in ascending order
 */
export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sorts items by popularity in descending order
 */
export function sortByPopularity<T extends { popularity?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aPopularity = a.popularity ?? 0;
    const bPopularity = b.popularity ?? 0;
    return bPopularity - aPopularity;
  });
}
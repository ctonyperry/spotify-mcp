/**
 * Canonical test cases for functional parity
 */

import type { TestCase } from './types.js';

/**
 * Normalizers to make outputs comparable
 */
const normalizers = {
  /**
   * Sort arrays by stable keys and normalize field names
   */
  searchResults: (output: any) => {
    if (!output || !output.tracks?.items) return output;

    return {
      ...output,
      tracks: {
        ...output.tracks,
        items: output.tracks.items
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            uri: item.uri,
            artists: item.artists?.map((a: any) => a.name).sort(),
            duration_ms: item.duration_ms,
            explicit: item.explicit,
            popularity: item.popularity,
          }))
          .sort((a: any, b: any) => a.id.localeCompare(b.id))
      }
    };
  },

  /**
   * Normalize playback state - drop timestamp fields, normalize device info
   */
  playbackState: (output: any) => {
    if (!output) return output;

    return {
      is_playing: output.is_playing || false,
      item: output.item ? {
        id: output.item.id,
        name: output.item.name,
        uri: output.item.uri,
        artists: output.item.artists?.map((a: any) => a.name).sort(),
      } : null,
      device: output.device ? {
        id: output.device.id,
        name: output.device.name,
        type: output.device.type,
        is_active: output.device.is_active,
      } : null,
      // Drop progress_ms, timestamp fields for comparison
    };
  },

  /**
   * Normalize playlists - sort by id, drop user-specific data
   */
  playlists: (output: any) => {
    if (!output || !output.items) return output;

    return {
      ...output,
      items: output.items
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          uri: item.uri,
          description: item.description,
          public: item.public,
          collaborative: item.collaborative,
          tracks: item.tracks ? { total: item.tracks.total } : undefined,
        }))
        .sort((a: any, b: any) => a.id.localeCompare(b.id))
    };
  },

  /**
   * Normalize playlist tracks - sort by position, clean track data
   */
  playlistTracks: (output: any) => {
    if (!output || !output.items) return output;

    return {
      ...output,
      items: output.items
        .map((item: any, index: number) => ({
          position: index,
          track: item.track ? {
            id: item.track.id,
            name: item.track.name,
            uri: item.track.uri,
            artists: item.track.artists?.map((a: any) => a.name).sort(),
          } : null,
        }))
        .sort((a: any, b: any) => a.position - b.position)
    };
  },

  /**
   * Normalize library tracks check - ensure consistent boolean array
   */
  tracksCheck: (output: any) => {
    if (Array.isArray(output)) {
      return output.map(Boolean).sort();
    }
    if (output && output.results) {
      return output.results.map((r: any) => Boolean(r.saved)).sort();
    }
    return output;
  },

  /**
   * Simple passthrough for control operations
   */
  passthrough: (output: any) => output,

  /**
   * Normalize albums - sort by id, clean data
   */
  albums: (output: any) => {
    if (!output) return output;

    if (Array.isArray(output)) {
      return output
        .map((album: any) => ({
          id: album.id,
          name: album.name,
          uri: album.uri,
          artists: album.artists?.map((a: any) => a.name).sort(),
          release_date: album.release_date,
          total_tracks: album.total_tracks,
        }))
        .sort((a: any, b: any) => a.id.localeCompare(b.id));
    }

    if (output.albums) {
      return {
        ...output,
        albums: normalizers.albums(output.albums)
      };
    }

    return output;
  }
};

/**
 * Canonical test cases with stable, deterministic inputs
 */
export const testCases: TestCase[] = [
  {
    name: 'tracks.search.sandstorm',
    description: 'Search for tracks with query "sandstorm" (limit 5)',
    newServerCall: {
      toolName: 'tracks.search',
      args: { query: 'sandstorm', limit: 5 },
    },
    legacyServerCall: {
      toolName: 'searchSpotify',
      args: { query: 'sandstorm', type: 'track', limit: 5 },
    },
    normalizer: normalizers.searchResults,
  },

  {
    name: 'playback.state.get',
    description: 'Get current playback state',
    newServerCall: {
      toolName: 'playback.state.get',
      args: {},
    },
    legacyServerCall: {
      toolName: 'getNowPlaying',
      args: {},
    },
    normalizer: normalizers.playbackState,
  },

  {
    name: 'playlists.list.mine',
    description: 'List user playlists (limit 5)',
    newServerCall: {
      toolName: 'playlists.list.mine',
      args: { limit: 5 },
    },
    legacyServerCall: {
      toolName: 'getMyPlaylists',
      args: { limit: 5 },
    },
    normalizer: normalizers.playlists,
  },

  {
    name: 'library.saved.tracks.get',
    description: 'Get saved tracks (limit 5)',
    newServerCall: {
      toolName: 'library.saved.tracks.get',
      args: { limit: 5 },
    },
    legacyServerCall: {
      toolName: 'getUsersSavedTracks',
      args: { limit: 5 },
    },
    normalizer: normalizers.playlistTracks, // Similar structure
  },

  {
    name: 'albums.search.daft_punk',
    description: 'Search for albums with query "daft punk" (limit 5)',
    newServerCall: {
      toolName: 'albums.search',
      args: { query: 'daft punk', limit: 5 },
    },
    legacyServerCall: {
      toolName: 'searchSpotify',
      args: { query: 'daft punk', type: 'album', limit: 5 },
    },
    normalizer: (output: any) => {
      if (!output || !output.albums?.items) return output;
      return normalizers.albums(output.albums.items);
    },
  },

  // Note: Dry-run and queue tests will likely show differences
  // as they may not be implemented identically. We'll document these.
  {
    name: 'queue.add.dry_run',
    description: 'Add track to queue (test with known URI)',
    newServerCall: {
      toolName: 'queue.add',
      args: { uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh' }, // "Never Gonna Give You Up"
    },
    legacyServerCall: {
      toolName: 'addToQueue',
      args: { uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh' },
    },
    normalizer: normalizers.passthrough,
  },
];

/**
 * Get test cases by name filter
 */
export function getTestCases(filter: string = 'default'): TestCase[] {
  if (filter === 'default') {
    // Skip potentially destructive or auth-dependent tests by default
    return testCases.filter(tc =>
      !tc.name.includes('queue.add') &&
      !tc.name.includes('playlist.tracks.add')
    );
  }

  if (filter === 'all') {
    return testCases;
  }

  // Filter by name pattern
  return testCases.filter(tc => tc.name.includes(filter));
}
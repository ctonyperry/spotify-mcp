/**
 * Ports define the interfaces that the app layer must implement to provide
 * external capabilities to the core domain services.
 */

export interface TimePort {
  /**
   * Get current time in milliseconds since epoch
   */
  nowMs(): number;
}

export interface RandomPort {
  /**
   * Pick a random item from an array
   * Allows injection of seeded RNG for deterministic testing
   */
  pick<T>(items: T[]): T;

  /**
   * Generate a random number between 0 and 1
   */
  random(): number;

  /**
   * Shuffle an array in place
   */
  shuffle<T>(items: T[]): T[];
}

export interface PlaylistPort {
  /**
   * Check if a playlist exists and is accessible
   * Returns null if not found or not accessible
   */
  getPlaylistInfo(id: string): Promise<{
    id: string;
    name: string;
    trackCount: number;
    owner: string;
    collaborative: boolean;
  } | null>;

  /**
   * Get current tracks in a playlist
   * Data should already be fetched by adapters at app layer
   */
  getPlaylistTracks(id: string): Promise<import('./types.js').TrackRef[]>;
}

export interface SearchPort {
  /**
   * Execute search with normalized parameters
   * Returns pre-fetched track data from adapters
   */
  searchTracks(params: {
    query: string;
    limit: number;
    offset: number;
    filters?: Record<string, any>;
  }): Promise<import('./types.js').Page<import('./types.js').TrackRef>>;
}

export interface LibraryPort {
  /**
   * Get current saved tracks/albums for the user
   * Data should already be fetched by adapters at app layer
   */
  getSavedTrackIds(): Promise<string[]>;
  getSavedAlbumIds(): Promise<string[]>;
}

/**
 * Default implementations for testing and simple use cases
 */
export class SystemTimePort implements TimePort {
  nowMs(): number {
    return Date.now();
  }
}

export class SystemRandomPort implements RandomPort {
  pick<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return items[Math.floor(Math.random() * items.length)];
  }

  random(): number {
    return Math.random();
  }

  shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Seeded random port for deterministic testing
 */
export class SeededRandomPort implements RandomPort {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  pick<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return items[Math.floor(this.random() * items.length)];
  }

  random(): number {
    // Simple LCG implementation for deterministic random numbers
    this.seed = (this.seed * 1664525 + 1013904223) % (2 ** 32);
    return this.seed / (2 ** 32);
  }

  shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Fixed time port for testing
 */
export class FixedTimePort implements TimePort {
  constructor(private readonly timeMs: number) {}

  nowMs(): number {
    return this.timeMs;
  }
}
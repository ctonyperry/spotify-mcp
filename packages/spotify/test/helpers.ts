import type { LoggerLike, RateLimiterLike, HttpLike } from '../src/types.js';

/**
 * Mock logger for tests
 */
export class MockLogger implements LoggerLike {
  public logs: Array<{ level: string; message: string; meta?: any }> = [];

  debug(message: string, meta?: any): void {
    this.logs.push({ level: 'debug', message, meta });
  }

  info(message: string, meta?: any): void {
    this.logs.push({ level: 'info', message, meta });
  }

  warn(message: string, meta?: any): void {
    this.logs.push({ level: 'warn', message, meta });
  }

  error(message: string, meta?: any): void {
    this.logs.push({ level: 'error', message, meta });
  }

  clear(): void {
    this.logs = [];
  }

  hasLog(level: string, messagePattern: string | RegExp): boolean {
    return this.logs.some(log => {
      if (log.level !== level) return false;

      if (typeof messagePattern === 'string') {
        return log.message.includes(messagePattern);
      }
      return messagePattern.test(log.message);
    });
  }
}

/**
 * Mock rate limiter for tests
 */
export class MockRateLimiter implements RateLimiterLike {
  private shouldThrow = false;
  private retryAfterMs = 0;

  async checkLimit(): Promise<void> {
    if (this.shouldThrow) {
      const error = new Error('Rate limit exceeded');
      (error as any).retryAfterMs = this.retryAfterMs;
      throw error;
    }
  }

  updateLimit(retryAfterMs: number): void {
    this.retryAfterMs = retryAfterMs;
  }

  setRateLimited(isRateLimited: boolean, retryAfterMs = 1000): void {
    this.shouldThrow = isRateLimited;
    this.retryAfterMs = retryAfterMs;
  }

  reset(): void {
    this.shouldThrow = false;
    this.retryAfterMs = 0;
  }
}

/**
 * Mock HTTP client for unit tests
 */
export class MockHttpClient implements HttpLike {
  private responses = new Map<string, any[]>();
  private responseIndex = new Map<string, number>();
  private errors = new Map<string, Error>();
  private requestLog: Array<{ url: string; options: any }> = [];

  async fetchJSON<T = unknown>(url: string, options: any = {}): Promise<T> {
    this.requestLog.push({ url, options });

    const key = this.getRequestKey(url, options.method || 'GET');

    if (this.errors.has(key)) {
      throw this.errors.get(key);
    }

    if (this.responses.has(key)) {
      const responses = this.responses.get(key)!;
      const currentIndex = this.responseIndex.get(key) || 0;

      if (currentIndex < responses.length) {
        const response = responses[currentIndex];
        this.responseIndex.set(key, currentIndex + 1);
        return response as T;
      } else {
        // Return last response if we've exhausted the list
        return responses[responses.length - 1] as T;
      }
    }

    throw new Error(`No mock response configured for ${options.method || 'GET'} ${url}`);
  }

  setMockResponse(url: string, response: any, method = 'GET'): void {
    const key = this.getRequestKey(url, method);
    const existingResponses = this.responses.get(key) || [];
    existingResponses.push(response);
    this.responses.set(key, existingResponses);
  }

  setMockError(url: string, error: Error, method = 'GET'): void {
    const key = this.getRequestKey(url, method);
    this.errors.set(key, error);
  }

  clearMocks(): void {
    this.responses.clear();
    this.responseIndex.clear();
    this.errors.clear();
    this.requestLog = [];
  }

  getRequestLog(): Array<{ url: string; options: any }> {
    return [...this.requestLog];
  }

  wasRequestMade(url: string, method = 'GET'): boolean {
    return this.requestLog.some(req =>
      req.url.includes(url) && (req.options.method || 'GET') === method
    );
  }

  private getRequestKey(url: string, method: string): string {
    // Normalize URL by removing base domain and query parameters for easier mocking
    let normalizedUrl = url.replace(/^https?:\/\/[^\/]+/, '');
    // Remove query parameters for cleaner matching
    const questionIndex = normalizedUrl.indexOf('?');
    if (questionIndex !== -1) {
      normalizedUrl = normalizedUrl.substring(0, questionIndex);
    }
    return `${method.toUpperCase()} ${normalizedUrl}`;
  }

  setHooks?(hooks: any): void {
    // Mock implementation - store hooks if needed for testing
  }
}

/**
 * Factory functions for creating test data
 */
export const testDataFactory = {
  user: (overrides: Partial<any> = {}) => ({
    id: 'test-user-id',
    display_name: 'Test User',
    email: 'test@example.com',
    external_urls: { spotify: 'https://open.spotify.com/user/test-user-id' },
    followers: { href: null, total: 42 },
    href: 'https://api.spotify.com/v1/users/test-user-id',
    images: [],
    type: 'user',
    uri: 'spotify:user:test-user-id',
    ...overrides,
  }),

  artist: (overrides: Partial<any> = {}) => ({
    id: 'test-artist-id',
    name: 'Test Artist',
    external_urls: { spotify: 'https://open.spotify.com/artist/test-artist-id' },
    followers: { href: null, total: 1000 },
    genres: ['pop', 'rock'],
    href: 'https://api.spotify.com/v1/artists/test-artist-id',
    images: [{ url: 'https://example.com/image.jpg', height: 640, width: 640 }],
    popularity: 75,
    type: 'artist',
    uri: 'spotify:artist:test-artist-id',
    ...overrides,
  }),

  track: (overrides: Partial<any> = {}) => ({
    id: 'test-track-id',
    name: 'Test Track',
    artists: [testDataFactory.artist()],
    album: testDataFactory.album(),
    available_markets: ['US', 'GB'],
    disc_number: 1,
    duration_ms: 180000,
    explicit: false,
    external_urls: { spotify: 'https://open.spotify.com/track/test-track-id' },
    href: 'https://api.spotify.com/v1/tracks/test-track-id',
    is_local: false,
    popularity: 80,
    preview_url: 'https://example.com/preview.mp3',
    track_number: 1,
    type: 'track',
    uri: 'spotify:track:test-track-id',
    ...overrides,
  }),

  album: (overrides: Partial<any> = {}) => ({
    id: 'test-album-id',
    name: 'Test Album',
    album_type: 'album',
    total_tracks: 12,
    artists: [testDataFactory.artist()],
    available_markets: ['US', 'GB'],
    external_urls: { spotify: 'https://open.spotify.com/album/test-album-id' },
    href: 'https://api.spotify.com/v1/albums/test-album-id',
    images: [{ url: 'https://example.com/album.jpg', height: 640, width: 640 }],
    release_date: '2023-01-01',
    release_date_precision: 'day',
    type: 'album',
    uri: 'spotify:album:test-album-id',
    ...overrides,
  }),

  playlist: (overrides: Partial<any> = {}) => ({
    id: 'test-playlist-id',
    name: 'Test Playlist',
    collaborative: false,
    description: 'A test playlist',
    external_urls: { spotify: 'https://open.spotify.com/playlist/test-playlist-id' },
    followers: { href: null, total: 100 },
    href: 'https://api.spotify.com/v1/playlists/test-playlist-id',
    images: [{ url: 'https://example.com/playlist.jpg', height: 300, width: 300 }],
    owner: testDataFactory.user(),
    public: true,
    snapshot_id: 'snapshot123',
    tracks: { href: 'https://api.spotify.com/v1/playlists/test-playlist-id/tracks', total: 25 },
    type: 'playlist',
    uri: 'spotify:playlist:test-playlist-id',
    ...overrides,
  }),

  playbackState: (overrides: Partial<any> = {}) => ({
    device: {
      id: 'test-device-id',
      is_active: true,
      is_private_session: false,
      is_restricted: false,
      name: 'Test Device',
      type: 'Computer',
      volume_percent: 75,
    },
    repeat_state: 'off',
    shuffle_state: false,
    context: {
      type: 'playlist',
      href: 'https://api.spotify.com/v1/playlists/test-playlist-id',
      external_urls: { spotify: 'https://open.spotify.com/playlist/test-playlist-id' },
      uri: 'spotify:playlist:test-playlist-id',
    },
    timestamp: Date.now(),
    progress_ms: 30000,
    is_playing: true,
    item: testDataFactory.track(),
    currently_playing_type: 'track',
    actions: {
      interrupting_playback: false,
      pausing: true,
      resuming: true,
      seeking: true,
      skipping_next: true,
      skipping_prev: true,
      toggling_repeat_context: true,
      toggling_shuffle: true,
      toggling_repeat_track: true,
      transferring_playback: true,
    },
    ...overrides,
  }),

  paginatedResponse: <T>(items: T[], overrides: Partial<any> = {}) => ({
    href: 'https://api.spotify.com/v1/test',
    limit: 20,
    next: items.length >= 20 ? 'https://api.spotify.com/v1/test?offset=20' : null,
    offset: 0,
    previous: null,
    total: items.length,
    items,
    ...overrides,
  }),
};

/**
 * Helper to create a fake access token getter
 */
export function createMockAccessTokenGetter(token = 'mock-access-token'): () => Promise<string> {
  return async () => token;
}

/**
 * Helper to create deterministic test IDs
 */
export function createTestId(prefix: string, index: number): string {
  return `${prefix}-${index.toString().padStart(3, '0')}`;
}

/**
 * Helper to wait for a specified time (useful for testing timeouts)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to assert that a function throws with a specific message
 */
export async function expectThrows(
  fn: () => Promise<any>,
  expectedMessage?: string | RegExp
): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (error instanceof Error && error.message === 'Expected function to throw, but it did not') {
      throw error;
    }

    if (expectedMessage) {
      const actualMessage = error instanceof Error ? error.message : String(error);

      if (typeof expectedMessage === 'string') {
        if (!actualMessage.includes(expectedMessage)) {
          throw new Error(`Expected error message to contain "${expectedMessage}", but got "${actualMessage}"`);
        }
      } else {
        if (!expectedMessage.test(actualMessage)) {
          throw new Error(`Expected error message to match ${expectedMessage}, but got "${actualMessage}"`);
        }
      }
    }

    return error as Error;
  }
}
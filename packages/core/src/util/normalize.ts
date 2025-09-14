/**
 * Utility functions for normalizing and standardizing data
 */

/**
 * Normalize a string for consistent comparison
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Normalize artist name for comparison
 */
export function normalizeArtistName(name: string): string {
  let normalized = normalizeString(name);

  // Remove common prefixes/suffixes
  normalized = normalized.replace(/^(the|a|an)\s+/i, '');
  normalized = normalized.replace(/\s+(jr|sr|ii|iii|iv)$/i, '');

  return normalized;
}

/**
 * Normalize track name for comparison
 */
export function normalizeTrackName(name: string): string {
  let normalized = normalizeString(name);

  // Remove common suffixes
  normalized = normalized.replace(/\s*\(.*?\)\s*$/g, ''); // Remove parenthetical content
  normalized = normalized.replace(/\s*-\s*remaster.*$/i, ''); // Remove remaster info
  normalized = normalized.replace(/\s*-\s*\d+.*remaster.*$/i, ''); // Remove year remaster info

  return normalized.trim();
}

/**
 * Extract year from various date formats
 */
export function extractYear(dateString: string): number | undefined {
  // Try different date formats
  const patterns = [
    /(\d{4})-\d{2}-\d{2}/, // YYYY-MM-DD
    /(\d{4})\/\d{2}\/\d{2}/, // YYYY/MM/DD
    /(\d{4})/, // Just year
  ];

  for (const pattern of patterns) {
    const match = dateString.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      if (year >= 1900 && year <= new Date().getFullYear() + 1) {
        return year;
      }
    }
  }

  return undefined;
}

/**
 * Normalize duration to milliseconds
 */
export function normalizeDuration(duration: number | string): number {
  if (typeof duration === 'number') {
    return Math.max(0, duration);
  }

  const str = duration.toString().toLowerCase();

  // Handle MM:SS format
  const colonMatch = str.match(/^(\d+):(\d+)$/);
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1]);
    const seconds = parseInt(colonMatch[2]);
    return (minutes * 60 + seconds) * 1000;
  }

  // Handle "X minutes Y seconds" format
  const minutesMatch = str.match(/(\d+)\s*(?:min|minutes?)/);
  const secondsMatch = str.match(/(\d+)\s*(?:sec|seconds?)/);

  let totalMs = 0;
  if (minutesMatch) totalMs += parseInt(minutesMatch[1]) * 60 * 1000;
  if (secondsMatch) totalMs += parseInt(secondsMatch[1]) * 1000;

  if (totalMs > 0) return totalMs;

  // Try to parse as number (assume milliseconds)
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

/**
 * Normalize genre names for consistency
 */
export function normalizeGenre(genre: string): string {
  let normalized = normalizeString(genre);

  // Handle common genre variations
  const genreMap: Record<string, string> = {
    'hip hop': 'hiphop',
    'hip-hop': 'hiphop',
    'r&b': 'rnb',
    'r and b': 'rnb',
    'drum and bass': 'drumandbass',
    'drum & bass': 'drumandbass',
    'drum n bass': 'drumandbass',
    'electronic dance music': 'edm',
    'dance music': 'dance',
  };

  return genreMap[normalized] || normalized;
}

/**
 * Normalize Spotify URI to consistent format
 */
export function normalizeSpotifyUri(uri: string): string {
  // Ensure it starts with spotify:
  if (!uri.startsWith('spotify:')) {
    // Try to extract from Spotify URL
    const urlMatch = uri.match(/spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      return `spotify:${urlMatch[1]}:${urlMatch[2]}`;
    }
    throw new Error(`Invalid Spotify URI: ${uri}`);
  }

  return uri.toLowerCase();
}

/**
 * Extract ID from Spotify URI
 */
export function extractSpotifyId(uri: string): string {
  const normalized = normalizeSpotifyUri(uri);
  const parts = normalized.split(':');
  if (parts.length !== 3) {
    throw new Error(`Invalid Spotify URI format: ${uri}`);
  }
  return parts[2];
}

/**
 * Normalize popularity score (0-100)
 */
export function normalizePopularity(popularity: number | string): number {
  let score: number;

  if (typeof popularity === 'string') {
    score = parseFloat(popularity);
  } else {
    score = popularity;
  }

  if (isNaN(score)) return 0;

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Normalize array of strings (remove empties, duplicates, normalize each)
 */
export function normalizeStringArray(strings: string[]): string[] {
  return [...new Set(
    strings
      .map(str => normalizeString(str))
      .filter(str => str.length > 0)
  )];
}

/**
 * Create a normalized search key for deduplication
 */
export function createSearchKey(track: {
  name: string;
  artists: string[];
  durationMs?: number;
}): string {
  const normalizedName = normalizeTrackName(track.name);
  const normalizedArtists = track.artists.map(normalizeArtistName).sort().join('|');
  const durationKey = track.durationMs ? Math.round(track.durationMs / 1000) : '';

  return `${normalizedName}::${normalizedArtists}::${durationKey}`;
}

/**
 * Fuzzy match two strings (returns similarity score 0-1)
 */
export function fuzzyMatch(str1: string, str2: string): number {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);

  if (norm1 === norm2) return 1;
  if (norm1.length === 0 || norm2.length === 0) return 0;

  // Simple character-based similarity
  const longer = norm1.length > norm2.length ? norm1 : norm2;
  const shorter = norm1.length > norm2.length ? norm2 : norm1;

  if (longer.length === 0) return 1;

  // Count matching characters
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++;
    }
  }

  return matches / longer.length;
}

/**
 * Check if two tracks are likely the same
 */
export function tracksAreSimilar(
  track1: { name: string; artists: string[]; durationMs?: number },
  track2: { name: string; artists: string[]; durationMs?: number },
  threshold = 0.8
): boolean {
  const nameMatch = fuzzyMatch(track1.name, track2.name);
  if (nameMatch < 0.5) return false; // Names must be somewhat similar

  // Check artist overlap
  const artists1 = track1.artists.map(normalizeArtistName);
  const artists2 = track2.artists.map(normalizeArtistName);

  const hasArtistOverlap = artists1.some(a1 =>
    artists2.some(a2 => fuzzyMatch(a1, a2) > 0.8)
  );

  if (!hasArtistOverlap) return false;

  // Check duration similarity (within 10 seconds)
  if (track1.durationMs && track2.durationMs) {
    const durationDiff = Math.abs(track1.durationMs - track2.durationMs);
    if (durationDiff > 10000) return false; // More than 10 seconds difference
  }

  const overallScore = (nameMatch + (hasArtistOverlap ? 1 : 0)) / 2;
  return overallScore >= threshold;
}
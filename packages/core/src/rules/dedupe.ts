import type { TrackRef, Rules, DedupeResult } from '../types.js';
import { ValidationError } from '../errors.js';

/**
 * Deduplicate tracks based on specified criteria while preserving stable ordering
 */
export function deduplicateTracks(tracks: TrackRef[], rules: Rules): DedupeResult {
  if (!rules.dedupeBy || rules.dedupeBy.length === 0) {
    return { deduped: [...tracks], removed: [] };
  }

  const deduped: TrackRef[] = [];
  const removed: TrackRef[] = [];
  const seen = new Set<string>();

  for (const track of tracks) {
    const keys = rules.dedupeBy.map(criteria => generateDedupeKey(track, criteria));
    const compositeKey = keys.join('|');

    if (seen.has(compositeKey)) {
      removed.push(track);
    } else {
      seen.add(compositeKey);
      deduped.push(track);
    }
  }

  return { deduped, removed };
}

/**
 * Generate a deduplication key for a track based on the specified criteria
 */
function generateDedupeKey(track: TrackRef, criteria: string): string {
  switch (criteria) {
    case 'uri':
      return track.uri;

    case 'id':
      return track.id;

    case 'audioHash':
      // For audioHash, we'd need audio fingerprinting data
      // For now, fall back to combining multiple track properties
      return `${track.name}:${track.durationMs}:${track.artists.join(',')}`;

    case 'name+artist':
      return `${normalizeString(track.name)}:${track.artists.map(normalizeString).sort().join(',')}`;

    default:
      throw new ValidationError(`Unknown deduplication criteria: ${criteria}`, { criteria });
  }
}

/**
 * Normalize string for case-insensitive matching
 */
function normalizeString(str: string): string {
  return str.toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Check if deduplication would be effective for given tracks and rules
 */
export function analyzeDeduplication(tracks: TrackRef[], rules: Rules): {
  wouldRemove: number;
  duplicateGroups: Array<{ key: string; tracks: TrackRef[] }>;
  effectiveness: number; // 0-1 ratio of duplicates that would be removed
} {
  if (!rules.dedupeBy || rules.dedupeBy.length === 0) {
    return { wouldRemove: 0, duplicateGroups: [], effectiveness: 0 };
  }

  const groups = new Map<string, TrackRef[]>();

  for (const track of tracks) {
    const keys = rules.dedupeBy.map(criteria => generateDedupeKey(track, criteria));
    const compositeKey = keys.join('|');

    if (!groups.has(compositeKey)) {
      groups.set(compositeKey, []);
    }
    groups.get(compositeKey)!.push(track);
  }

  const duplicateGroups: Array<{ key: string; tracks: TrackRef[] }> = [];
  let totalDuplicates = 0;

  for (const [key, groupTracks] of groups) {
    if (groupTracks.length > 1) {
      duplicateGroups.push({ key, tracks: groupTracks });
      totalDuplicates += groupTracks.length - 1; // Keep one, remove the rest
    }
  }

  const effectiveness = tracks.length > 0 ? totalDuplicates / tracks.length : 0;

  return {
    wouldRemove: totalDuplicates,
    duplicateGroups,
    effectiveness,
  };
}

/**
 * Merge deduplication rules, ensuring no conflicts
 */
export function mergeDedupeRules(...rulesets: Rules[]): Rules['dedupeBy'] {
  const allCriteria = new Set<string>();

  for (const rules of rulesets) {
    if (rules.dedupeBy) {
      for (const criteria of rules.dedupeBy) {
        allCriteria.add(criteria);
      }
    }
  }

  // Sort criteria by specificity (most specific first)
  const priorityOrder = ['uri', 'id', 'audioHash', 'name+artist'];
  const result = Array.from(allCriteria).sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a);
    const bIndex = priorityOrder.indexOf(b);

    // Known criteria come first, unknown criteria come last
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;

    return aIndex - bIndex;
  });

  return result as Rules['dedupeBy'];
}

/**
 * Validate deduplication criteria
 */
export function validateDedupeRules(dedupeBy?: string[]): void {
  if (!dedupeBy) return;

  const validCriteria = ['uri', 'id', 'audioHash', 'name+artist'];

  for (const criteria of dedupeBy) {
    if (!validCriteria.includes(criteria)) {
      throw new ValidationError(
        `Invalid deduplication criteria: ${criteria}. Valid options: ${validCriteria.join(', ')}`,
        { criteria, validCriteria }
      );
    }
  }
}
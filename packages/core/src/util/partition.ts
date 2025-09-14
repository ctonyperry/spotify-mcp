/**
 * Utility functions for partitioning and grouping data
 */

import type { TrackRef } from '../types.js';
import { normalizeArtistName, normalizeGenre } from './normalize.js';

/**
 * Partition tracks by artist
 */
export function partitionByArtist(tracks: TrackRef[]): Map<string, TrackRef[]> {
  const partitions = new Map<string, TrackRef[]>();

  for (const track of tracks) {
    for (const artist of track.artists) {
      const normalizedArtist = normalizeArtistName(artist);

      if (!partitions.has(normalizedArtist)) {
        partitions.set(normalizedArtist, []);
      }

      partitions.get(normalizedArtist)!.push(track);
    }
  }

  return partitions;
}

/**
 * Partition tracks by duration ranges
 */
export function partitionByDuration(tracks: TrackRef[]): {
  short: TrackRef[]; // < 2 minutes
  medium: TrackRef[]; // 2-5 minutes
  long: TrackRef[]; // > 5 minutes
} {
  const short: TrackRef[] = [];
  const medium: TrackRef[] = [];
  const long: TrackRef[] = [];

  for (const track of tracks) {
    const minutes = track.durationMs / (1000 * 60);

    if (minutes < 2) {
      short.push(track);
    } else if (minutes <= 5) {
      medium.push(track);
    } else {
      long.push(track);
    }
  }

  return { short, medium, long };
}

/**
 * Partition tracks by popularity ranges
 */
export function partitionByPopularity(tracks: TrackRef[]): {
  low: TrackRef[]; // 0-33
  medium: TrackRef[]; // 34-66
  high: TrackRef[]; // 67-100
  unknown: TrackRef[]; // no popularity data
} {
  const low: TrackRef[] = [];
  const medium: TrackRef[] = [];
  const high: TrackRef[] = [];
  const unknown: TrackRef[] = [];

  for (const track of tracks) {
    if (track.popularity === undefined) {
      unknown.push(track);
    } else if (track.popularity <= 33) {
      low.push(track);
    } else if (track.popularity <= 66) {
      medium.push(track);
    } else {
      high.push(track);
    }
  }

  return { low, medium, high, unknown };
}

/**
 * Partition tracks by explicit content
 */
export function partitionByExplicit(tracks: TrackRef[]): {
  explicit: TrackRef[];
  clean: TrackRef[];
  unknown: TrackRef[];
} {
  const explicit: TrackRef[] = [];
  const clean: TrackRef[] = [];
  const unknown: TrackRef[] = [];

  for (const track of tracks) {
    if (track.explicit === true) {
      explicit.push(track);
    } else if (track.explicit === false) {
      clean.push(track);
    } else {
      unknown.push(track);
    }
  }

  return { explicit, clean, unknown };
}

/**
 * Group tracks by a custom key function
 */
export function groupBy<T, K>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T[]> {
  const groups = new Map<K, T[]>();

  for (const item of items) {
    const key = keyFn(item);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(item);
  }

  return groups;
}

/**
 * Partition tracks into balanced groups
 */
export function partitionBalanced<T>(
  items: T[],
  partitionCount: number
): T[][] {
  if (partitionCount <= 0) return [];
  if (partitionCount >= items.length) {
    return items.map(item => [item]);
  }

  const partitions: T[][] = Array.from({ length: partitionCount }, () => []);

  // Distribute items round-robin for balance
  items.forEach((item, index) => {
    partitions[index % partitionCount].push(item);
  });

  return partitions;
}

/**
 * Partition tracks to ensure diversity across partitions
 */
export function partitionWithDiversity(
  tracks: TrackRef[],
  partitionCount: number
): TrackRef[][] {
  if (partitionCount <= 0) return [];
  if (partitionCount >= tracks.length) {
    return tracks.map(track => [track]);
  }

  // Group tracks by artist first
  const artistGroups = partitionByArtist(tracks);
  const partitions: TrackRef[][] = Array.from({ length: partitionCount }, () => []);

  // Distribute artists across partitions
  let partitionIndex = 0;
  for (const [artist, artistTracks] of artistGroups) {
    // Distribute this artist's tracks across different partitions
    artistTracks.forEach(track => {
      partitions[partitionIndex % partitionCount].push(track);
      partitionIndex++;
    });
  }

  return partitions;
}

/**
 * Find the optimal partition size for a given dataset
 */
export function findOptimalPartitionSize(
  itemCount: number,
  options: {
    minPartitionSize?: number;
    maxPartitionSize?: number;
    targetPartitionCount?: number;
  } = {}
): {
  partitionCount: number;
  partitionSize: number;
  remainder: number;
} {
  const minSize = options.minPartitionSize || 1;
  const maxSize = options.maxPartitionSize || itemCount;
  const targetCount = options.targetPartitionCount;

  if (targetCount) {
    const partitionSize = Math.ceil(itemCount / targetCount);
    return {
      partitionCount: Math.ceil(itemCount / partitionSize),
      partitionSize,
      remainder: itemCount % partitionSize,
    };
  }

  // Find size that creates balanced partitions
  let bestSize = minSize;
  let bestWaste = itemCount;

  for (let size = minSize; size <= maxSize; size++) {
    const partitionCount = Math.ceil(itemCount / size);
    const waste = (partitionCount * size) - itemCount;

    if (waste < bestWaste) {
      bestWaste = waste;
      bestSize = size;
    }
  }

  const finalPartitionCount = Math.ceil(itemCount / bestSize);
  return {
    partitionCount: finalPartitionCount,
    partitionSize: bestSize,
    remainder: itemCount % bestSize,
  };
}

/**
 * Shuffle partitions to ensure randomness while maintaining balance
 */
export function shufflePartitions<T>(
  partitions: T[][],
  randomFn: () => number = Math.random
): T[][] {
  // Shuffle within each partition
  const shuffledPartitions = partitions.map(partition => {
    const shuffled = [...partition];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  // Shuffle the order of partitions
  for (let i = shuffledPartitions.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [shuffledPartitions[i], shuffledPartitions[j]] = [shuffledPartitions[j], shuffledPartitions[i]];
  }

  return shuffledPartitions;
}

/**
 * Merge partitions back into a single array
 */
export function mergePartitions<T>(...partitions: T[][]): T[] {
  return partitions.flat();
}

/**
 * Interleave items from multiple partitions
 */
export function interleavePartitions<T>(partitions: T[][]): T[] {
  const result: T[] = [];
  const maxLength = Math.max(...partitions.map(p => p.length));

  for (let i = 0; i < maxLength; i++) {
    for (const partition of partitions) {
      if (i < partition.length) {
        result.push(partition[i]);
      }
    }
  }

  return result;
}

/**
 * Get partition statistics
 */
export function getPartitionStats<T>(partitions: T[][]): {
  totalItems: number;
  partitionCount: number;
  minSize: number;
  maxSize: number;
  averageSize: number;
  isEmpty: boolean;
  isBalanced: boolean;
} {
  const sizes = partitions.map(p => p.length);
  const totalItems = sizes.reduce((sum, size) => sum + size, 0);

  const minSize = sizes.length > 0 ? Math.min(...sizes) : 0;
  const maxSize = sizes.length > 0 ? Math.max(...sizes) : 0;
  const averageSize = partitions.length > 0 ? totalItems / partitions.length : 0;

  // Consider balanced if difference between min and max is at most 1
  const isBalanced = (maxSize - minSize) <= 1;
  const isEmpty = totalItems === 0;

  return {
    totalItems,
    partitionCount: partitions.length,
    minSize,
    maxSize,
    averageSize,
    isEmpty,
    isBalanced,
  };
}

/**
 * Filter partitions based on criteria
 */
export function filterPartitions<T>(
  partitions: T[][],
  predicate: (partition: T[], index: number) => boolean
): T[][] {
  return partitions.filter(predicate);
}

/**
 * Rebalance partitions to ensure more even distribution
 */
export function rebalancePartitions<T>(partitions: T[][]): T[][] {
  if (partitions.length === 0) return [];

  const allItems = mergePartitions(...partitions);
  return partitionBalanced(allItems, partitions.length);
}
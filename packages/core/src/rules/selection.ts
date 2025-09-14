import type { TrackRef, Rules, SelectionResult } from '../types.js';
import type { RandomPort, TimePort } from '../ports.js';
import { SelectionError, ValidationError } from '../errors.js';

export interface SelectionOptions {
  /**
   * Number of tracks to select
   */
  count: number;

  /**
   * Boost factor for recent tracks (0-1, where 1 = full boost)
   */
  recencyBoost?: number;

  /**
   * Reference time for recency calculations (defaults to now)
   */
  referenceTimeMs?: number;

  /**
   * Popularity weight (0-1, where 1 = only popularity matters)
   */
  popularityWeight?: number;

  /**
   * Diversity factor to prevent too many tracks from same artist (0-1)
   */
  diversityFactor?: number;

  /**
   * Randomness factor for tie-breaking (0-1, where 1 = fully random)
   */
  randomnessFactor?: number;
}

/**
 * Select tracks from candidates using scoring and filtering
 */
export function selectTracks(
  candidates: TrackRef[],
  rules: Rules,
  options: SelectionOptions,
  randomPort: RandomPort,
  timePort?: TimePort
): SelectionResult {
  if (options.count <= 0) {
    throw new ValidationError('Selection count must be positive');
  }

  if (candidates.length === 0) {
    return { selected: [], scored: [] };
  }

  // Score all candidates
  const scored = scoreAllTracks(candidates, options, timePort);

  // Apply diversity factor if specified
  const diversified = options.diversityFactor
    ? applyDiversityFactor(scored, options.diversityFactor)
    : scored;

  // Sort by score (descending) with random tie-breaking
  const sorted = sortWithRandomTieBreaking(diversified, options.randomnessFactor || 0, randomPort);

  // Select top N tracks
  const selected = sorted.slice(0, options.count).map(item => item.track);

  return { selected, scored: sorted };
}

/**
 * Score all tracks based on various factors
 */
function scoreAllTracks(
  tracks: TrackRef[],
  options: SelectionOptions,
  timePort?: TimePort
): Array<{ track: TrackRef; score: number; breakdown: Record<string, number> }> {
  const currentTime = timePort?.nowMs() || Date.now();

  return tracks.map(track => {
    const breakdown: Record<string, number> = {};

    // Base score
    let score = 0.5;
    breakdown.base = 0.5;

    // Popularity score
    if (track.popularity !== undefined) {
      const popularityScore = track.popularity / 100;
      const weight = options.popularityWeight || 0.3;
      score += popularityScore * weight;
      breakdown.popularity = popularityScore * weight;
    }

    // Recency boost (tracks added recently get higher scores)
    if (options.recencyBoost && options.referenceTimeMs) {
      const timeDiff = currentTime - options.referenceTimeMs;
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

      // Exponential decay over 30 days
      const recencyScore = Math.exp(-daysDiff / 30);
      const boost = recencyScore * (options.recencyBoost || 0);
      score += boost;
      breakdown.recency = boost;
    }

    // Duration preference (prefer songs between 2-5 minutes)
    const durationMinutes = track.durationMs / (1000 * 60);
    let durationScore = 0;
    if (durationMinutes >= 2 && durationMinutes <= 5) {
      durationScore = 0.1;
    } else if (durationMinutes > 5 && durationMinutes <= 7) {
      durationScore = 0.05;
    } else if (durationMinutes >= 1.5 && durationMinutes < 2) {
      durationScore = 0.05;
    }
    score += durationScore;
    breakdown.duration = durationScore;

    // Explicit content penalty if not allowed
    if (track.explicit === true) {
      score -= 0.1;
      breakdown.explicit = -0.1;
    }

    // Ensure score is bounded [0, 1]
    score = Math.max(0, Math.min(1, score));

    return { track, score, breakdown };
  });
}

/**
 * Apply diversity factor to reduce clustering of same artists
 */
function applyDiversityFactor(
  scored: Array<{ track: TrackRef; score: number; breakdown: Record<string, number> }>,
  diversityFactor: number
): Array<{ track: TrackRef; score: number; breakdown: Record<string, number> }> {
  const artistCounts = new Map<string, number>();

  // Sort by score first to process highest-scoring tracks first
  const sorted = [...scored].sort((a, b) => b.score - a.score);

  return sorted.map(item => {
    let adjustedScore = item.score;

    // Penalize tracks from over-represented artists
    for (const artist of item.track.artists) {
      const count = artistCounts.get(artist) || 0;
      if (count > 0) {
        const penalty = count * diversityFactor * 0.1;
        adjustedScore -= penalty;
        item.breakdown.diversity = -penalty;
      }
      artistCounts.set(artist, count + 1);
    }

    return {
      ...item,
      score: Math.max(0, adjustedScore),
    };
  });
}

/**
 * Sort tracks by score with random tie-breaking
 */
function sortWithRandomTieBreaking(
  scored: Array<{ track: TrackRef; score: number; breakdown?: Record<string, number> }>,
  randomnessFactor: number,
  randomPort: RandomPort
): Array<{ track: TrackRef; score: number; breakdown?: Record<string, number> }> {
  return [...scored].sort((a, b) => {
    const scoreDiff = b.score - a.score;

    // If scores are very close, use randomness for tie-breaking
    const threshold = 0.01 * (1 + randomnessFactor);
    if (Math.abs(scoreDiff) < threshold && randomnessFactor > 0) {
      return randomPort.random() - 0.5;
    }

    return scoreDiff;
  });
}

/**
 * Analyze selection effectiveness for given parameters
 */
export function analyzeSelection(
  candidates: TrackRef[],
  options: SelectionOptions,
  timePort?: TimePort
): {
  totalCandidates: number;
  requestedCount: number;
  availableCount: number;
  scoreDistribution: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };
  topScores: number[];
} {
  if (candidates.length === 0) {
    return {
      totalCandidates: 0,
      requestedCount: options.count,
      availableCount: 0,
      scoreDistribution: { min: 0, max: 0, mean: 0, median: 0 },
      topScores: [],
    };
  }

  const scored = scoreAllTracks(candidates, options, timePort);
  const scores = scored.map(item => item.score).sort((a, b) => b - a);

  const sum = scores.reduce((acc, score) => acc + score, 0);
  const mean = sum / scores.length;
  const median = scores.length % 2 === 0
    ? (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
    : scores[Math.floor(scores.length / 2)];

  return {
    totalCandidates: candidates.length,
    requestedCount: options.count,
    availableCount: Math.min(options.count, candidates.length),
    scoreDistribution: {
      min: scores[scores.length - 1] || 0,
      max: scores[0] || 0,
      mean,
      median,
    },
    topScores: scores.slice(0, Math.min(10, scores.length)),
  };
}

/**
 * Generate selection options based on rules and preferences
 */
export function generateSelectionOptions(
  rules: Rules,
  preferences: {
    favorRecent?: boolean;
    favorPopular?: boolean;
    ensureDiversity?: boolean;
    allowRandomness?: boolean;
  } = {}
): SelectionOptions {
  const options: SelectionOptions = {
    count: rules.maxTracks || 50,
  };

  if (preferences.favorRecent) {
    options.recencyBoost = 0.3;
  }

  if (preferences.favorPopular) {
    options.popularityWeight = 0.4;
  }

  if (preferences.ensureDiversity) {
    options.diversityFactor = 0.7;
  }

  if (preferences.allowRandomness) {
    options.randomnessFactor = 0.2;
  }

  return options;
}

/**
 * Validate selection options
 */
export function validateSelectionOptions(options: SelectionOptions): void {
  const errors: string[] = [];

  if (options.count <= 0) {
    errors.push('count must be positive');
  }

  if (options.recencyBoost !== undefined && (options.recencyBoost < 0 || options.recencyBoost > 1)) {
    errors.push('recencyBoost must be between 0 and 1');
  }

  if (options.popularityWeight !== undefined && (options.popularityWeight < 0 || options.popularityWeight > 1)) {
    errors.push('popularityWeight must be between 0 and 1');
  }

  if (options.diversityFactor !== undefined && (options.diversityFactor < 0 || options.diversityFactor > 1)) {
    errors.push('diversityFactor must be between 0 and 1');
  }

  if (options.randomnessFactor !== undefined && (options.randomnessFactor < 0 || options.randomnessFactor > 1)) {
    errors.push('randomnessFactor must be between 0 and 1');
  }

  if (errors.length > 0) {
    throw new ValidationError(`Invalid selection options: ${errors.join('; ')}`);
  }
}
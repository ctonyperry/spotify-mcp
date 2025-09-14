/**
 * Scoring utilities for ranking and selection
 */

import type { TrackRef } from '../types.js';

export interface ScoringWeights {
  popularity: number;
  recency: number;
  duration: number;
  explicit: number;
  artistDiversity: number;
  genreDiversity: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  popularity: 0.3,
  recency: 0.2,
  duration: 0.1,
  explicit: -0.1,
  artistDiversity: 0.2,
  genreDiversity: 0.1,
};

/**
 * Calculate a composite score for a track
 */
export function scoreTrack(
  track: TrackRef,
  context: {
    weights?: Partial<ScoringWeights>;
    referenceTime?: number;
    seenArtists?: Set<string>;
    averagePopularity?: number;
    preferredDurationMs?: number;
  } = {}
): { score: number; breakdown: Record<string, number> } {
  const weights = { ...DEFAULT_SCORING_WEIGHTS, ...context.weights };
  const breakdown: Record<string, number> = {};

  let totalScore = 0;

  // Popularity score (0-1 based on track popularity)
  if (track.popularity !== undefined) {
    const popularityScore = track.popularity / 100;
    const weighted = popularityScore * weights.popularity;
    breakdown.popularity = weighted;
    totalScore += weighted;
  }

  // Recency score (if we have reference time)
  if (context.referenceTime && weights.recency > 0) {
    // This would typically be based on when the track was added/released
    // For now, we'll use a placeholder scoring based on popularity as a proxy
    const recencyScore = (track.popularity || 50) / 100 * 0.5; // Placeholder
    const weighted = recencyScore * weights.recency;
    breakdown.recency = weighted;
    totalScore += weighted;
  }

  // Duration score (prefer tracks around 3-4 minutes)
  const durationMinutes = track.durationMs / (1000 * 60);
  const preferredMinutes = context.preferredDurationMs ? context.preferredDurationMs / (1000 * 60) : 3.5;

  let durationScore = 0;
  if (durationMinutes >= 2 && durationMinutes <= 6) {
    // Score based on how close to preferred duration
    const distance = Math.abs(durationMinutes - preferredMinutes);
    durationScore = Math.max(0, 1 - distance / 2); // Penalty increases with distance
  } else if (durationMinutes < 2) {
    durationScore = 0.3; // Too short
  } else {
    durationScore = 0.1; // Too long
  }

  const weightedDuration = durationScore * weights.duration;
  breakdown.duration = weightedDuration;
  totalScore += weightedDuration;

  // Explicit content penalty
  if (track.explicit === true) {
    const weighted = weights.explicit;
    breakdown.explicit = weighted;
    totalScore += weighted;
  }

  // Artist diversity bonus (if artist hasn't been seen much)
  if (context.seenArtists && weights.artistDiversity > 0) {
    const unseenArtists = track.artists.filter(artist => !context.seenArtists!.has(artist));
    const diversityScore = unseenArtists.length / track.artists.length;
    const weighted = diversityScore * weights.artistDiversity;
    breakdown.artistDiversity = weighted;
    totalScore += weighted;
  }

  return { score: Math.max(0, totalScore), breakdown };
}

/**
 * Score a collection of tracks with relative ranking
 */
export function scoreTrackCollection(
  tracks: TrackRef[],
  weights?: Partial<ScoringWeights>
): Array<{ track: TrackRef; score: number; rank: number; breakdown: Record<string, number> }> {
  if (tracks.length === 0) return [];

  // Calculate average popularity for normalization
  const popularities = tracks.map(t => t.popularity || 0);
  const averagePopularity = popularities.reduce((sum, p) => sum + p, 0) / popularities.length;

  // Track seen artists for diversity scoring
  const seenArtists = new Set<string>();

  const scoredTracks = tracks.map(track => {
    const result = scoreTrack(track, {
      weights,
      averagePopularity,
      seenArtists,
    });

    // Add artists to seen set for subsequent tracks
    track.artists.forEach(artist => seenArtists.add(artist));

    return {
      track,
      score: result.score,
      rank: 0, // Will be filled in below
      breakdown: result.breakdown,
    };
  });

  // Sort by score and assign ranks
  scoredTracks.sort((a, b) => b.score - a.score);
  scoredTracks.forEach((item, index) => {
    item.rank = index + 1;
  });

  return scoredTracks;
}

/**
 * Calculate diversity score for a track collection
 */
export function calculateDiversityScore(tracks: TrackRef[]): {
  artistDiversity: number;
  durationDiversity: number;
  popularityDiversity: number;
  overallDiversity: number;
} {
  if (tracks.length === 0) {
    return {
      artistDiversity: 0,
      durationDiversity: 0,
      popularityDiversity: 0,
      overallDiversity: 0,
    };
  }

  // Artist diversity (unique artists / total tracks)
  const allArtists = tracks.flatMap(t => t.artists);
  const uniqueArtists = new Set(allArtists);
  const artistDiversity = uniqueArtists.size / allArtists.length;

  // Duration diversity (coefficient of variation)
  const durations = tracks.map(t => t.durationMs);
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const durationVariance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
  const durationStdDev = Math.sqrt(durationVariance);
  const durationDiversity = avgDuration > 0 ? durationStdDev / avgDuration : 0;

  // Popularity diversity (if available)
  const popularities = tracks.map(t => t.popularity || 50);
  const avgPopularity = popularities.reduce((sum, p) => sum + p, 0) / popularities.length;
  const popularityVariance = popularities.reduce((sum, p) => sum + Math.pow(p - avgPopularity, 2), 0) / popularities.length;
  const popularityStdDev = Math.sqrt(popularityVariance);
  const popularityDiversity = avgPopularity > 0 ? popularityStdDev / avgPopularity : 0;

  // Overall diversity (weighted average)
  const overallDiversity = (
    artistDiversity * 0.5 +
    Math.min(1, durationDiversity) * 0.3 +
    Math.min(1, popularityDiversity) * 0.2
  );

  return {
    artistDiversity,
    durationDiversity,
    popularityDiversity,
    overallDiversity,
  };
}

/**
 * Generate scoring weights based on user preferences
 */
export function generateScoringWeights(preferences: {
  favorPopular?: boolean;
  favorRecent?: boolean;
  ensureDiversity?: boolean;
  allowExplicit?: boolean;
  preferLength?: 'short' | 'medium' | 'long';
}): ScoringWeights {
  const weights = { ...DEFAULT_SCORING_WEIGHTS };

  if (preferences.favorPopular) {
    weights.popularity = 0.5;
    weights.recency = 0.1;
  }

  if (preferences.favorRecent) {
    weights.recency = 0.4;
    weights.popularity = 0.2;
  }

  if (preferences.ensureDiversity) {
    weights.artistDiversity = 0.3;
    weights.genreDiversity = 0.2;
    weights.popularity = 0.2;
  }

  if (preferences.allowExplicit === false) {
    weights.explicit = -0.3;
  } else if (preferences.allowExplicit === true) {
    weights.explicit = 0;
  }

  if (preferences.preferLength) {
    weights.duration = 0.2;
  }

  return weights;
}

/**
 * Calculate score stability (how much scores vary)
 */
export function calculateScoreStability(
  scores: Array<{ score: number; breakdown: Record<string, number> }>
): {
  variance: number;
  standardDeviation: number;
  coefficient: number;
  isStable: boolean;
} {
  const scoreValues = scores.map(s => s.score);
  const mean = scoreValues.reduce((sum, s) => sum + s, 0) / scoreValues.length;

  const variance = scoreValues.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scoreValues.length;
  const standardDeviation = Math.sqrt(variance);
  const coefficient = mean > 0 ? standardDeviation / mean : 0;

  // Consider stable if coefficient of variation is less than 0.3
  const isStable = coefficient < 0.3;

  return {
    variance,
    standardDeviation,
    coefficient,
    isStable,
  };
}

/**
 * Normalize scores to 0-1 range
 */
export function normalizeScores<T extends { score: number }>(items: T[]): T[] {
  if (items.length === 0) return items;

  const scores = items.map(item => item.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore;

  if (range === 0) {
    // All scores are the same
    return items.map(item => ({ ...item, score: 1 }));
  }

  return items.map(item => ({
    ...item,
    score: (item.score - minScore) / range,
  }));
}

/**
 * Apply score boosting based on contextual factors
 */
export function applyContextualBoosts(
  items: Array<{ track: TrackRef; score: number }>,
  context: {
    userFavoriteArtists?: string[];
    userFavoriteGenres?: string[];
    recentlyPlayed?: string[];
    currentMood?: 'energetic' | 'chill' | 'focused' | 'party';
  }
): Array<{ track: TrackRef; score: number; boosts: Record<string, number> }> {
  return items.map(item => {
    const boosts: Record<string, number> = {};
    let totalBoost = 0;

    // Favorite artist boost
    if (context.userFavoriteArtists) {
      const hasFavoriteArtist = item.track.artists.some(artist =>
        context.userFavoriteArtists!.some(fav =>
          artist.toLowerCase().includes(fav.toLowerCase())
        )
      );

      if (hasFavoriteArtist) {
        boosts.favoriteArtist = 0.2;
        totalBoost += 0.2;
      }
    }

    // Recently played penalty (avoid repetition)
    if (context.recentlyPlayed) {
      const wasRecentlyPlayed = context.recentlyPlayed.includes(item.track.uri);
      if (wasRecentlyPlayed) {
        boosts.recentlyPlayed = -0.3;
        totalBoost -= 0.3;
      }
    }

    // Mood-based boosts
    if (context.currentMood && item.track.popularity) {
      switch (context.currentMood) {
        case 'energetic':
          if (item.track.popularity > 70) {
            boosts.mood = 0.1;
            totalBoost += 0.1;
          }
          break;
        case 'chill':
          if (item.track.popularity < 60) {
            boosts.mood = 0.15;
            totalBoost += 0.15;
          }
          break;
        case 'party':
          if (item.track.popularity > 80) {
            boosts.mood = 0.25;
            totalBoost += 0.25;
          }
          break;
      }
    }

    return {
      track: item.track,
      score: Math.max(0, item.score + totalBoost),
      boosts,
    };
  });
}
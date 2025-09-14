import type { TrackRef, Rules, ConstraintResult } from '../types.js';
import { RuleViolation, ConstraintError } from '../errors.js';

/**
 * Apply constraints to tracks based on rules
 */
export function applyConstraints<T extends TrackRef>(items: T[], rules: Rules): ConstraintResult<T> {
  const accepted: T[] = [];
  const rejected: Array<{ reason: string; item: T }> = [];

  for (const item of items) {
    const violations = validateConstraints(item, rules);

    if (violations.length === 0) {
      accepted.push(item);
    } else {
      rejected.push({
        reason: violations.join('; '),
        item,
      });
    }
  }

  // Apply maxTracks constraint after individual filtering
  if (rules.maxTracks && accepted.length > rules.maxTracks) {
    const excess = accepted.splice(rules.maxTracks);
    for (const item of excess) {
      rejected.push({
        reason: `Exceeds maximum tracks limit (${rules.maxTracks})`,
        item,
      });
    }
  }

  // Apply uniqueArtists constraint
  if (rules.uniqueArtists) {
    const { accepted: uniqueAccepted, rejected: artistRejected } =
      enforceUniqueArtists(accepted);

    accepted.splice(0, accepted.length, ...uniqueAccepted);
    rejected.push(...artistRejected.map(item => ({
      reason: 'Artist already represented',
      item,
    })));
  }

  return { accepted, rejected };
}

/**
 * Validate individual track against constraints
 */
function validateConstraints(track: TrackRef, rules: Rules): string[] {
  const violations: string[] = [];

  // Check explicit content
  if (rules.allowExplicit === false && track.explicit === true) {
    violations.push('Explicit content not allowed');
  }

  // Check minimum popularity
  if (rules.minPopularity !== undefined && track.popularity !== undefined) {
    if (track.popularity < rules.minPopularity) {
      violations.push(`Popularity ${track.popularity} below minimum ${rules.minPopularity}`);
    }
  }

  return violations;
}

/**
 * Enforce unique artists constraint
 */
function enforceUniqueArtists<T extends TrackRef>(tracks: T[]): ConstraintResult<T> {
  const accepted: T[] = [];
  const rejected: T[] = [];
  const seenArtists = new Set<string>();

  for (const track of tracks) {
    const hasNewArtist = track.artists.some(artist => !seenArtists.has(normalizeArtistName(artist)));

    if (hasNewArtist) {
      accepted.push(track);
      // Add all artists from this track to seen set
      for (const artist of track.artists) {
        seenArtists.add(normalizeArtistName(artist));
      }
    } else {
      rejected.push(track);
    }
  }

  return { accepted, rejected };
}

/**
 * Normalize artist name for comparison
 */
function normalizeArtistName(name: string): string {
  return name.toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Validate rules for internal consistency
 */
export function validateRules(rules: Rules): void {
  const violations: string[] = [];

  if (rules.maxTracks !== undefined && rules.maxTracks <= 0) {
    violations.push('maxTracks must be positive');
  }

  if (rules.minPopularity !== undefined) {
    if (rules.minPopularity < 0 || rules.minPopularity > 100) {
      violations.push('minPopularity must be between 0 and 100');
    }
  }

  if (violations.length > 0) {
    throw new RuleViolation(
      `Invalid rules: ${violations.join('; ')}`,
      'RULE_VALIDATION',
      violations,
      { rules }
    );
  }
}

/**
 * Check if a specific constraint would be violated
 */
export function wouldViolateConstraint(track: TrackRef, constraint: keyof Rules, value: any): boolean {
  switch (constraint) {
    case 'allowExplicit':
      return value === false && track.explicit === true;

    case 'minPopularity':
      return track.popularity !== undefined && track.popularity < value;

    default:
      return false;
  }
}

/**
 * Estimate how many tracks would pass constraints
 */
export function estimateConstraintPassRate(tracks: TrackRef[], rules: Rules): {
  estimatedPassCount: number;
  estimatedFailCount: number;
  passRate: number;
  constraintBreakdown: Record<string, number>;
} {
  const constraintBreakdown: Record<string, number> = {};
  let passCount = 0;

  for (const track of tracks) {
    const violations = validateConstraints(track, rules);

    if (violations.length === 0) {
      passCount++;
    } else {
      for (const violation of violations) {
        constraintBreakdown[violation] = (constraintBreakdown[violation] || 0) + 1;
      }
    }
  }

  // Adjust for maxTracks constraint
  if (rules.maxTracks && passCount > rules.maxTracks) {
    constraintBreakdown['Exceeds maximum tracks limit'] = passCount - rules.maxTracks;
    passCount = rules.maxTracks;
  }

  // Adjust for uniqueArtists constraint
  if (rules.uniqueArtists) {
    const uniqueResult = enforceUniqueArtists(tracks.filter(t => validateConstraints(t, rules).length === 0));
    const uniquePassCount = uniqueResult.accepted.length;

    if (uniquePassCount < passCount) {
      constraintBreakdown['Artist already represented'] = passCount - uniquePassCount;
      passCount = uniquePassCount;
    }
  }

  const failCount = tracks.length - passCount;
  const passRate = tracks.length > 0 ? passCount / tracks.length : 0;

  return {
    estimatedPassCount: passCount,
    estimatedFailCount: failCount,
    passRate,
    constraintBreakdown,
  };
}

/**
 * Merge multiple rule sets, with later rules taking precedence
 */
export function mergeRules(...ruleSets: Rules[]): Rules {
  const merged: Rules = {};

  for (const rules of ruleSets) {
    if (rules.maxTracks !== undefined) merged.maxTracks = rules.maxTracks;
    if (rules.allowExplicit !== undefined) merged.allowExplicit = rules.allowExplicit;
    if (rules.minPopularity !== undefined) merged.minPopularity = rules.minPopularity;
    if (rules.uniqueArtists !== undefined) merged.uniqueArtists = rules.uniqueArtists;
    if (rules.dedupeBy !== undefined) merged.dedupeBy = [...rules.dedupeBy];
  }

  return merged;
}
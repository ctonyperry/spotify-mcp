import type { TrackRef, Rules, MutationPlan, AddTracksStep, RemoveTracksStep, ReorderStep } from '../types.js';
import { IdempotencyError, ValidationError } from '../errors.js';
import { deduplicateTracks } from '../rules/dedupe.js';
import { applyConstraints } from '../rules/constraints.js';

/**
 * Generate idempotent mutation steps to transform existing tracks to target state
 */
export function generateMutationPlan(
  existing: TrackRef[],
  target: TrackRef[],
  rules: Rules
): MutationPlan {
  // Apply rules to target tracks first
  const processedTarget = processTargetTracks(target, rules);

  // Generate mutation steps
  const adds = generateAddSteps(existing, processedTarget);
  const removes = generateRemoveSteps(existing, processedTarget);
  const reorders = generateReorderSteps(existing, processedTarget, rules);

  return {
    adds,
    removes,
    reorders,
    annotations: [], // Annotations are handled at playlist level, not track level
  };
}

/**
 * Process target tracks through rules (dedupe, constraints)
 */
function processTargetTracks(tracks: TrackRef[], rules: Rules): TrackRef[] {
  let processed = [...tracks];

  // Apply deduplication
  if (rules.dedupeBy && rules.dedupeBy.length > 0) {
    const dedupeResult = deduplicateTracks(processed, rules);
    processed = dedupeResult.deduped;
  }

  // Apply constraints
  const constraintResult = applyConstraints(processed, rules);
  processed = constraintResult.accepted;

  return processed;
}

/**
 * Generate add steps for tracks that need to be added
 */
function generateAddSteps(existing: TrackRef[], target: TrackRef[]): AddTracksStep[] {
  const existingUris = new Set(existing.map(t => t.uri));
  const toAdd = target.filter(t => !existingUris.has(t.uri));

  if (toAdd.length === 0) {
    return [];
  }

  // Chunk into batches of 100 (Spotify's limit)
  const chunks = chunkArray(toAdd, 100);
  return chunks.map(chunk => ({
    type: 'add' as const,
    tracks: chunk,
  }));
}

/**
 * Generate remove steps for tracks that should be removed
 */
function generateRemoveSteps(existing: TrackRef[], target: TrackRef[]): RemoveTracksStep[] {
  const targetUris = new Set(target.map(t => t.uri));
  const toRemove = existing.filter(t => !targetUris.has(t.uri));

  if (toRemove.length === 0) {
    return [];
  }

  // Chunk into batches of 100
  const chunks = chunkArray(toRemove, 100);
  return chunks.map(chunk => ({
    type: 'remove' as const,
    tracks: chunk,
  }));
}

/**
 * Generate reorder steps if track order matters
 */
function generateReorderSteps(
  existing: TrackRef[],
  target: TrackRef[],
  rules: Rules
): ReorderStep[] {
  // Only reorder if we have specific ordering requirements
  if (!shouldReorder(rules)) {
    return [];
  }

  // For simplicity, generate a single reorder step to sort the entire playlist
  // In a more sophisticated implementation, we could optimize this to minimize moves
  return [{
    type: 'reorder' as const,
    from: 0,
    to: -1, // Special value meaning "sort entire playlist"
    count: -1,
  }];
}

/**
 * Check if reordering is needed based on rules
 */
function shouldReorder(rules: Rules): boolean {
  // Reorder if we need unique artists (for optimal distribution)
  return !!(rules.uniqueArtists);
}

/**
 * Apply a mutation plan to an existing track list (for simulation)
 */
export function applyMutationPlan(
  existing: TrackRef[],
  plan: MutationPlan
): TrackRef[] {
  let result = [...existing];

  // Apply removes first
  for (const removeStep of plan.removes) {
    const removeUris = new Set(removeStep.tracks.map(t => t.uri));
    result = result.filter(t => !removeUris.has(t.uri));
  }

  // Apply adds
  for (const addStep of plan.adds) {
    if (addStep.position !== undefined) {
      result.splice(addStep.position, 0, ...addStep.tracks);
    } else {
      result.push(...addStep.tracks);
    }
  }

  // Apply reorders
  for (const reorderStep of plan.reorders) {
    if (reorderStep.to === -1) {
      // Sort entire playlist
      result.sort((a, b) => {
        // Sort by artist first, then by name
        const artistCompare = a.artists[0]?.localeCompare(b.artists[0] || '') || 0;
        if (artistCompare !== 0) return artistCompare;
        return a.name.localeCompare(b.name);
      });
    } else {
      // Move specific range
      const toMove = result.splice(reorderStep.from, reorderStep.count);
      result.splice(reorderStep.to, 0, ...toMove);
    }
  }

  return result;
}

/**
 * Check if a mutation plan is idempotent (applying twice gives same result)
 */
export function validateIdempotency(
  existing: TrackRef[],
  plan: MutationPlan
): boolean {
  try {
    const firstApply = applyMutationPlan(existing, plan);
    const secondPlan = generateMutationPlan(firstApply, firstApply, {});

    // Second plan should have no operations
    return (
      secondPlan.adds.length === 0 &&
      secondPlan.removes.length === 0 &&
      secondPlan.reorders.length === 0
    );
  } catch {
    return false;
  }
}

/**
 * Estimate the impact of applying a mutation plan
 */
export function estimateMutationImpact(
  existing: TrackRef[],
  plan: MutationPlan
): {
  tracksAdded: number;
  tracksRemoved: number;
  tracksMoved: number;
  finalCount: number;
  estimatedDurationMs: number;
} {
  const tracksAdded = plan.adds.reduce((sum, step) => sum + step.tracks.length, 0);
  const tracksRemoved = plan.removes.reduce((sum, step) => sum + step.tracks.length, 0);
  const tracksMoved = plan.reorders.reduce((sum, step) =>
    step.count === -1 ? existing.length : sum + step.count, 0);

  const finalCount = existing.length + tracksAdded - tracksRemoved;

  // Estimate duration: ~500ms per API call
  const apiCalls = plan.adds.length + plan.removes.length + plan.reorders.length;
  const estimatedDurationMs = apiCalls * 500;

  return {
    tracksAdded,
    tracksRemoved,
    tracksMoved,
    finalCount,
    estimatedDurationMs,
  };
}

/**
 * Optimize a mutation plan for better performance
 */
export function optimizeMutationPlan(plan: MutationPlan): MutationPlan {
  // Merge consecutive add steps
  const optimizedAdds = mergeConsecutiveAdds(plan.adds);

  // Merge consecutive remove steps
  const optimizedRemoves = mergeConsecutiveRemoves(plan.removes);

  // Optimize reorders (for now, just pass through)
  const optimizedReorders = [...plan.reorders];

  return {
    adds: optimizedAdds,
    removes: optimizedRemoves,
    reorders: optimizedReorders,
    annotations: [...plan.annotations],
  };
}

/**
 * Merge consecutive add steps to reduce API calls
 */
function mergeConsecutiveAdds(adds: AddTracksStep[]): AddTracksStep[] {
  if (adds.length <= 1) return adds;

  const merged: AddTracksStep[] = [];
  let currentBatch: TrackRef[] = [];

  for (const addStep of adds) {
    // If adding to current batch would exceed limit, flush current batch
    if (currentBatch.length + addStep.tracks.length > 100) {
      if (currentBatch.length > 0) {
        merged.push({ type: 'add', tracks: [...currentBatch] });
        currentBatch = [];
      }
    }

    currentBatch.push(...addStep.tracks);
  }

  // Flush remaining batch
  if (currentBatch.length > 0) {
    merged.push({ type: 'add', tracks: currentBatch });
  }

  return merged;
}

/**
 * Merge consecutive remove steps
 */
function mergeConsecutiveRemoves(removes: RemoveTracksStep[]): RemoveTracksStep[] {
  if (removes.length <= 1) return removes;

  const merged: RemoveTracksStep[] = [];
  let currentBatch: TrackRef[] = [];

  for (const removeStep of removes) {
    if (currentBatch.length + removeStep.tracks.length > 100) {
      if (currentBatch.length > 0) {
        merged.push({ type: 'remove', tracks: [...currentBatch] });
        currentBatch = [];
      }
    }

    currentBatch.push(...removeStep.tracks);
  }

  if (currentBatch.length > 0) {
    merged.push({ type: 'remove', tracks: currentBatch });
  }

  return merged;
}

/**
 * Utility function to chunk arrays
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Validate mutation plan for correctness
 */
export function validateMutationPlan(plan: MutationPlan): void {
  const errors: string[] = [];

  // Validate add steps
  for (const addStep of plan.adds) {
    if (addStep.tracks.length === 0) {
      errors.push('Add step contains no tracks');
    }
    if (addStep.tracks.length > 100) {
      errors.push(`Add step contains ${addStep.tracks.length} tracks, exceeding limit of 100`);
    }
  }

  // Validate remove steps
  for (const removeStep of plan.removes) {
    if (removeStep.tracks.length === 0) {
      errors.push('Remove step contains no tracks');
    }
    if (removeStep.tracks.length > 100) {
      errors.push(`Remove step contains ${removeStep.tracks.length} tracks, exceeding limit of 100`);
    }
  }

  // Validate reorder steps
  for (const reorderStep of plan.reorders) {
    if (reorderStep.from < 0 && reorderStep.from !== -1) {
      errors.push('Invalid reorder from position');
    }
    if (reorderStep.to < 0 && reorderStep.to !== -1) {
      errors.push('Invalid reorder to position');
    }
    if (reorderStep.count < 0 && reorderStep.count !== -1) {
      errors.push('Invalid reorder count');
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(`Invalid mutation plan: ${errors.join('; ')}`);
  }
}
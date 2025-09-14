import type { LibraryDiff } from '../types.js';
import { ValidationError } from '../errors.js';

/**
 * Compute set differences for library operations
 */
export function computeLibraryDiff(
  current: string[],
  desired: string[]
): LibraryDiff {
  const currentSet = new Set(current);
  const desiredSet = new Set(desired);

  const toSave: string[] = [];
  const toRemove: string[] = [];

  // Find items to save (in desired but not in current)
  for (const id of desired) {
    if (!currentSet.has(id)) {
      toSave.push(id);
    }
  }

  // Find items to remove (in current but not in desired)
  for (const id of current) {
    if (!desiredSet.has(id)) {
      toRemove.push(id);
    }
  }

  return { toSave, toRemove };
}

/**
 * Compute incremental library updates for efficient syncing
 */
export function computeIncrementalUpdate(
  previousState: string[],
  currentState: string[],
  desiredState: string[]
): {
  addOperations: LibraryDiff;
  removeOperations: LibraryDiff;
  netChanges: LibraryDiff;
  isIncremental: boolean;
} {
  // Find what changed from previous to current
  const previousToCurrentDiff = computeLibraryDiff(previousState, currentState);

  // Find what needs to change from current to desired
  const currentToDesiredDiff = computeLibraryDiff(currentState, desiredState);

  // Check if this can be done incrementally (no conflicts)
  const hasConflicts = (
    previousToCurrentDiff.toSave.some(id => currentToDesiredDiff.toRemove.includes(id)) ||
    previousToCurrentDiff.toRemove.some(id => currentToDesiredDiff.toSave.includes(id))
  );

  return {
    addOperations: {
      toSave: currentToDesiredDiff.toSave,
      toRemove: [],
    },
    removeOperations: {
      toSave: [],
      toRemove: currentToDesiredDiff.toRemove,
    },
    netChanges: currentToDesiredDiff,
    isIncremental: !hasConflicts,
  };
}

/**
 * Validate library operation parameters
 */
export function validateLibraryOperation(
  operation: 'save' | 'remove',
  ids: string[]
): void {
  const errors: string[] = [];

  if (ids.length === 0) {
    errors.push('No IDs provided for operation');
  }

  if (ids.length > 50) {
    errors.push(`Too many IDs (${ids.length}), maximum is 50 per operation`);
  }

  // Validate ID format (Spotify IDs should be alphanumeric)
  const invalidIds = ids.filter(id => !isValidSpotifyId(id));
  if (invalidIds.length > 0) {
    errors.push(`Invalid Spotify IDs: ${invalidIds.slice(0, 5).join(', ')}`);
  }

  // Check for duplicates
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    errors.push('Duplicate IDs found in operation');
  }

  if (errors.length > 0) {
    throw new ValidationError(`Invalid library operation: ${errors.join('; ')}`);
  }
}

/**
 * Check if a string is a valid Spotify ID
 */
function isValidSpotifyId(id: string): boolean {
  return /^[a-zA-Z0-9]{22}$/.test(id);
}

/**
 * Optimize library operations by batching and deduplicating
 */
export function optimizeLibraryOperations(diff: LibraryDiff): {
  saveBatches: string[][];
  removeBatches: string[][];
  totalOperations: number;
} {
  const saveBatches = chunkArray(diff.toSave, 50);
  const removeBatches = chunkArray(diff.toRemove, 50);

  return {
    saveBatches,
    removeBatches,
    totalOperations: saveBatches.length + removeBatches.length,
  };
}

/**
 * Chunk array into smaller arrays of specified size
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Estimate the impact of library operations
 */
export function estimateLibraryImpact(
  current: string[],
  diff: LibraryDiff
): {
  currentCount: number;
  finalCount: number;
  itemsAdded: number;
  itemsRemoved: number;
  netChange: number;
  estimatedDurationMs: number;
} {
  const itemsAdded = diff.toSave.length;
  const itemsRemoved = diff.toRemove.length;
  const netChange = itemsAdded - itemsRemoved;
  const finalCount = current.length + netChange;

  // Estimate duration: ~300ms per API call
  const { totalOperations } = optimizeLibraryOperations(diff);
  const estimatedDurationMs = totalOperations * 300;

  return {
    currentCount: current.length,
    finalCount,
    itemsAdded,
    itemsRemoved,
    netChange,
    estimatedDurationMs,
  };
}

/**
 * Merge multiple library diffs into a single operation
 */
export function mergeLibraryDiffs(...diffs: LibraryDiff[]): LibraryDiff {
  const allToSave = new Set<string>();
  const allToRemove = new Set<string>();

  for (const diff of diffs) {
    for (const id of diff.toSave) {
      allToSave.add(id);
      allToRemove.delete(id); // Remove conflicts
    }

    for (const id of diff.toRemove) {
      if (!allToSave.has(id)) {
        allToRemove.add(id);
      }
    }
  }

  return {
    toSave: Array.from(allToSave),
    toRemove: Array.from(allToRemove),
  };
}

/**
 * Check if library operations would be safe (no data loss)
 */
export function validateLibrarySafety(
  current: string[],
  diff: LibraryDiff,
  options: {
    allowDataLoss?: boolean;
    maxRemovalPercentage?: number;
  } = {}
): {
  isSafe: boolean;
  warnings: string[];
  criticalIssues: string[];
} {
  const warnings: string[] = [];
  const criticalIssues: string[] = [];

  // Check removal percentage
  const removalPercentage = current.length > 0 ? (diff.toRemove.length / current.length) * 100 : 0;
  const maxRemovalPercentage = options.maxRemovalPercentage || 20;

  if (removalPercentage > maxRemovalPercentage) {
    const issue = `Removing ${removalPercentage.toFixed(1)}% of library items exceeds safety threshold of ${maxRemovalPercentage}%`;
    if (options.allowDataLoss) {
      warnings.push(issue);
    } else {
      criticalIssues.push(issue);
    }
  }

  // Check for complete library wipe
  if (diff.toRemove.length === current.length && diff.toSave.length === 0) {
    const issue = 'Operation would remove all items from library';
    if (options.allowDataLoss) {
      warnings.push(issue);
    } else {
      criticalIssues.push(issue);
    }
  }

  // Check for very large operations
  if (diff.toSave.length > 1000) {
    warnings.push(`Large save operation: ${diff.toSave.length} items`);
  }

  if (diff.toRemove.length > 1000) {
    warnings.push(`Large remove operation: ${diff.toRemove.length} items`);
  }

  return {
    isSafe: criticalIssues.length === 0,
    warnings,
    criticalIssues,
  };
}

/**
 * Generate library operation summary for user confirmation
 */
export function generateLibrarySummary(
  current: string[],
  diff: LibraryDiff,
  itemType: 'tracks' | 'albums' = 'tracks'
): string {
  const impact = estimateLibraryImpact(current, diff);
  const parts: string[] = [];

  if (impact.itemsAdded > 0) {
    parts.push(`Add ${impact.itemsAdded} ${itemType}`);
  }

  if (impact.itemsRemoved > 0) {
    parts.push(`Remove ${impact.itemsRemoved} ${itemType}`);
  }

  if (parts.length === 0) {
    return `No changes needed to your ${itemType} library`;
  }

  const summary = parts.join(' and ');
  const finalCount = `Library will have ${impact.finalCount} ${itemType} total`;
  const duration = impact.estimatedDurationMs > 1000
    ? ` (estimated ${Math.ceil(impact.estimatedDurationMs / 1000)} seconds)`
    : '';

  return `${summary}. ${finalCount}${duration}.`;
}

/**
 * Create a rollback plan for library operations
 */
export function createLibraryRollbackPlan(diff: LibraryDiff): LibraryDiff {
  return {
    toSave: [...diff.toRemove], // Re-save what was removed
    toRemove: [...diff.toSave],  // Remove what was saved
  };
}
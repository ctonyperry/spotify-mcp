import { z } from 'zod';
import type { SearchIntent } from '../types.js';
import { SearchIntentSchema } from '../types.js';
import { ValidationError } from '../errors.js';

/**
 * Normalize search intent inputs into canonical form for adapter consumption
 */
export function normalizeSearchIntent(input: Partial<SearchIntent>): SearchIntent {
  // Validate input against schema
  const validation = SearchIntentSchema.partial().safeParse(input);
  if (!validation.success) {
    throw new ValidationError(
      `Invalid search intent: ${validation.error.message}`,
      { validationErrors: validation.error.errors }
    );
  }

  const normalized: SearchIntent = {};

  // Normalize query string
  if (input.query) {
    normalized.query = input.query.trim();
    if (normalized.query === '') {
      delete normalized.query;
    }
  }

  // Normalize arrays - remove empty strings and duplicates
  if (input.genres && input.genres.length > 0) {
    normalized.genres = [...new Set(input.genres.filter(g => g.trim() !== '').map(g => g.trim().toLowerCase()))];
    if (normalized.genres.length === 0) {
      delete normalized.genres;
    }
  }

  if (input.artists && input.artists.length > 0) {
    normalized.artists = [...new Set(input.artists.filter(a => a.trim() !== '').map(a => a.trim()))];
    if (normalized.artists.length === 0) {
      delete normalized.artists;
    }
  }

  if (input.albums && input.albums.length > 0) {
    normalized.albums = [...new Set(input.albums.filter(a => a.trim() !== '').map(a => a.trim()))];
    if (normalized.albums.length === 0) {
      delete normalized.albums;
    }
  }

  // Normalize year and year range
  if (input.year) {
    normalized.year = input.year;
  } else if (input.yearRange) {
    // Ensure min <= max
    if (input.yearRange.min > input.yearRange.max) {
      throw new ValidationError('Year range min cannot be greater than max');
    }
    normalized.yearRange = { ...input.yearRange };
  }

  // Normalize pagination
  if (input.limit !== undefined) {
    normalized.limit = Math.max(1, Math.min(50, input.limit)); // Clamp between 1-50
  }

  if (input.offset !== undefined) {
    normalized.offset = Math.max(0, input.offset);
  }

  return normalized;
}

/**
 * Merge multiple search intents into a single canonical intent
 */
export function mergeSearchIntents(...intents: SearchIntent[]): SearchIntent {
  const merged: SearchIntent = {};

  for (const intent of intents) {
    // Query: concatenate with space
    if (intent.query) {
      merged.query = merged.query ? `${merged.query} ${intent.query}` : intent.query;
    }

    // Arrays: merge and deduplicate
    if (intent.genres) {
      merged.genres = merged.genres ? [...new Set([...merged.genres, ...intent.genres])] : [...intent.genres];
    }

    if (intent.artists) {
      merged.artists = merged.artists ? [...new Set([...merged.artists, ...intent.artists])] : [...intent.artists];
    }

    if (intent.albums) {
      merged.albums = merged.albums ? [...new Set([...merged.albums, ...intent.albums])] : [...intent.albums];
    }

    // Year: later intents override earlier ones
    if (intent.year) {
      merged.year = intent.year;
      delete merged.yearRange; // Year overrides yearRange
    } else if (intent.yearRange && !merged.year) {
      // Merge year ranges by taking the intersection
      if (merged.yearRange) {
        merged.yearRange = {
          min: Math.max(merged.yearRange.min, intent.yearRange.min),
          max: Math.min(merged.yearRange.max, intent.yearRange.max),
        };

        // If intersection is invalid, remove yearRange
        if (merged.yearRange.min > merged.yearRange.max) {
          delete merged.yearRange;
        }
      } else {
        merged.yearRange = { ...intent.yearRange };
      }
    }

    // Pagination: later intents override
    if (intent.limit !== undefined) {
      merged.limit = intent.limit;
    }

    if (intent.offset !== undefined) {
      merged.offset = intent.offset;
    }
  }

  return normalizeSearchIntent(merged);
}

/**
 * Convert search intent to query string for API consumption
 */
export function searchIntentToQuery(intent: SearchIntent): string {
  const parts: string[] = [];

  if (intent.query) {
    parts.push(intent.query);
  }

  if (intent.genres && intent.genres.length > 0) {
    parts.push(`genre:${intent.genres.map(g => `"${g}"`).join(' OR ')}`);
  }

  if (intent.artists && intent.artists.length > 0) {
    parts.push(`artist:${intent.artists.map(a => `"${a}"`).join(' OR ')}`);
  }

  if (intent.albums && intent.albums.length > 0) {
    parts.push(`album:${intent.albums.map(a => `"${a}"`).join(' OR ')}`);
  }

  if (intent.year) {
    parts.push(`year:${intent.year}`);
  } else if (intent.yearRange) {
    parts.push(`year:${intent.yearRange.min}-${intent.yearRange.max}`);
  }

  return parts.join(' ');
}

/**
 * Validate search intent for common issues
 */
export function validateSearchIntent(intent: SearchIntent): string[] {
  const warnings: string[] = [];

  // Check if intent is too broad
  const hasSpecificCriteria = !!(
    intent.query ||
    intent.genres?.length ||
    intent.artists?.length ||
    intent.albums?.length ||
    intent.year ||
    intent.yearRange
  );

  if (!hasSpecificCriteria) {
    warnings.push('Search intent is very broad - consider adding specific criteria');
  }

  // Check for potentially conflicting criteria
  if (intent.artists?.length && intent.albums?.length) {
    warnings.push('Both artists and albums specified - results may be limited');
  }

  // Check pagination limits
  if (intent.limit && intent.limit > 50) {
    warnings.push('Limit exceeds maximum of 50 - will be clamped');
  }

  // Check year range validity
  if (intent.yearRange) {
    const currentYear = new Date().getFullYear();
    if (intent.yearRange.max > currentYear) {
      warnings.push(`Year range extends beyond current year (${currentYear})`);
    }
  }

  return warnings;
}

/**
 * Estimate search result count based on intent specificity
 */
export function estimateResultCount(intent: SearchIntent): {
  estimatedMin: number;
  estimatedMax: number;
  confidence: 'low' | 'medium' | 'high';
} {
  let specificity = 0;

  if (intent.query) specificity += 0.3;
  if (intent.genres?.length) specificity += 0.2 * Math.min(1, intent.genres.length / 3);
  if (intent.artists?.length) specificity += 0.3 * Math.min(1, intent.artists.length / 2);
  if (intent.albums?.length) specificity += 0.4 * Math.min(1, intent.albums.length / 2);
  if (intent.year || intent.yearRange) specificity += 0.2;

  specificity = Math.min(1, specificity);

  // Rough estimates based on Spotify's catalog size and specificity
  const baseMax = 1000000; // Very broad search
  const baseMin = 1000;

  const estimatedMax = Math.round(baseMax * (1 - specificity * 0.95));
  const estimatedMin = Math.round(baseMin * (1 - specificity * 0.8));

  let confidence: 'low' | 'medium' | 'high';
  if (specificity < 0.3) {
    confidence = 'low';
  } else if (specificity < 0.7) {
    confidence = 'medium';
  } else {
    confidence = 'high';
  }

  return {
    estimatedMin: Math.max(0, estimatedMin),
    estimatedMax: Math.max(estimatedMin, estimatedMax),
    confidence,
  };
}

/**
 * Suggest improvements to search intent
 */
export function suggestSearchImprovements(intent: SearchIntent): string[] {
  const suggestions: string[] = [];

  // If query is very short, suggest being more specific
  if (intent.query && intent.query.length < 3) {
    suggestions.push('Consider using a longer, more specific search query');
  }

  // If no specific criteria, suggest adding some
  const hasSpecific = !!(intent.genres?.length || intent.artists?.length || intent.albums?.length);
  if (!hasSpecific && (!intent.query || intent.query.length < 5)) {
    suggestions.push('Add specific genres, artists, or albums to narrow down results');
  }

  // If year range is very broad, suggest narrowing
  if (intent.yearRange && (intent.yearRange.max - intent.yearRange.min) > 20) {
    suggestions.push('Consider narrowing the year range for more focused results');
  }

  // If too many filters, suggest reducing
  const filterCount = (intent.genres?.length || 0) + (intent.artists?.length || 0) + (intent.albums?.length || 0);
  if (filterCount > 10) {
    suggestions.push('Too many filters may over-constrain results - consider reducing');
  }

  return suggestions;
}
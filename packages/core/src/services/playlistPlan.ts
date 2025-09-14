import { z } from 'zod';
import type { PlaylistPlan, PlaylistIntent, StructuredIntent, PlanStep, SourceSpec, TrackRef, Rules } from '../types.js';
import { PlaylistPlanSchema } from '../types.js';
import { PlanningError, ValidationError } from '../errors.js';

/**
 * Create a playlist plan from intent and sources
 */
export function createPlaylistPlan(intent: PlaylistIntent): PlaylistPlan {
  const structuredIntent = typeof intent.intent === 'string'
    ? parseNaturalLanguageIntent(intent.intent, intent.rules)
    : intent.intent;

  const steps = generatePlanSteps(structuredIntent, intent.sources, intent.rules);

  const plan: PlaylistPlan = {
    name: generatePlaylistName(structuredIntent, intent.sources),
    description: generatePlaylistDescription(structuredIntent, intent.sources),
    public: structuredIntent.criteria.limit && structuredIntent.criteria.limit > 100 ? true : false,
    steps,
  };

  // Validate the plan
  validatePlaylistPlan(plan);

  return plan;
}

/**
 * Parse natural language intent into structured format
 */
function parseNaturalLanguageIntent(nlIntent: string, rules: Rules): StructuredIntent {
  const lower = nlIntent.toLowerCase().trim();

  // Determine action
  let action: 'create' | 'update' | 'append' = 'create';
  let target: string | undefined;

  if (lower.includes('add to') || lower.includes('append to')) {
    action = 'append';
    const match = lower.match(/(?:add to|append to)\s+["']?([^"']+)["']?/);
    target = match?.[1];
  } else if (lower.includes('update') || lower.includes('modify')) {
    action = 'update';
    const match = lower.match(/(?:update|modify)\s+["']?([^"']+)["']?/);
    target = match?.[1];
  }

  // Extract criteria from natural language
  const criteria = extractSearchCriteria(nlIntent);

  return {
    action,
    target,
    criteria,
    rules,
  };
}

/**
 * Extract search criteria from natural language
 */
function extractSearchCriteria(text: string): import('../types.js').SearchIntent {
  const lower = text.toLowerCase();
  const criteria: import('../types.js').SearchIntent = {};

  // Extract genres
  const genrePatterns = [
    /genre[s]?\s*:?\s*([^,\n]+)/g,
    /(?:rock|pop|jazz|classical|country|electronic|hip.?hop|rap|blues|folk|metal|indie|alternative|disco|funk|reggae|latin|world|ambient|house|techno|trance|dubstep|drum.?and.?bass)/gi,
  ];

  const genres = new Set<string>();
  for (const pattern of genrePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (pattern.source.startsWith('genre')) {
        // Extract from "genre: ..." format
        const genreList = match[1].split(/[,&and]+/).map(g => g.trim());
        genreList.forEach(g => g && genres.add(g));
      } else {
        // Direct genre matches
        genres.add(match[0].toLowerCase());
      }
    }
  }

  if (genres.size > 0) {
    criteria.genres = Array.from(genres);
  }

  // Extract artists
  const artistMatch = text.match(/artist[s]?\s*:?\s*([^,\n]+)/i);
  if (artistMatch) {
    const artists = artistMatch[1].split(/[,&and]+/).map(a => a.trim()).filter(a => a);
    if (artists.length > 0) {
      criteria.artists = artists;
    }
  }

  // Extract year information
  const yearMatch = text.match(/(?:from\s+)?(\d{4})(?:\s*-\s*(\d{4}))?/);
  if (yearMatch) {
    if (yearMatch[2]) {
      criteria.yearRange = {
        min: parseInt(yearMatch[1]),
        max: parseInt(yearMatch[2]),
      };
    } else {
      criteria.year = parseInt(yearMatch[1]);
    }
  }

  // Extract decade references
  const decadeMatch = text.match(/(\d{2,4})s/);
  if (decadeMatch && !yearMatch) {
    let decade = parseInt(decadeMatch[1]);
    if (decade < 100) decade += 1900; // Handle "80s" -> 1980s
    criteria.yearRange = {
      min: decade,
      max: decade + 9,
    };
  }

  // Extract query terms (remove already parsed parts)
  let query = text
    .replace(/genre[s]?\s*:?\s*[^,\n]+/gi, '')
    .replace(/artist[s]?\s*:?\s*[^,\n]+/gi, '')
    .replace(/(?:from\s+)?\d{4}(?:\s*-\s*\d{4})?/g, '')
    .replace(/\d{2,4}s/g, '')
    .replace(/(?:add to|append to|update|modify)\s+["']?[^"']+["']?/gi, '')
    .trim();

  // Clean up query
  query = query.replace(/\s+/g, ' ').trim();
  if (query.length > 2) {
    criteria.query = query;
  }

  return criteria;
}

/**
 * Generate plan steps from structured intent and sources
 */
function generatePlanSteps(intent: StructuredIntent, sources: SourceSpec[], rules: Rules): PlanStep[] {
  const steps: PlanStep[] = [];

  // Add annotation steps for name/description if this is create/update
  if (intent.action === 'create' || intent.action === 'update') {
    const name = generatePlaylistName(intent, sources);
    if (name) {
      steps.push({
        type: 'annotate',
        field: 'name',
        value: name,
      });
    }

    const description = generatePlaylistDescription(intent, sources);
    if (description) {
      steps.push({
        type: 'annotate',
        field: 'description',
        value: description,
      });
    }
  }

  // Generate add steps for each source
  for (const source of sources) {
    if (source.tracks && source.tracks.length > 0) {
      // Split into chunks for batch processing
      const chunks = chunkTracks(source.tracks, 100);

      for (const chunk of chunks) {
        steps.push({
          type: 'add',
          tracks: chunk,
        });
      }
    }
  }

  // Add reorder step if rules specify ordering
  if (steps.some(s => s.type === 'add') && shouldReorder(intent, rules)) {
    steps.push({
      type: 'reorder',
      from: 0,
      to: -1, // Sort entire playlist
      count: -1,
    });
  }

  return steps;
}

/**
 * Generate playlist name from intent and sources
 */
function generatePlaylistName(intent: StructuredIntent, sources: SourceSpec[]): string {
  // If updating existing playlist, don't change name
  if (intent.action === 'update' || intent.action === 'append') {
    return intent.target || 'My Playlist';
  }

  const parts: string[] = [];

  // Use query or criteria to build name
  if (intent.criteria.query) {
    parts.push(intent.criteria.query);
  }

  if (intent.criteria.genres && intent.criteria.genres.length > 0) {
    if (intent.criteria.genres.length === 1) {
      parts.push(intent.criteria.genres[0]);
    } else {
      parts.push(`${intent.criteria.genres[0]} & More`);
    }
  }

  if (intent.criteria.year) {
    parts.push(`${intent.criteria.year}`);
  } else if (intent.criteria.yearRange) {
    parts.push(`${intent.criteria.yearRange.min}-${intent.criteria.yearRange.max}`);
  }

  // Add "Mix" suffix if name is generic
  let name = parts.join(' ') || 'My Mix';
  if (name.split(' ').length === 1 && intent.criteria.genres?.length === 1) {
    name += ' Mix';
  }

  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.slice(1);

  // Limit length
  if (name.length > 100) {
    name = name.substring(0, 97) + '...';
  }

  return name;
}

/**
 * Generate playlist description from intent and sources
 */
function generatePlaylistDescription(intent: StructuredIntent, sources: SourceSpec[]): string | undefined {
  const parts: string[] = [];

  if (intent.criteria.query) {
    parts.push(`Tracks matching "${intent.criteria.query}"`);
  }

  if (intent.criteria.artists && intent.criteria.artists.length > 0) {
    if (intent.criteria.artists.length === 1) {
      parts.push(`Featuring ${intent.criteria.artists[0]}`);
    } else {
      parts.push(`Featuring ${intent.criteria.artists.slice(0, 2).join(', ')} and others`);
    }
  }

  if (intent.criteria.genres && intent.criteria.genres.length > 0) {
    parts.push(`Genres: ${intent.criteria.genres.slice(0, 3).join(', ')}`);
  }

  if (intent.criteria.year) {
    parts.push(`From ${intent.criteria.year}`);
  } else if (intent.criteria.yearRange) {
    parts.push(`From ${intent.criteria.yearRange.min} to ${intent.criteria.yearRange.max}`);
  }

  const description = parts.join('. ');
  return description.length > 0 ? description : undefined;
}

/**
 * Chunk tracks into smaller arrays for batch processing
 */
function chunkTracks(tracks: TrackRef[], chunkSize: number): TrackRef[][] {
  const chunks: TrackRef[][] = [];
  for (let i = 0; i < tracks.length; i += chunkSize) {
    chunks.push(tracks.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Determine if playlist should be reordered based on intent and rules
 */
function shouldReorder(intent: StructuredIntent, rules: Rules): boolean {
  // Reorder if we have specific sorting criteria
  return !!(
    intent.criteria.year ||
    intent.criteria.yearRange ||
    rules.uniqueArtists
  );
}

/**
 * Validate playlist plan for consistency and feasibility
 */
function validatePlaylistPlan(plan: PlaylistPlan): void {
  const validation = PlaylistPlanSchema.safeParse(plan);
  if (!validation.success) {
    throw new ValidationError(
      `Invalid playlist plan: ${validation.error.message}`,
      { validationErrors: validation.error.errors }
    );
  }

  const errors: string[] = [];

  // Check for empty plan
  if (plan.steps.length === 0) {
    errors.push('Plan has no steps');
  }

  // Count total tracks to be added
  let totalTracks = 0;
  for (const step of plan.steps) {
    if (step.type === 'add') {
      totalTracks += step.tracks.length;
    }
  }

  if (totalTracks === 0 && plan.steps.some(s => s.type === 'add')) {
    errors.push('Plan has add steps but no tracks to add');
  }

  // Check for Spotify limits
  if (totalTracks > 10000) {
    errors.push(`Plan would add ${totalTracks} tracks, exceeding Spotify's 10,000 track limit`);
  }

  if (errors.length > 0) {
    throw new PlanningError(`Plan validation failed: ${errors.join('; ')}`, { plan, errors });
  }
}

/**
 * Estimate plan execution time
 */
export function estimatePlanDuration(plan: PlaylistPlan): {
  estimatedSeconds: number;
  estimatedSteps: number;
  apiCalls: number;
} {
  let apiCalls = 0;
  let steps = 0;

  for (const step of plan.steps) {
    steps++;
    switch (step.type) {
      case 'add':
        // Spotify allows up to 100 tracks per add request
        apiCalls += Math.ceil(step.tracks.length / 100);
        break;
      case 'remove':
        apiCalls += Math.ceil(step.tracks.length / 100);
        break;
      case 'reorder':
        apiCalls += 1;
        break;
      case 'annotate':
        apiCalls += 1;
        break;
    }
  }

  // Estimate ~1 second per API call including rate limiting
  const estimatedSeconds = apiCalls * 1.2;

  return { estimatedSeconds, estimatedSteps: steps, apiCalls };
}

/**
 * Optimize plan for better performance
 */
export function optimizePlan(plan: PlaylistPlan): PlaylistPlan {
  const optimized = { ...plan };
  const newSteps: PlanStep[] = [];

  // Group consecutive add steps
  let currentAddTracks: TrackRef[] = [];

  for (const step of plan.steps) {
    if (step.type === 'add') {
      currentAddTracks.push(...step.tracks);
    } else {
      // Flush accumulated add tracks
      if (currentAddTracks.length > 0) {
        const chunks = chunkTracks(currentAddTracks, 100);
        for (const chunk of chunks) {
          newSteps.push({ type: 'add', tracks: chunk });
        }
        currentAddTracks = [];
      }
      newSteps.push(step);
    }
  }

  // Flush any remaining add tracks
  if (currentAddTracks.length > 0) {
    const chunks = chunkTracks(currentAddTracks, 100);
    for (const chunk of chunks) {
      newSteps.push({ type: 'add', tracks: chunk });
    }
  }

  optimized.steps = newSteps;
  return optimized;
}
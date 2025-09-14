import { z } from 'zod';

// Domain Types
export interface TrackRef {
  uri: string;
  id: string;
  name: string;
  artists: string[];
  durationMs: number;
  explicit?: boolean;
  popularity?: number;
}

export interface Rules {
  maxTracks?: number;
  allowExplicit?: boolean;
  dedupeBy?: Array<'uri' | 'id' | 'audioHash' | 'name+artist'>;
  minPopularity?: number;
  uniqueArtists?: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// Playlist Planning Types
export type PlanStep = AddTracksStep | RemoveTracksStep | ReorderStep | AnnotateStep;

export interface AddTracksStep {
  type: 'add';
  tracks: TrackRef[];
  position?: number;
}

export interface RemoveTracksStep {
  type: 'remove';
  tracks: TrackRef[];
}

export interface ReorderStep {
  type: 'reorder';
  from: number;
  to: number;
  count: number;
}

export interface AnnotateStep {
  type: 'annotate';
  field: 'name' | 'description';
  value: string;
}

export interface PlaylistPlan {
  name: string;
  description?: string;
  public?: boolean;
  steps: PlanStep[];
}

// Search and Selection Types
export interface SearchIntent {
  query?: string;
  genres?: string[];
  artists?: string[];
  albums?: string[];
  year?: number;
  yearRange?: { min: number; max: number };
  limit?: number;
  offset?: number;
}

export interface SourceSpec {
  type: 'search' | 'playlist' | 'album' | 'artist' | 'saved';
  id?: string;
  query?: string;
  tracks?: TrackRef[];
}

export interface PlaylistIntent {
  intent: string | StructuredIntent;
  rules: Rules;
  sources: SourceSpec[];
}

export interface StructuredIntent {
  action: 'create' | 'update' | 'append';
  target?: string; // playlist ID for update/append
  criteria: SearchIntent;
  rules: Rules;
}

// Results and Rejections
export interface DedupeResult {
  deduped: TrackRef[];
  removed: TrackRef[];
}

export interface ConstraintResult<T> {
  accepted: T[];
  rejected: Array<{ reason: string; item: T }>;
}

export interface SelectionResult {
  selected: TrackRef[];
  scored: Array<{ track: TrackRef; score: number }>;
}

export interface MutationPlan {
  adds: AddTracksStep[];
  removes: RemoveTracksStep[];
  reorders: ReorderStep[];
  annotations: AnnotateStep[];
}

// Library Management Types
export interface LibraryDiff {
  toSave: string[];
  toRemove: string[];
}

// Playback Types
export interface PlaybackCommand {
  action: 'play' | 'pause' | 'next' | 'previous';
  contextUri?: string;
  trackUri?: string;
  positionMs?: number;
}

export interface PlaybackDecision {
  shouldExecute: boolean;
  reason?: string;
  command?: PlaybackCommand;
}

// Validation Schemas
export const TrackRefSchema = z.object({
  uri: z.string().regex(/^spotify:track:/),
  id: z.string(),
  name: z.string().min(1),
  artists: z.array(z.string()).min(1),
  durationMs: z.number().positive(),
  explicit: z.boolean().optional(),
  popularity: z.number().min(0).max(100).optional(),
});

export const RulesSchema = z.object({
  maxTracks: z.number().positive().optional(),
  allowExplicit: z.boolean().optional(),
  dedupeBy: z.array(z.enum(['uri', 'id', 'audioHash', 'name+artist'])).optional(),
  minPopularity: z.number().min(0).max(100).optional(),
  uniqueArtists: z.boolean().optional(),
});

export const SearchIntentSchema = z.object({
  query: z.string().optional(),
  genres: z.array(z.string()).optional(),
  artists: z.array(z.string()).optional(),
  albums: z.array(z.string()).optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  yearRange: z.object({
    min: z.number().int().min(1900),
    max: z.number().int().max(new Date().getFullYear()),
  }).optional(),
  limit: z.number().positive().max(50).optional(),
  offset: z.number().nonnegative().optional(),
});

export const PlaylistPlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  public: z.boolean().optional(),
  steps: z.array(z.object({
    type: z.enum(['add', 'remove', 'reorder', 'annotate']),
  })),
});
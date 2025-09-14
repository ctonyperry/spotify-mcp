/**
 * Playback Tool Schemas
 */

import { z } from 'zod';
import { SpotifyUriSchema, TrackRefSchema } from './common.js';

// playback.state.get
export const PlaybackStateInputSchema = z.object({});

export const PlaybackStateOutputSchema = z.object({
  isPlaying: z.boolean(),
  currentTrack: TrackRefSchema.nullable(),
  context: z.object({
    uri: SpotifyUriSchema,
    type: z.enum(['playlist', 'album', 'artist']),
  }).nullable(),
  progressMs: z.number().int().min(0).nullable(),
  shuffleState: z.boolean(),
  repeatState: z.enum(['off', 'context', 'track']),
  volume: z.number().int().min(0).max(100).nullable(),
  device: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    isActive: z.boolean(),
  }).nullable(),
});

// playback.control.set
export const PlaybackControlInputSchema = z.object({
  action: z.enum(['play', 'pause', 'next', 'previous']),
  contextUri: SpotifyUriSchema.optional(),
  trackUri: SpotifyUriSchema.optional(),
  positionMs: z.number().int().min(0).optional(),
  deviceId: z.string().optional(),
});

export const PlaybackControlOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  executed: z.boolean(), // Whether the action was actually executed
  reason: z.string().optional(), // Reason if not executed
});

// Type exports
export type PlaybackStateInput = z.infer<typeof PlaybackStateInputSchema>;
export type PlaybackStateOutput = z.infer<typeof PlaybackStateOutputSchema>;
export type PlaybackControlInput = z.infer<typeof PlaybackControlInputSchema>;
export type PlaybackControlOutput = z.infer<typeof PlaybackControlOutputSchema>;
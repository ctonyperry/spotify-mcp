/**
 * Playlist Tool Schemas
 */

import { z } from 'zod';
import { SpotifyUriSchema, SpotifyIdSchema, PageParamsSchema, PageResponseSchema, TrackRefSchema, PlaylistRefSchema } from './common.js';

// playlists.list.mine
export const PlaylistsListInputSchema = z.object({
  ...PageParamsSchema.shape,
});

export const PlaylistsListOutputSchema = PageResponseSchema(PlaylistRefSchema);

// playlists.tracks.get
export const PlaylistTracksGetInputSchema = z.object({
  playlistId: SpotifyIdSchema,
  ...PageParamsSchema.shape,
});

export const PlaylistTracksGetOutputSchema = PageResponseSchema(TrackRefSchema);

// playlists.create
export const PlaylistsCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  public: z.boolean().default(false),
  collaborative: z.boolean().default(false),
});

export const PlaylistsCreateOutputSchema = z.object({
  playlist: PlaylistRefSchema,
  message: z.string(),
});

// playlists.tracks.add
export const PlaylistTracksAddInputSchema = z.object({
  playlistId: SpotifyIdSchema,
  uris: z.array(SpotifyUriSchema).min(1).max(100),
  position: z.number().int().min(0).optional(),
  dedupe: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});

export const PlaylistTracksAddOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  plannedAdds: z.number().int().min(0),
  actualAdds: z.number().int().min(0).optional(), // Only present when not dryRun
  duplicatesSkipped: z.number().int().min(0),
  snapshot: z.string().optional(), // Playlist snapshot ID after changes
});

// Type exports
export type PlaylistsListInput = z.infer<typeof PlaylistsListInputSchema>;
export type PlaylistsListOutput = z.infer<typeof PlaylistsListOutputSchema>;
export type PlaylistTracksGetInput = z.infer<typeof PlaylistTracksGetInputSchema>;
export type PlaylistTracksGetOutput = z.infer<typeof PlaylistTracksGetOutputSchema>;
export type PlaylistsCreateInput = z.infer<typeof PlaylistsCreateInputSchema>;
export type PlaylistsCreateOutput = z.infer<typeof PlaylistsCreateOutputSchema>;
export type PlaylistTracksAddInput = z.infer<typeof PlaylistTracksAddInputSchema>;
export type PlaylistTracksAddOutput = z.infer<typeof PlaylistTracksAddOutputSchema>;
/**
 * Library Tool Schemas
 */

import { z } from 'zod';
import { SpotifyUriSchema, SpotifyIdSchema, PageParamsSchema, PageResponseSchema, TrackRefSchema, AlbumRefSchema } from './common.js';

// library.saved.tracks.get
export const LibrarySavedTracksGetInputSchema = z.object({
  ...PageParamsSchema.shape,
});

export const LibrarySavedTracksGetOutputSchema = PageResponseSchema(
  TrackRefSchema.extend({
    addedAt: z.string(), // ISO date when added to library
  })
);

// library.saved.tracks.save
export const LibrarySavedTracksSaveInputSchema = z.object({
  ids: z.array(SpotifyIdSchema).min(1).max(50),
});

export const LibrarySavedTracksSaveOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  saved: z.number().int().min(0),
  alreadySaved: z.number().int().min(0),
});

// library.saved.tracks.remove
export const LibrarySavedTracksRemoveInputSchema = z.object({
  ids: z.array(SpotifyIdSchema).min(1).max(50),
});

export const LibrarySavedTracksRemoveOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  removed: z.number().int().min(0),
  notFound: z.number().int().min(0),
});

// library.saved.tracks.check
export const LibrarySavedTracksCheckInputSchema = z.object({
  ids: z.array(SpotifyIdSchema).min(1).max(50),
});

export const LibrarySavedTracksCheckOutputSchema = z.object({
  results: z.array(z.object({
    id: SpotifyIdSchema,
    saved: z.boolean(),
  })),
});

// library.saved.albums.get
export const LibrarySavedAlbumsGetInputSchema = z.object({
  ...PageParamsSchema.shape,
});

export const LibrarySavedAlbumsGetOutputSchema = PageResponseSchema(
  AlbumRefSchema.extend({
    addedAt: z.string(), // ISO date when added to library
  })
);

// library.saved.albums.save
export const LibrarySavedAlbumsSaveInputSchema = z.object({
  ids: z.array(SpotifyIdSchema).min(1).max(50),
});

export const LibrarySavedAlbumsSaveOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  saved: z.number().int().min(0),
  alreadySaved: z.number().int().min(0),
});

// library.saved.albums.remove
export const LibrarySavedAlbumsRemoveInputSchema = z.object({
  ids: z.array(SpotifyIdSchema).min(1).max(50),
});

export const LibrarySavedAlbumsRemoveOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  removed: z.number().int().min(0),
  notFound: z.number().int().min(0),
});

// library.saved.albums.check
export const LibrarySavedAlbumsCheckInputSchema = z.object({
  ids: z.array(SpotifyIdSchema).min(1).max(50),
});

export const LibrarySavedAlbumsCheckOutputSchema = z.object({
  results: z.array(z.object({
    id: SpotifyIdSchema,
    saved: z.boolean(),
  })),
});

// Type exports
export type LibrarySavedTracksGetInput = z.infer<typeof LibrarySavedTracksGetInputSchema>;
export type LibrarySavedTracksGetOutput = z.infer<typeof LibrarySavedTracksGetOutputSchema>;
export type LibrarySavedTracksSaveInput = z.infer<typeof LibrarySavedTracksSaveInputSchema>;
export type LibrarySavedTracksSaveOutput = z.infer<typeof LibrarySavedTracksSaveOutputSchema>;
export type LibrarySavedTracksRemoveInput = z.infer<typeof LibrarySavedTracksRemoveInputSchema>;
export type LibrarySavedTracksRemoveOutput = z.infer<typeof LibrarySavedTracksRemoveOutputSchema>;
export type LibrarySavedTracksCheckInput = z.infer<typeof LibrarySavedTracksCheckInputSchema>;
export type LibrarySavedTracksCheckOutput = z.infer<typeof LibrarySavedTracksCheckOutputSchema>;

export type LibrarySavedAlbumsGetInput = z.infer<typeof LibrarySavedAlbumsGetInputSchema>;
export type LibrarySavedAlbumsGetOutput = z.infer<typeof LibrarySavedAlbumsGetOutputSchema>;
export type LibrarySavedAlbumsSaveInput = z.infer<typeof LibrarySavedAlbumsSaveInputSchema>;
export type LibrarySavedAlbumsSaveOutput = z.infer<typeof LibrarySavedAlbumsSaveOutputSchema>;
export type LibrarySavedAlbumsRemoveInput = z.infer<typeof LibrarySavedAlbumsRemoveInputSchema>;
export type LibrarySavedAlbumsRemoveOutput = z.infer<typeof LibrarySavedAlbumsRemoveOutputSchema>;
export type LibrarySavedAlbumsCheckInput = z.infer<typeof LibrarySavedAlbumsCheckInputSchema>;
export type LibrarySavedAlbumsCheckOutput = z.infer<typeof LibrarySavedAlbumsCheckOutputSchema>;
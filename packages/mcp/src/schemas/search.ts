/**
 * Search Tool Schemas
 */

import { z } from 'zod';
import { PageParamsSchema, PageResponseSchema, TrackRefSchema, AlbumRefSchema, ArtistRefSchema } from './common.js';

// tracks.search
export const TracksSearchInputSchema = z.object({
  query: z.string().min(1).max(500),
  ...PageParamsSchema.shape,
});

export const TracksSearchOutputSchema = PageResponseSchema(TrackRefSchema);

// albums.search
export const AlbumsSearchInputSchema = z.object({
  query: z.string().min(1).max(500),
  ...PageParamsSchema.shape,
});

export const AlbumsSearchOutputSchema = PageResponseSchema(AlbumRefSchema);

// artists.search
export const ArtistsSearchInputSchema = z.object({
  query: z.string().min(1).max(500),
  ...PageParamsSchema.shape,
});

export const ArtistsSearchOutputSchema = PageResponseSchema(ArtistRefSchema);

// Type exports
export type TracksSearchInput = z.infer<typeof TracksSearchInputSchema>;
export type TracksSearchOutput = z.infer<typeof TracksSearchOutputSchema>;
export type AlbumsSearchInput = z.infer<typeof AlbumsSearchInputSchema>;
export type AlbumsSearchOutput = z.infer<typeof AlbumsSearchOutputSchema>;
export type ArtistsSearchInput = z.infer<typeof ArtistsSearchInputSchema>;
export type ArtistsSearchOutput = z.infer<typeof ArtistsSearchOutputSchema>;
/**
 * Common MCP Schemas - Reusable Zod helpers
 */

import { z } from 'zod';

// Basic types
export const SpotifyUriSchema = z.string().regex(/^spotify:(track|album|playlist|artist):[a-zA-Z0-9]{22}$/);
export const SpotifyIdSchema = z.string().regex(/^[a-zA-Z0-9]{22}$/);

// Pagination
export const PageParamsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export const PageResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
    hasMore: z.boolean(),
  });

// Common track reference
export const TrackRefSchema = z.object({
  uri: SpotifyUriSchema,
  id: SpotifyIdSchema,
  name: z.string().min(1),
  artists: z.array(z.string().min(1)).min(1),
  durationMs: z.number().int().positive(),
  explicit: z.boolean().optional(),
  popularity: z.number().int().min(0).max(100).optional(),
});

export const AlbumRefSchema = z.object({
  uri: SpotifyUriSchema,
  id: SpotifyIdSchema,
  name: z.string().min(1),
  artists: z.array(z.string().min(1)).min(1),
  releaseDate: z.string().optional(),
  totalTracks: z.number().int().min(1).optional(),
});

export const ArtistRefSchema = z.object({
  uri: SpotifyUriSchema,
  id: SpotifyIdSchema,
  name: z.string().min(1),
  genres: z.array(z.string()).optional(),
  popularity: z.number().int().min(0).max(100).optional(),
  followers: z.number().int().min(0).optional(),
});

export const PlaylistRefSchema = z.object({
  uri: SpotifyUriSchema,
  id: SpotifyIdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  owner: z.string().min(1),
  public: z.boolean(),
  collaborative: z.boolean(),
  trackCount: z.number().int().min(0),
});

// Error response
export const MCPErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryAfterMs: z.number().int().positive().optional(),
  details: z.record(z.unknown()).optional(),
});

// Common response wrappers
export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: MCPErrorSchema,
});

// Type exports
export type SpotifyUri = z.infer<typeof SpotifyUriSchema>;
export type SpotifyId = z.infer<typeof SpotifyIdSchema>;
export type PageParams = z.infer<typeof PageParamsSchema>;
export type TrackRef = z.infer<typeof TrackRefSchema>;
export type AlbumRef = z.infer<typeof AlbumRefSchema>;
export type ArtistRef = z.infer<typeof ArtistRefSchema>;
export type PlaylistRef = z.infer<typeof PlaylistRefSchema>;
export type MCPError = z.infer<typeof MCPErrorSchema>;
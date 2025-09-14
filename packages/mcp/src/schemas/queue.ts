/**
 * Queue Tool Schemas
 */

import { z } from 'zod';
import { SpotifyUriSchema } from './common.js';

// queue.add
export const QueueAddInputSchema = z.object({
  uri: SpotifyUriSchema,
  deviceId: z.string().optional(),
});

export const QueueAddOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  track: z.object({
    uri: SpotifyUriSchema,
    name: z.string(),
    artists: z.array(z.string()).min(1),
  }),
});

// Type exports
export type QueueAddInput = z.infer<typeof QueueAddInputSchema>;
export type QueueAddOutput = z.infer<typeof QueueAddOutputSchema>;
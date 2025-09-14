/**
 * Queue Tool Handlers - Pure orchestration
 */

import { SpotifyClient } from '@spotify-mcp/spotify';
import { mapToMCPError } from '../errors.js';
import type { MCPContext } from '../context.js';
import type {
  QueueAddInput,
  QueueAddOutput,
} from '../schemas/queue.js';

export interface QueueHandlerDeps {
  spotify: SpotifyClient;
}

/**
 * queue.add - Add track to playback queue
 */
export async function queueAddHandler(
  context: MCPContext,
  deps: QueueHandlerDeps,
  input: QueueAddInput
): Promise<QueueAddOutput> {
  try {
    context.logger.debug('Adding track to queue', { uri: input.uri, deviceId: input.deviceId });

    // Get track details for response
    const trackId = input.uri.split(':')[2];
    const track = await deps.spotify.getTrack(trackId);

    // Add to queue
    await deps.spotify.addToQueue({
      uri: input.uri,
      deviceId: input.deviceId,
    });

    return {
      success: true,
      message: `Added "${track.name}" by ${track.artists.join(', ')} to queue`,
      track: {
        uri: track.uri,
        name: track.name,
        artists: track.artists,
      },
    };

  } catch (error) {
    context.logger.error('Add to queue failed', { error, uri: input.uri });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}
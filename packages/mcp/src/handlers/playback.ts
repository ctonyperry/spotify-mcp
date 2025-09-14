/**
 * Playback Tool Handlers - Pure orchestration with domain services
 */

import { SpotifyClient } from '@spotify-mcp/spotify';
import { makePlaybackDecision } from '@spotify-mcp/core/services/playback';
import { mapToMCPError } from '../errors.js';
import type { MCPContext } from '../context.js';
import type {
  PlaybackStateInput,
  PlaybackStateOutput,
  PlaybackControlInput,
  PlaybackControlOutput,
} from '../schemas/playback.js';

export interface PlaybackHandlerDeps {
  spotify: SpotifyClient;
}

/**
 * playback.state.get - Get current playback state
 */
export async function playbackStateGetHandler(
  context: MCPContext,
  deps: PlaybackHandlerDeps,
  input: PlaybackStateInput
): Promise<PlaybackStateOutput> {
  try {
    context.logger.debug('Getting playback state');

    const state = await deps.spotify.getPlaybackState();

    return {
      isPlaying: state.isPlaying,
      currentTrack: state.currentTrack ? {
        uri: state.currentTrack.uri,
        id: state.currentTrack.id,
        name: state.currentTrack.name,
        artists: state.currentTrack.artists,
        durationMs: state.currentTrack.durationMs,
        explicit: state.currentTrack.explicit,
        popularity: state.currentTrack.popularity,
      } : null,
      context: state.context ? {
        uri: state.context.uri,
        type: state.context.type,
      } : null,
      progressMs: state.progressMs,
      shuffleState: state.shuffleState,
      repeatState: state.repeatState,
      volume: state.volume,
      device: state.device ? {
        id: state.device.id,
        name: state.device.name,
        type: state.device.type,
        isActive: state.device.isActive,
      } : null,
    };
  } catch (error) {
    context.logger.error('Get playback state failed', { error });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}

/**
 * playback.control.set - Control playback with domain decision logic
 */
export async function playbackControlSetHandler(
  context: MCPContext,
  deps: PlaybackHandlerDeps,
  input: PlaybackControlInput
): Promise<PlaybackControlOutput> {
  try {
    context.logger.debug('Controlling playback', { action: input.action, deviceId: input.deviceId });

    // Get current state for decision logic
    const currentState = await deps.spotify.getPlaybackState();

    // Use domain service to make playback decision
    const decision = makePlaybackDecision(
      {
        isPlaying: currentState.isPlaying,
        currentTrack: currentState.currentTrack,
        context: currentState.context,
        progressMs: currentState.progressMs,
        shuffleState: currentState.shuffleState,
        repeatState: currentState.repeatState,
        volume: currentState.volume,
      },
      input.action,
      {
        contextUri: input.contextUri,
        trackUri: input.trackUri,
        positionMs: input.positionMs,
      }
    );

    if (!decision.shouldExecute) {
      context.logger.debug('Playback control skipped', { reason: decision.reason });
      return {
        success: true,
        message: decision.reason || 'No action needed',
        executed: false,
        reason: decision.reason,
      };
    }

    // Execute the command via Spotify client
    const command = decision.command!;
    await deps.spotify.controlPlayback({
      action: command.action,
      contextUri: command.contextUri,
      trackUri: command.trackUri,
      positionMs: command.positionMs,
      deviceId: input.deviceId,
    });

    context.logger.debug('Playback control executed', { command: command.action });

    return {
      success: true,
      message: `Playback ${command.action} executed`,
      executed: true,
    };

  } catch (error) {
    context.logger.error('Playback control failed', { error, action: input.action });
    const mcpError = mapToMCPError(error);
    throw new Error(`${mcpError.code}: ${mcpError.message}`);
  }
}
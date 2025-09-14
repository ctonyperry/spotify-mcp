import type { PlaybackCommand, PlaybackDecision } from '../types.js';
import { ValidationError } from '../errors.js';

export interface PlaybackState {
  isPlaying: boolean;
  currentTrack?: {
    uri: string;
    name: string;
    artists: string[];
    durationMs: number;
  };
  context?: {
    uri: string;
    type: 'playlist' | 'album' | 'artist';
  };
  progressMs?: number;
  shuffleState: boolean;
  repeatState: 'off' | 'context' | 'track';
  volume?: number;
}

/**
 * Make playback control decisions based on current state and desired action
 */
export function makePlaybackDecision(
  currentState: PlaybackState,
  desiredAction: PlaybackCommand['action'],
  options: {
    contextUri?: string;
    trackUri?: string;
    positionMs?: number;
  } = {}
): PlaybackDecision {
  // Validate inputs
  validatePlaybackCommand({ action: desiredAction, ...options });

  switch (desiredAction) {
    case 'play':
      return handlePlayCommand(currentState, options);

    case 'pause':
      return handlePauseCommand(currentState);

    case 'next':
      return handleNextCommand(currentState);

    case 'previous':
      return handlePreviousCommand(currentState);

    default:
      return {
        shouldExecute: false,
        reason: `Unknown action: ${desiredAction}`,
      };
  }
}

/**
 * Handle play command logic
 */
function handlePlayCommand(
  state: PlaybackState,
  options: { contextUri?: string; trackUri?: string; positionMs?: number }
): PlaybackDecision {
  // If already playing the same context/track, don't need to do anything
  if (state.isPlaying) {
    // Check if we're playing the requested context
    if (options.contextUri && state.context?.uri === options.contextUri) {
      return {
        shouldExecute: false,
        reason: 'Already playing requested context',
      };
    }

    // Check if we're playing the requested track
    if (options.trackUri && state.currentTrack?.uri === options.trackUri) {
      // If seeking to a specific position, allow it
      if (options.positionMs !== undefined && options.positionMs !== state.progressMs) {
        return {
          shouldExecute: true,
          command: {
            action: 'play',
            trackUri: options.trackUri,
            positionMs: options.positionMs,
          },
        };
      }

      return {
        shouldExecute: false,
        reason: 'Already playing requested track',
      };
    }

    // If no specific context/track requested and already playing, don't duplicate
    if (!options.contextUri && !options.trackUri) {
      return {
        shouldExecute: false,
        reason: 'Already playing',
      };
    }
  }

  // Build play command
  const command: PlaybackCommand = { action: 'play' };

  if (options.contextUri) {
    command.contextUri = options.contextUri;
  }

  if (options.trackUri) {
    command.trackUri = options.trackUri;
  }

  if (options.positionMs !== undefined) {
    command.positionMs = options.positionMs;
  }

  return {
    shouldExecute: true,
    command,
  };
}

/**
 * Handle pause command logic
 */
function handlePauseCommand(state: PlaybackState): PlaybackDecision {
  if (!state.isPlaying) {
    return {
      shouldExecute: false,
      reason: 'Already paused',
    };
  }

  return {
    shouldExecute: true,
    command: { action: 'pause' },
  };
}

/**
 * Handle next track command logic
 */
function handleNextCommand(state: PlaybackState): PlaybackDecision {
  // Always allow next command - let Spotify handle edge cases
  return {
    shouldExecute: true,
    command: { action: 'next' },
  };
}

/**
 * Handle previous track command logic
 */
function handlePreviousCommand(state: PlaybackState): PlaybackDecision {
  // If we're more than 3 seconds into the current track, go to beginning instead
  if (state.progressMs && state.progressMs > 3000) {
    return {
      shouldExecute: true,
      command: {
        action: 'play',
        trackUri: state.currentTrack?.uri,
        positionMs: 0,
      },
    };
  }

  // Otherwise, go to actual previous track
  return {
    shouldExecute: true,
    command: { action: 'previous' },
  };
}

/**
 * Validate playback command parameters
 */
function validatePlaybackCommand(command: PlaybackCommand): void {
  const errors: string[] = [];

  if (!['play', 'pause', 'next', 'previous'].includes(command.action)) {
    errors.push(`Invalid action: ${command.action}`);
  }

  if (command.contextUri && !isValidSpotifyUri(command.contextUri)) {
    errors.push(`Invalid context URI: ${command.contextUri}`);
  }

  if (command.trackUri && !isValidSpotifyUri(command.trackUri)) {
    errors.push(`Invalid track URI: ${command.trackUri}`);
  }

  if (command.positionMs !== undefined && command.positionMs < 0) {
    errors.push('Position cannot be negative');
  }

  if (errors.length > 0) {
    throw new ValidationError(`Invalid playback command: ${errors.join('; ')}`);
  }
}

/**
 * Check if URI is a valid Spotify URI
 */
function isValidSpotifyUri(uri: string): boolean {
  return /^spotify:(track|album|playlist|artist):[a-zA-Z0-9]+$/.test(uri);
}

/**
 * Determine optimal playback action based on user intent
 */
export function resolvePlaybackIntent(
  intent: string,
  currentState: PlaybackState,
  context?: {
    availableTracks?: Array<{ uri: string; name: string }>;
    currentPlaylist?: string;
  }
): PlaybackDecision {
  const lower = intent.toLowerCase().trim();

  // Handle explicit commands
  if (lower.includes('pause') || lower.includes('stop')) {
    return makePlaybackDecision(currentState, 'pause');
  }

  if (lower.includes('next') || lower.includes('skip')) {
    return makePlaybackDecision(currentState, 'next');
  }

  if (lower.includes('previous') || lower.includes('back') || lower.includes('last')) {
    return makePlaybackDecision(currentState, 'previous');
  }

  if (lower.includes('play')) {
    // Check if they want to play something specific
    if (context?.availableTracks) {
      const trackMatch = context.availableTracks.find(track =>
        lower.includes(track.name.toLowerCase())
      );

      if (trackMatch) {
        return makePlaybackDecision(currentState, 'play', {
          trackUri: trackMatch.uri,
        });
      }
    }

    // Just resume playing
    return makePlaybackDecision(currentState, 'play');
  }

  // Handle song/track requests
  if (lower.includes('song') || lower.includes('track')) {
    if (context?.availableTracks) {
      // Try to find matching track in context
      const words = lower.split(/\s+/);
      const trackMatch = context.availableTracks.find(track => {
        const trackWords = track.name.toLowerCase().split(/\s+/);
        return words.some(word => trackWords.some(trackWord => trackWord.includes(word)));
      });

      if (trackMatch) {
        return makePlaybackDecision(currentState, 'play', {
          trackUri: trackMatch.uri,
        });
      }
    }
  }

  return {
    shouldExecute: false,
    reason: `Could not resolve intent: "${intent}"`,
  };
}

/**
 * Generate smart playback suggestions based on current state
 */
export function generatePlaybackSuggestions(
  state: PlaybackState,
  context?: {
    queueLength?: number;
    upNext?: Array<{ uri: string; name: string; artists: string[] }>;
    recentTracks?: Array<{ uri: string; name: string; artists: string[] }>;
  }
): Array<{ action: string; description: string; command: PlaybackCommand }> {
  const suggestions: Array<{ action: string; description: string; command: PlaybackCommand }> = [];

  if (state.isPlaying) {
    suggestions.push({
      action: 'pause',
      description: 'Pause current playback',
      command: { action: 'pause' },
    });

    suggestions.push({
      action: 'next',
      description: 'Skip to next track',
      command: { action: 'next' },
    });

    if (state.progressMs && state.progressMs > 10000) {
      suggestions.push({
        action: 'restart',
        description: 'Restart current track',
        command: {
          action: 'play',
          trackUri: state.currentTrack?.uri,
          positionMs: 0,
        },
      });
    }
  } else {
    suggestions.push({
      action: 'resume',
      description: 'Resume playback',
      command: { action: 'play' },
    });
  }

  // Suggest recent tracks
  if (context?.recentTracks) {
    context.recentTracks.slice(0, 3).forEach((track, index) => {
      suggestions.push({
        action: `play_recent_${index}`,
        description: `Play "${track.name}" by ${track.artists.join(', ')}`,
        command: {
          action: 'play',
          trackUri: track.uri,
        },
      });
    });
  }

  // Suggest shuffle toggle
  suggestions.push({
    action: 'toggle_shuffle',
    description: state.shuffleState ? 'Turn off shuffle' : 'Turn on shuffle',
    command: { action: 'play' }, // This would need to be handled specially
  });

  return suggestions;
}

/**
 * Calculate optimal seek position for track navigation
 */
export function calculateSeekPosition(
  currentTrack: { durationMs: number },
  intent: 'beginning' | 'end' | 'middle' | number
): number {
  switch (intent) {
    case 'beginning':
      return 0;

    case 'end':
      return Math.max(0, currentTrack.durationMs - 5000); // 5 seconds before end

    case 'middle':
      return Math.floor(currentTrack.durationMs / 2);

    default:
      if (typeof intent === 'number') {
        return Math.max(0, Math.min(intent, currentTrack.durationMs));
      }
      return 0;
  }
}
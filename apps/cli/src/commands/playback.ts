import { Command } from 'commander';
import { formatOutput, logError, logSuccess } from '../lib/output.js';
import type { CLIContext } from '../lib/setup.js';

export const playbackCommand = new Command('playback')
  .description('Playback control operations');

playbackCommand
  .command('state')
  .description('Get current playback state')
  .action(async (options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      const stateTool = context.tools.find((t: any) => t.name === 'playback.state.get');

      if (!stateTool) {
        throw new Error('playback.state.get tool not found');
      }

      if (globalOptions.dryRun) {
        console.log('Would get current playback state');
        return;
      }

      const result = await stateTool.handler({});
      formatOutput(result, globalOptions);

    } catch (error) {
      logError('Failed to get playback state', error);
      process.exit(1);
    }
  });

playbackCommand
  .command('control <action>')
  .description('Control playback (play, pause, next, previous)')
  .option('--device-id <id>', 'Target device ID')
  .action(async (action: string, options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      const validActions = ['play', 'pause', 'next', 'previous'];
      if (!validActions.includes(action)) {
        throw new Error(`Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`);
      }

      const controlTool = context.tools.find((t: any) => t.name === 'playback.control.set');

      if (!controlTool) {
        throw new Error('playback.control.set tool not found');
      }

      if (globalOptions.dryRun) {
        console.log(`Would ${action} playback`);
        if (options.deviceId) {
          console.log(`Target device: ${options.deviceId}`);
        }
        return;
      }

      const result = await controlTool.handler({
        action,
        deviceId: options.deviceId,
      });

      logSuccess(`Playback ${action} command sent`);

      // Only format output if there's meaningful data
      if (result && Object.keys(result).length > 0) {
        formatOutput(result, globalOptions);
      }

    } catch (error) {
      logError(`Failed to ${action} playback`, error);
      process.exit(1);
    }
  });

playbackCommand
  .command('volume <level>')
  .description('Set playback volume (0-100)')
  .option('--device-id <id>', 'Target device ID')
  .action(async (level: string, options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      const volumeLevel = parseInt(level);
      if (isNaN(volumeLevel) || volumeLevel < 0 || volumeLevel > 100) {
        throw new Error('Volume must be a number between 0 and 100');
      }

      if (globalOptions.dryRun) {
        console.log(`Would set volume to ${volumeLevel}%`);
        if (options.deviceId) {
          console.log(`Target device: ${options.deviceId}`);
        }
        return;
      }

      // Use Spotify client directly for volume control
      await context.spotify.setVolume(volumeLevel, options.deviceId);

      logSuccess(`Volume set to ${volumeLevel}%`);

    } catch (error) {
      logError('Failed to set volume', error);
      process.exit(1);
    }
  });
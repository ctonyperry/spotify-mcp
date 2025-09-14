import { Command } from 'commander';
import { formatOutput, logError, logSuccess } from '../lib/output.js';
import type { CLIContext } from '../lib/setup.js';

export const queueCommand = new Command('queue')
  .description('Queue management operations');

queueCommand
  .command('add <trackUri>')
  .description('Add a track to the playback queue')
  .option('--device-id <id>', 'Target device ID')
  .action(async (trackUri: string, options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      // Validate URI format
      if (!trackUri.startsWith('spotify:track:') && !trackUri.match(/^[a-zA-Z0-9]{22}$/)) {
        throw new Error('Track URI must be in format "spotify:track:ID" or just the track ID');
      }

      const addTool = context.tools.find((t: any) => t.name === 'queue.add');

      if (!addTool) {
        throw new Error('queue.add tool not found');
      }

      if (globalOptions.dryRun) {
        console.log(`Would add track to queue: ${trackUri}`);
        if (options.deviceId) {
          console.log(`Target device: ${options.deviceId}`);
        }
        return;
      }

      // Ensure proper URI format
      const formattedUri = trackUri.startsWith('spotify:track:')
        ? trackUri
        : `spotify:track:${trackUri}`;

      const result = await addTool.handler({
        trackUri: formattedUri,
        deviceId: options.deviceId,
      });

      logSuccess(`Added track to queue: ${formattedUri}`);

      // Only format output if there's meaningful data
      if (result && Object.keys(result).length > 0) {
        formatOutput(result, globalOptions);
      }

    } catch (error) {
      logError('Failed to add track to queue', error);
      process.exit(1);
    }
  });

queueCommand
  .command('get')
  .description('Get current queue (if supported)')
  .action(async (options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      if (globalOptions.dryRun) {
        console.log('Would get current queue');
        return;
      }

      // Use Spotify client directly since there might not be a specific tool for this
      try {
        const result = await context.spotify.getQueue();
        formatOutput(result, globalOptions);
      } catch (error: any) {
        if (error.message?.includes('Premium required')) {
          console.log('Queue information requires Spotify Premium');
          return;
        }
        throw error;
      }

    } catch (error) {
      logError('Failed to get queue', error);
      process.exit(1);
    }
  });
import { Command } from 'commander';
import { formatOutput, logError, logSuccess } from '../lib/output.js';
import type { CLIContext } from '../lib/setup.js';

export const libraryCommand = new Command('library')
  .description('Library management operations');

libraryCommand
  .command('tracks')
  .description('Get saved tracks')
  .option('--limit <number>', 'Number of results to return', '20')
  .option('--offset <number>', 'Offset for pagination', '0')
  .action(async (options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      const getTool = context.tools.find((t: any) => t.name === 'library.saved.tracks.get');

      if (!getTool) {
        throw new Error('library.saved.tracks.get tool not found');
      }

      if (globalOptions.dryRun) {
        console.log('Would get saved tracks from library');
        console.log(`Parameters: limit=${options.limit}, offset=${options.offset}`);
        return;
      }

      const result = await getTool.handler({
        limit: parseInt(options.limit),
        offset: parseInt(options.offset),
      });

      formatOutput(result, globalOptions);

    } catch (error) {
      logError('Failed to get saved tracks', error);
      process.exit(1);
    }
  });

libraryCommand
  .command('save-track <trackId>')
  .description('Save a track to library')
  .action(async (trackId: string, options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      const saveTool = context.tools.find((t: any) => t.name === 'library.saved.tracks.save');

      if (!saveTool) {
        throw new Error('library.saved.tracks.save tool not found');
      }

      if (globalOptions.dryRun) {
        console.log(`Would save track to library: ${trackId}`);
        return;
      }

      const result = await saveTool.handler({
        trackIds: [trackId],
      });

      logSuccess(`Saved track to library: ${trackId}`);
      formatOutput(result, globalOptions);

    } catch (error) {
      logError('Failed to save track', error);
      process.exit(1);
    }
  });

libraryCommand
  .command('remove-track <trackId>')
  .description('Remove a track from library')
  .action(async (trackId: string, options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      const removeTool = context.tools.find((t: any) => t.name === 'library.saved.tracks.remove');

      if (!removeTool) {
        throw new Error('library.saved.tracks.remove tool not found');
      }

      if (globalOptions.dryRun) {
        console.log(`Would remove track from library: ${trackId}`);
        return;
      }

      const result = await removeTool.handler({
        trackIds: [trackId],
      });

      logSuccess(`Removed track from library: ${trackId}`);
      formatOutput(result, globalOptions);

    } catch (error) {
      logError('Failed to remove track', error);
      process.exit(1);
    }
  });

libraryCommand
  .command('check-track <trackId>')
  .description('Check if a track is saved in library')
  .action(async (trackId: string, options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      const checkTool = context.tools.find((t: any) => t.name === 'library.saved.tracks.check');

      if (!checkTool) {
        throw new Error('library.saved.tracks.check tool not found');
      }

      if (globalOptions.dryRun) {
        console.log(`Would check if track is saved: ${trackId}`);
        return;
      }

      const result = await checkTool.handler({
        trackIds: [trackId],
      });

      const isSaved = result[0] || false;
      console.log(`Track ${trackId} is ${isSaved ? 'saved' : 'not saved'} in library`);

      if (!globalOptions.json) {
        formatOutput({ trackId, saved: isSaved }, globalOptions);
      }

    } catch (error) {
      logError('Failed to check track', error);
      process.exit(1);
    }
  });
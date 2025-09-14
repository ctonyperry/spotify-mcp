import { Command } from 'commander';
import { formatOutput, logError, logSuccess } from '../lib/output.js';
import type { CLIContext } from '../lib/setup.js';

export const playlistsCommand = new Command('playlists')
  .description('Playlist operations');

playlistsCommand
  .command('list')
  .description('List user playlists')
  .option('--limit <number>', 'Number of results to return', '20')
  .option('--offset <number>', 'Offset for pagination', '0')
  .action(async (options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      const listTool = context.tools.find((t: any) => t.name === 'playlists.list.mine');

      if (!listTool) {
        throw new Error('playlists.list.mine tool not found');
      }

      if (globalOptions.dryRun) {
        console.log('Would list user playlists');
        console.log(`Parameters: limit=${options.limit}, offset=${options.offset}`);
        return;
      }

      const result = await listTool.handler({
        limit: parseInt(options.limit),
        offset: parseInt(options.offset),
      });

      formatOutput(result, globalOptions);

    } catch (error) {
      logError('Failed to list playlists', error);
      process.exit(1);
    }
  });

playlistsCommand
  .command('tracks <playlistId>')
  .description('Get tracks from a playlist')
  .option('--limit <number>', 'Number of results to return', '50')
  .option('--offset <number>', 'Offset for pagination', '0')
  .action(async (playlistId: string, options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      const tracksTool = context.tools.find((t: any) => t.name === 'playlists.tracks.get');

      if (!tracksTool) {
        throw new Error('playlists.tracks.get tool not found');
      }

      if (globalOptions.dryRun) {
        console.log(`Would get tracks from playlist: ${playlistId}`);
        console.log(`Parameters: limit=${options.limit}, offset=${options.offset}`);
        return;
      }

      const result = await tracksTool.handler({
        playlistId,
        limit: parseInt(options.limit),
        offset: parseInt(options.offset),
      });

      formatOutput(result, globalOptions);

    } catch (error) {
      logError('Failed to get playlist tracks', error);
      process.exit(1);
    }
  });

playlistsCommand
  .command('create <name>')
  .description('Create a new playlist')
  .option('--description <desc>', 'Playlist description')
  .option('--public', 'Make playlist public', false)
  .action(async (name: string, options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      const createTool = context.tools.find((t: any) => t.name === 'playlists.create');

      if (!createTool) {
        throw new Error('playlists.create tool not found');
      }

      if (globalOptions.dryRun) {
        console.log(`Would create playlist: "${name}"`);
        console.log(`Description: ${options.description || 'None'}`);
        console.log(`Public: ${options.public}`);
        return;
      }

      const result = await createTool.handler({
        name,
        description: options.description,
        public: options.public,
      });

      logSuccess(`Created playlist: ${name}`);
      formatOutput(result, globalOptions);

    } catch (error) {
      logError('Failed to create playlist', error);
      process.exit(1);
    }
  });

playlistsCommand
  .command('add <playlistId>')
  .description('Add tracks to a playlist')
  .requiredOption('--uris <uris>', 'Comma-separated track URIs')
  .option('--position <number>', 'Position to insert tracks')
  .action(async (playlistId: string, options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      const addTool = context.tools.find((t: any) => t.name === 'playlists.tracks.add');

      if (!addTool) {
        throw new Error('playlists.tracks.add tool not found');
      }

      const trackUris = options.uris.split(',').map((uri: string) => uri.trim());

      if (globalOptions.dryRun) {
        console.log(`Would add ${trackUris.length} tracks to playlist: ${playlistId}`);
        console.log(`Track URIs: ${trackUris.join(', ')}`);
        if (options.position) {
          console.log(`Position: ${options.position}`);
        }
        return;
      }

      const result = await addTool.handler({
        playlistId,
        trackUris,
        position: options.position ? parseInt(options.position) : undefined,
      });

      logSuccess(`Added ${trackUris.length} tracks to playlist`);
      formatOutput(result, globalOptions);

    } catch (error) {
      logError('Failed to add tracks to playlist', error);
      process.exit(1);
    }
  });
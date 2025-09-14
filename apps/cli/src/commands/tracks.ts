import { Command } from 'commander';
import { formatOutput, logError } from '../lib/output.js';
import type { CLIContext } from '../lib/setup.js';

export const tracksCommand = new Command('tracks')
  .description('Track search and operations');

tracksCommand
  .command('search <query>')
  .description('Search for tracks')
  .option('--limit <number>', 'Number of results to return', '20')
  .option('--offset <number>', 'Offset for pagination', '0')
  .action(async (query: string, options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      // Find the search tool
      const searchTool = context.tools.find((t: any) => t.name === 'tracks.search');

      if (!searchTool) {
        throw new Error('tracks.search tool not found - ensure MCP handlers are implemented');
      }

      if (globalOptions.dryRun) {
        console.log(`Would search for tracks: "${query}"`);
        console.log(`Parameters: limit=${options.limit}, offset=${options.offset}`);
        return;
      }

      // Execute the tool
      const result = await searchTool.handler({
        query,
        limit: parseInt(options.limit),
        offset: parseInt(options.offset),
      });

      formatOutput(result, globalOptions);

    } catch (error) {
      logError('Failed to search tracks', error);
      process.exit(1);
    }
  });

tracksCommand
  .command('get <id>')
  .description('Get track details by ID')
  .action(async (id: string, options, command) => {
    try {
      const context = command.parent?.parent?.getOptionValue('_context') as CLIContext;
      const globalOptions = command.parent?.parent?.opts();

      if (globalOptions.dryRun) {
        console.log(`Would get track details for: ${id}`);
        return;
      }

      // Use Spotify client directly for individual track lookup
      const result = await context.spotify.getTrack(id);
      formatOutput(result, globalOptions);

    } catch (error) {
      logError('Failed to get track', error);
      process.exit(1);
    }
  });
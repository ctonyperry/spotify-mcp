#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initializeSpotifyMCP } from './lib/setup.js';
import { tracksCommand } from './commands/tracks.js';
import { playlistsCommand } from './commands/playlists.js';
import { playbackCommand } from './commands/playback.js';
import { libraryCommand } from './commands/library.js';
import { queueCommand } from './commands/queue.js';

const program = new Command();

program
  .name('spotify-mcp-cli')
  .description('Demo CLI for Spotify MCP - testing and demonstration tool')
  .version('0.1.0')
  .option('--json', 'Output results as JSON', false)
  .option('--dry-run', 'Show what would be done without executing', false)
  .option('--config <path>', 'Path to config file', './config.json')
  .hook('preAction', async (thisCommand) => {
    try {
      // Initialize Spotify MCP context for all commands
      const context = await initializeSpotifyMCP(thisCommand.opts());
      thisCommand.setOptionValue('_context', context);
    } catch (error) {
      console.error(chalk.red('Failed to initialize Spotify MCP:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Add command groups
program.addCommand(tracksCommand);
program.addCommand(playlistsCommand);
program.addCommand(playbackCommand);
program.addCommand(libraryCommand);
program.addCommand(queueCommand);

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red(`Unknown command: ${program.args.join(' ')}`));
  console.log(chalk.yellow('Run --help for available commands'));
  process.exit(1);
});

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
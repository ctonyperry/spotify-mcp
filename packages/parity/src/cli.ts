#!/usr/bin/env node
/**
 * Parity CLI - Compare new server with legacy implementation
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import { ParityRunner } from './runner.js';
import { getTestCases } from './cases.js';

const program = new Command();

program
  .name('parity')
  .description('Functional parity verification suite')
  .version('1.0.0');

program
  .command('run')
  .description('Run parity tests')
  .option('--cases <filter>', 'Test case filter (default, all, or pattern)', 'default')
  .option('--output <dir>', 'Output directory for reports', 'packages/parity/reports')
  .action(async (options) => {
    console.log(chalk.blue('🎯 Spotify MCP Parity Test Suite\n'));

    const runner = new ParityRunner();

    try {
      // Setup servers
      await runner.setup();

      // Get test cases
      const testCases = getTestCases(options.cases);
      console.log(`📋 Selected ${testCases.length} test cases (filter: ${options.cases})\n`);

      if (testCases.length === 0) {
        console.log(chalk.yellow('⚠️  No test cases matched the filter'));
        process.exit(0);
      }

      // Run tests
      const report = await runner.runTests(testCases);

      // Generate markdown report
      const markdown = runner.generateMarkdownReport(report);
      const reportPath = join(process.cwd(), 'packages/parity/REPORT.md');
      writeFileSync(reportPath, markdown);

      // Save JSON report
      const jsonReportPath = join(process.cwd(), 'packages/parity/reports/report.json');
      writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

      console.log(`📄 Report saved to: ${reportPath}`);
      console.log(`📊 JSON report saved to: ${jsonReportPath}\n`);

      // Print summary
      const { summary } = report;
      if (summary.mismatches > 0) {
        console.log(chalk.red(`❌ ${summary.mismatches} test(s) had MISMATCH - review required`));
        console.log(chalk.yellow(`🟡 ${summary.partial} test(s) had PARTIAL match - check differences`));
        console.log(chalk.green(`✅ ${summary.matches} test(s) had perfect MATCH`));

        if (process.env.CI) {
          console.log('\n🚨 Failing CI build due to mismatches');
          process.exit(1);
        } else {
          console.log('\n⚠️  Would fail CI build (use --fail-on-mismatch in CI)');
        }
      } else {
        console.log(chalk.green(`🎉 All tests passed! ${summary.matches} MATCH, ${summary.partial} PARTIAL`));
      }

    } catch (error) {
      console.error(chalk.red('\n💥 Parity test failed:'), error);
      process.exit(1);
    } finally {
      await runner.teardown();
    }
  });

program.parse();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
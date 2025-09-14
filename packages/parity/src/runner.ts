/**
 * Parity test runner
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { createTwoFilesPatch } from 'diff';
import chalk from 'chalk';
import type { TestCase, ParityResult, ParityReport } from './types.js';
import { NewServerInstance, LegacyServerInstance } from './servers.js';

export class ParityRunner {
  private newServer: NewServerInstance | null = null;
  private legacyServer: LegacyServerInstance | null = null;

  async setup(): Promise<void> {
    console.log('🚀 Setting up servers...');

    try {
      this.newServer = await NewServerInstance.create();
      console.log('✅ New server initialized');
    } catch (error) {
      console.error('❌ Failed to initialize new server:', error);
      throw error;
    }

    try {
      this.legacyServer = new LegacyServerInstance();
      await this.legacyServer.init();
      console.log('✅ Legacy server initialized');
    } catch (error) {
      console.error('❌ Failed to initialize legacy server:', error);
      throw error;
    }
  }

  async teardown(): Promise<void> {
    console.log('🧹 Cleaning up servers...');

    if (this.newServer) {
      await this.newServer.shutdown();
    }

    if (this.legacyServer) {
      await this.legacyServer.shutdown();
    }
  }

  async runTests(testCases: TestCase[]): Promise<ParityReport> {
    if (!this.newServer || !this.legacyServer) {
      throw new Error('Servers not initialized');
    }

    const results: ParityResult[] = [];

    console.log(`\n🧪 Running ${testCases.length} parity tests...\n`);

    for (const testCase of testCases) {
      const result = await this.runSingleTest(testCase);
      results.push(result);

      // Print result immediately
      const statusIcon = result.status === 'MATCH' ? '✅' :
                        result.status === 'PARTIAL' ? '🟡' : '❌';
      console.log(`${statusIcon} ${result.caseName} - ${result.status}`);

      if (result.error) {
        console.log(`   ${chalk.red('Error:')} ${result.error}`);
      }

      if (result.diff && result.status !== 'MATCH') {
        console.log(`   ${chalk.yellow('Diff:')} (saved to reports/)`);
      }
    }

    const summary = {
      total: results.length,
      matches: results.filter(r => r.status === 'MATCH').length,
      partial: results.filter(r => r.status === 'PARTIAL').length,
      mismatches: results.filter(r => r.status === 'MISMATCH').length,
    };

    console.log(`\n📊 Summary: ${summary.matches}/${summary.total} MATCH, ${summary.partial} PARTIAL, ${summary.mismatches} MISMATCH\n`);

    return {
      summary,
      results,
      timestamp: new Date().toISOString(),
    };
  }

  private async runSingleTest(testCase: TestCase): Promise<ParityResult> {
    let newOutput: any = null;
    let legacyOutput: any = null;
    let error: string | undefined = undefined;

    // Call new server
    try {
      newOutput = await this.newServer!.callTool(
        testCase.newServerCall.toolName,
        testCase.newServerCall.args
      );
    } catch (err) {
      error = `New server error: ${err instanceof Error ? err.message : String(err)}`;
    }

    // Call legacy server
    try {
      legacyOutput = await this.legacyServer!.callTool(
        testCase.legacyServerCall.toolName,
        testCase.legacyServerCall.args
      );
    } catch (err) {
      const legacyError = `Legacy server error: ${err instanceof Error ? err.message : String(err)}`;
      error = error ? `${error}; ${legacyError}` : legacyError;
    }

    // If either failed, return mismatch
    if (error) {
      return {
        caseName: testCase.name,
        status: 'MISMATCH',
        newOutput,
        legacyOutput,
        normalizedNew: null,
        normalizedLegacy: null,
        error,
      };
    }

    // Normalize outputs
    const normalizedNew = testCase.normalizer(newOutput);
    const normalizedLegacy = testCase.normalizer(legacyOutput);

    // Compare normalized outputs
    const status = this.compareOutputs(normalizedNew, normalizedLegacy);

    // Generate diff if not matching
    let diff: string | undefined = undefined;
    if (status !== 'MATCH') {
      diff = createTwoFilesPatch(
        'legacy-server',
        'new-server',
        JSON.stringify(normalizedLegacy, null, 2),
        JSON.stringify(normalizedNew, null, 2),
        '',
        '',
        { context: 3 }
      );
    }

    const result: ParityResult = {
      caseName: testCase.name,
      status,
      newOutput,
      legacyOutput,
      normalizedNew,
      normalizedLegacy,
      diff,
    };

    // Save detailed results to files
    this.saveResultFiles(result);

    return result;
  }

  private compareOutputs(newOutput: any, legacyOutput: any): 'MATCH' | 'PARTIAL' | 'MISMATCH' {
    const newStr = JSON.stringify(newOutput, null, 2);
    const legacyStr = JSON.stringify(legacyOutput, null, 2);

    if (newStr === legacyStr) {
      return 'MATCH';
    }

    // Check if they have similar structure but different details
    if (this.hasSimularStructure(newOutput, legacyOutput)) {
      return 'PARTIAL';
    }

    return 'MISMATCH';
  }

  private hasSimularStructure(a: any, b: any): boolean {
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return a === b;
    if (typeof a !== 'object') return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    // Must have at least 50% key overlap
    const commonKeys = keysA.filter(key => keysB.includes(key));
    const minKeys = Math.min(keysA.length, keysB.length);

    return commonKeys.length >= minKeys * 0.5;
  }

  private saveResultFiles(result: ParityResult): void {
    const reportsDir = join(process.cwd(), 'packages/parity/reports');

    // Raw outputs
    writeFileSync(
      join(reportsDir, `${result.caseName}.new.json`),
      JSON.stringify(result.newOutput, null, 2)
    );

    writeFileSync(
      join(reportsDir, `${result.caseName}.legacy.json`),
      JSON.stringify(result.legacyOutput, null, 2)
    );

    // Normalized outputs
    writeFileSync(
      join(reportsDir, `${result.caseName}.normalized-new.json`),
      JSON.stringify(result.normalizedNew, null, 2)
    );

    writeFileSync(
      join(reportsDir, `${result.caseName}.normalized-legacy.json`),
      JSON.stringify(result.normalizedLegacy, null, 2)
    );

    // Diff file
    if (result.diff) {
      writeFileSync(
        join(reportsDir, `${result.caseName}.diff`),
        result.diff
      );
    }
  }

  generateMarkdownReport(report: ParityReport): string {
    const { summary, results } = report;

    let markdown = `# Parity Test Report\n\n`;
    markdown += `**Generated:** ${report.timestamp}\n\n`;

    markdown += `## Summary\n\n`;
    markdown += `| Status | Count | Percentage |\n`;
    markdown += `|--------|-------|------------|\n`;
    markdown += `| ✅ MATCH | ${summary.matches} | ${((summary.matches / summary.total) * 100).toFixed(1)}% |\n`;
    markdown += `| 🟡 PARTIAL | ${summary.partial} | ${((summary.partial / summary.total) * 100).toFixed(1)}% |\n`;
    markdown += `| ❌ MISMATCH | ${summary.mismatches} | ${((summary.mismatches / summary.total) * 100).toFixed(1)}% |\n`;
    markdown += `| **TOTAL** | **${summary.total}** | **100%** |\n\n`;

    markdown += `## Test Results\n\n`;

    for (const result of results) {
      const icon = result.status === 'MATCH' ? '✅' :
                   result.status === 'PARTIAL' ? '🟡' : '❌';

      markdown += `### ${icon} ${result.caseName}\n\n`;
      markdown += `**Status:** ${result.status}\n\n`;

      if (result.error) {
        markdown += `**Error:** ${result.error}\n\n`;
      }

      if (result.diff && result.status !== 'MATCH') {
        markdown += `**Diff Preview:**\n\n\`\`\`diff\n`;
        // Show first 20 lines of diff
        const diffLines = result.diff.split('\n').slice(0, 20);
        markdown += diffLines.join('\n');
        if (result.diff.split('\n').length > 20) {
          markdown += `\n... (truncated, see reports/${result.caseName}.diff)\n`;
        }
        markdown += `\n\`\`\`\n\n`;
      }

      markdown += `---\n\n`;
    }

    markdown += `## Notes\n\n`;
    markdown += `- MATCH: Outputs are identical after normalization\n`;
    markdown += `- PARTIAL: Similar structure but different details (acceptable differences)\n`;
    markdown += `- MISMATCH: Significant structural or functional differences\n`;
    markdown += `- Raw outputs and diffs saved to \`packages/parity/reports/\`\n\n`;

    return markdown;
  }
}
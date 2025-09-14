import { table } from 'table';
import chalk from 'chalk';

export interface OutputOptions {
  json?: boolean;
  dryRun?: boolean;
}

export function formatOutput(data: any, options: OutputOptions = {}): void {
  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN - Would execute:'));
  }

  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Format based on data type
  if (Array.isArray(data)) {
    formatTable(data, options);
  } else if (typeof data === 'object' && data !== null) {
    formatObject(data, options);
  } else {
    console.log(String(data));
  }
}

function formatTable(data: any[], options: OutputOptions): void {
  if (data.length === 0) {
    console.log(chalk.gray('No results found'));
    return;
  }

  // Extract common fields for table display
  const sample = data[0];
  const keys = Object.keys(sample).slice(0, 4); // Limit columns for readability

  const tableData = [
    keys.map(key => chalk.bold(key.toUpperCase())),
    ...data.map(item =>
      keys.map(key => truncate(String(item[key] || ''), 30))
    )
  ];

  console.log(table(tableData, {
    border: {
      topBody: '─',
      topJoin: '┬',
      topLeft: '┌',
      topRight: '┐',
      bottomBody: '─',
      bottomJoin: '┴',
      bottomLeft: '└',
      bottomRight: '┘',
      bodyLeft: '│',
      bodyRight: '│',
      bodyJoin: '│',
      joinBody: '─',
      joinLeft: '├',
      joinRight: '┤',
      joinJoin: '┼'
    }
  }));

  if (data.length > 10) {
    console.log(chalk.gray(`... and ${data.length - 10} more results`));
  }
}

function formatObject(data: any, options: OutputOptions): void {
  const entries = Object.entries(data);

  for (const [key, value] of entries) {
    const formattedKey = chalk.cyan(key + ':');
    const formattedValue = typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value);

    console.log(`${formattedKey} ${formattedValue}`);
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export function logError(message: string, error?: any): void {
  console.error(chalk.red(`❌ ${message}`));
  if (error && typeof error === 'object' && error.message) {
    console.error(chalk.red(`   ${error.message}`));
  }
}

export function logSuccess(message: string): void {
  console.log(chalk.green(`✅ ${message}`));
}

export function logWarning(message: string): void {
  console.log(chalk.yellow(`⚠️  ${message}`));
}

export function logInfo(message: string): void {
  console.log(chalk.blue(`ℹ️  ${message}`));
}
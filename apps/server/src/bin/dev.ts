#!/usr/bin/env node

// Development server with hot reload
import { spawn } from 'child_process';
import { watch } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '../index.ts');

let serverProcess: any = null;

function startServer(): void {
  if (serverProcess) {
    serverProcess.kill();
  }
  
  console.error('🔄 Starting development server...');
  
  serverProcess = spawn('node', ['--loader', 'ts-node/esm', serverPath], {
    stdio: 'inherit'
  });
  
  serverProcess.on('error', (err: Error) => {
    console.error('❌ Server error:', err.message);
  });
}

// Watch for changes
watch(join(__dirname, '../'), { recursive: true }, (eventType, filename) => {
  if (filename?.endsWith('.ts')) {
    console.error(`📝 File changed: ${filename}`);
    startServer();
  }
});

// Initial start
startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});
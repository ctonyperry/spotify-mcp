#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const certPath = join(rootDir, 'localhost.crt');
const keyPath = join(rootDir, 'localhost.key');

// Check if certificates exist
if (!existsSync(certPath) || !existsSync(keyPath)) {
  console.log('🔐 Certificates not found, generating...');
  
  const genCert = spawn('node', [join(__dirname, 'gen-dev-cert.mjs')], {
    stdio: 'inherit'
  });
  
  genCert.on('close', (code) => {
    if (code === 0) {
      console.log('🚀 Starting OAuth flow...');
      startOAuthFlow();
    } else {
      console.error('❌ Failed to generate certificates');
      process.exit(1);
    }
  });
  
  genCert.on('error', (err) => {
    console.error('❌ Error generating certificates:', err.message);
    process.exit(1);
  });
} else {
  console.log('🚀 Starting OAuth flow...');
  startOAuthFlow();
}

function startOAuthFlow() {
  const server = spawn('node', ['--loader', 'ts-node/esm', 'src/bin/oauth.ts'], {
    cwd: join(rootDir, 'apps/server'),
    stdio: 'inherit'
  });
  
  server.on('error', (err) => {
    console.error('❌ Error starting OAuth server:', err.message);
    console.error('Make sure dependencies are installed: pnpm install');
    process.exit(1);
  });
}
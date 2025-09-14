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

console.log('🎯 Spotify MCP OAuth Bootstrap');
console.log('📋 This script will help you set up OAuth authentication\n');

// Check if certificates exist
if (!existsSync(certPath) || !existsSync(keyPath)) {
  console.log('🔐 SSL certificates not found, generating self-signed certificates...');
  
  const genCert = spawn('node', [join(__dirname, 'gen-dev-cert.mjs')], {
    stdio: 'inherit'
  });
  
  genCert.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Certificates generated successfully');
      console.log('🚀 Ready to start OAuth flow...\n');
      promptForConfig();
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
  console.log('✅ SSL certificates found');
  console.log('🚀 Ready to start OAuth flow...\n');
  promptForConfig();
}

function promptForConfig() {
  console.log('📝 Before continuing, make sure you have:');
  console.log('   1. Created a Spotify app at https://developer.spotify.com/dashboard');
  console.log('   2. Added https://localhost:8443/callback to your app\'s redirect URIs');
  console.log('   3. Set your SPOTIFY_CLIENT_ID and optionally SPOTIFY_CLIENT_SECRET environment variables');
  console.log('   4. Or created a config.local.json file with your credentials\n');
  
  console.log('🔄 Starting OAuth authorization flow...');
  console.log('   This will open your browser to authenticate with Spotify');
  console.log('   After authorization, tokens will be securely stored locally\n');
  
  startOAuthFlow();
}

function startOAuthFlow() {
  // Use the server's OAuth script
  const server = spawn('pnpm', ['--filter=server', 'oauth'], {
    cwd: rootDir,
    stdio: 'inherit'
  });
  
  server.on('close', (code) => {
    if (code === 0) {
      console.log('\n🎉 OAuth setup completed successfully!');
      console.log('🔐 Your tokens have been securely stored');
      console.log('🚀 You can now use the Spotify MCP server');
    } else {
      console.error('\n❌ OAuth setup failed');
      console.error('💡 Make sure your Spotify app credentials are correct');
      process.exit(code);
    }
  });
  
  server.on('error', (err) => {
    console.error('❌ Error starting OAuth flow:', err.message);
    console.error('💡 Make sure dependencies are installed: pnpm install');
    process.exit(1);
  });
}
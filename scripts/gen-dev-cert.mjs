#!/usr/bin/env node

import { spawn } from 'child_process';
import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const certPath = join(rootDir, 'localhost.crt');
const keyPath = join(rootDir, 'localhost.key');
const configPath = join(rootDir, 'openssl.conf');

// Clean up existing files
[certPath, keyPath, configPath].forEach(file => {
  if (existsSync(file)) {
    unlinkSync(file);
  }
});

// Create OpenSSL config
const opensslConfig = `[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = CA
L = San Francisco
O = Test
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = 127.0.0.1
IP.1 = 127.0.0.1
`;

writeFileSync(configPath, opensslConfig);

const openssl = spawn('openssl', [
  'req', '-x509', '-nodes', '-days', '365',
  '-newkey', 'rsa:2048',
  '-keyout', keyPath,
  '-out', certPath,
  '-config', configPath
], {
  stdio: 'inherit'
});

openssl.on('close', (code) => {
  // Clean up config file
  if (existsSync(configPath)) {
    unlinkSync(configPath);
  }
  
  if (code === 0) {
    console.log('✅ Development certificates generated successfully');
    console.log(`📄 Certificate: ${certPath}`);
    console.log(`🔑 Private key: ${keyPath}`);
    console.log('⚠️  These are self-signed certificates for development only');
  } else {
    console.error('❌ Failed to generate certificates');
    process.exit(1);
  }
});

openssl.on('error', (err) => {
  console.error('❌ Error running OpenSSL:', err.message);
  console.error('Make sure OpenSSL is installed and available in PATH');
  process.exit(1);
});
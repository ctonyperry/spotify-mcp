#!/usr/bin/env node

import { SpotifyAuthClient, FileTokenStore } from '@spotify-mcp/auth';
import { loadConfig, createLogger } from '@spotify-mcp/platform';

async function main(): Promise<void> {
  console.log('🔐 Spotify MCP OAuth Setup');
  console.log('==========================\n');

  const logger = createLogger('info');
  
  try {
    // Load configuration
    console.log('📋 Loading configuration...');
    const config = loadConfig('config.local.json');
    
    console.log('✅ Configuration loaded successfully');
    console.log(`   Client ID: ${config.SPOTIFY_CLIENT_ID.slice(0, 8)}...`);
    console.log(`   Redirect URI: ${config.SPOTIFY_REDIRECT_URI}`);
    console.log(`   Scopes: ${config.SCOPES}`);
    console.log(`   Token Storage: ${config.TOKEN_STORE_PATH}\n`);

    // Create auth client
    const tokenStore = new FileTokenStore(config.TOKEN_STORE_PATH);
    const authClient = new SpotifyAuthClient(
      {
        clientId: config.SPOTIFY_CLIENT_ID,
        clientSecret: config.SPOTIFY_CLIENT_SECRET,
        redirectUri: config.SPOTIFY_REDIRECT_URI,
        scopes: config.SCOPES,
        tlsKeyPath: config.TLS_KEY_PATH,
        tlsCertPath: config.TLS_CERT_PATH,
      },
      tokenStore,
      logger
    );

    console.log('🚀 Starting interactive OAuth flow...');
    console.log('   - This will open your browser');
    console.log('   - Please authorize the application');
    console.log('   - Return here when complete\n');

    await authClient.authorizeInteractive();

    console.log('\n🎉 OAuth authorization completed successfully!');
    console.log('🔐 Tokens have been securely stored');
    console.log('🧪 Testing token retrieval...');
    
    // Test token retrieval
    const accessToken = await authClient.getAccessToken();
    console.log(`✅ Access token retrieved successfully (${accessToken.slice(0, 10)}...)`);
    
    console.log('\n✨ Setup complete! You can now use the Spotify MCP server.');

  } catch (error) {
    console.error('\n❌ OAuth setup failed:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof Error && error.message.includes('SPOTIFY_CLIENT_ID')) {
      console.error('\n💡 Make sure to set your Spotify app credentials:');
      console.error('   1. Set SPOTIFY_CLIENT_ID environment variable');
      console.error('   2. Optionally set SPOTIFY_CLIENT_SECRET for confidential clients');
      console.error('   3. Or create a config.local.json file with your credentials');
      console.error('   4. Ensure your redirect URI is set to: https://localhost:8443/callback');
    }
    
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
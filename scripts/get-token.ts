// Run this locally: npx tsx scripts/get-token.ts
// It will open your browser for EasyTracker authorization,
// then print the tokens. Copy them to Railway env vars.

import http from 'http';
import crypto from 'crypto';
import { randomBytes } from 'crypto';

const CLIENT_ID = process.env.EASYTRACKER_CLIENT_ID || 'e145f0b5-0bbc-44b8-ac1b-9125f38abc29';
const CLIENT_SECRET = process.env.EASYTRACKER_CLIENT_SECRET || 'e145f0b5-0bbc-44b8-ac1b-9125f38abc29';
const AUTH_URL = 'https://api.easytracker.digital/api/oauth/mcp/authorize';
const TOKEN_URL = 'https://api.easytracker.digital/api/oauth/mcp/token';

function base64URLEncode(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function main() {
  // Start a local server to receive the OAuth callback
  const server = http.createServer();
  await new Promise<void>(resolve => server.listen(0, 'localhost', resolve));
  const port = (server.address() as any).port;
  const redirectUri = `http://localhost:${port}/callback`;

  // Generate PKCE
  const codeVerifier = base64URLEncode(randomBytes(32));
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = base64URLEncode(hash);

  // Build auth URL
  const state = base64URLEncode(randomBytes(16));
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    state,
    scope: 'tracker:read reports:read ads_manager:read',
    resource: process.env.EASYTRACKER_MCP_URL || 'https://api.easytracker.digital/api/mcp/v1',
  });
  const authUrl = `${AUTH_URL}?${params.toString()}`;

  console.log('\n📌 Abra esta URL no navegador e autorize:');
  console.log('\n' + authUrl + '\n');

  // Wait for callback
  const code = await new Promise<string>((resolve, reject) => {
    server.on('request', (req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`);
      if (url.searchParams.get('state') !== state) {
        res.writeHead(400);
        res.end('Invalid state');
        reject(new Error('State mismatch'));
        return;
      }
      const c = url.searchParams.get('code');
      if (c) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>✅ Autorizado! Pode fechar esta aba.</h1>');
        resolve(c);
      } else {
        res.writeHead(400);
        res.end('No code received');
        reject(new Error('No authorization code'));
      }
    });
  });

  server.close();

  // Exchange code for token
  console.log('🔄 Trocando código por token...');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
  });

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) {
    console.error(`❌ Erro: ${resp.status} ${await resp.text()}`);
    process.exit(1);
  }

  const data = await resp.json() as any;
  console.log('\n✅ Tokens obtidos!');
  console.log('\nCopie estas variáveis para o Railway:\n');
  console.log(`EASYTRACKER_ACCESS_TOKEN="${data.access_token}"`);
  if (data.refresh_token) {
    console.log(`EASYTRACKER_REFRESH_TOKEN="${data.refresh_token}"`);
  }
  if (data.expires_in) {
    console.log(`\n⏰ Expira em ${Math.round(data.expires_in / 60)} minutos`);
  }
}

main().catch(console.error);
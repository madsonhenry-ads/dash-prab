/**
 * OAuth PKCE flow for EasyTracker MCP.
 * Run: npx tsx scripts/oauth-token.ts
 *
 * 1. Starts a local HTTP server on a random port
 * 2. Opens the browser for authorization
 * 3. Captures the callback and exchanges the code for tokens
 * 4. Prints tokens for Railway
 */
import http from 'http';
import crypto from 'crypto';
import { randomBytes } from 'crypto';

const MCP_URL = process.env.EASYTRACKER_MCP_URL || 'https://api.easytracker.digital/api/mcp/v1';
const AUTH_URL = 'https://api.easytracker.digital/api/oauth/mcp/authorize';
const TOKEN_URL = 'https://api.easytracker.digital/api/oauth/mcp/token';
const CLIENT_ID = 'e145f0b5-0bbc-44b8-ac1b-9125f38abc29';
const CLIENT_SECRET = process.env.EASYTRACKER_CLIENT_SECRET || 'e145f0b5-0bbc-44b8-ac1b-9125f38abc29';

function base64URLEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function main() {
  // 1. Start local server
  const server = http.createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  // 2. PKCE
  const codeVerifier = base64URLEncode(randomBytes(32));
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = base64URLEncode(hash);
  const state = base64URLEncode(randomBytes(16));

  // 3. Build auth URL — same format as MCP SDK
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    state,
    scope: 'tracker:read reports:read ads_manager:read',
    resource: MCP_URL,
  });
  const authUrl = `${AUTH_URL}?${params.toString()}`;

  console.log('\n📌 Abra esta URL no navegador e autorize:\n');
  console.log(authUrl + '\n');

  // 4. Wait for callback
  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Timeout aguardando autorização (5 min)'));
    }, 300000);

    server.on('request', (req, res) => {
      const url = new URL(req.url!, `http://127.0.0.1:${port}`);

      if (url.pathname === '/callback') {
        const err = url.searchParams.get('error');
        if (err) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>❌ Erro: ${err}</h1><p>${url.searchParams.get('error_description') || ''}</p>`);
          clearTimeout(timeout);
          reject(new Error(`OAuth error: ${err} - ${url.searchParams.get('error_description') || ''}`));
          return;
        }

        const s = url.searchParams.get('state');
        const c = url.searchParams.get('code');

        if (s !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>❌ State mismatch</h1>');
          clearTimeout(timeout);
          reject(new Error('State mismatch'));
          return;
        }

        if (c) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>✅ Autorizado! Pode fechar esta aba.</h1><script>window.close()</script>');
          clearTimeout(timeout);
          resolve(c);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>❌ Nenhum código recebido</h1>');
          clearTimeout(timeout);
          reject(new Error('No code in callback'));
        }
      }
    });
  });

  server.close();

  // 5. Exchange code for token
  console.log('🔄 Trocando código por token de acesso...\n');

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
    const text = await resp.text();
    console.error(`❌ Token exchange falhou (${resp.status}): ${text}`);
    process.exit(1);
  }

  const data = await resp.json() as any;

  console.log('✅ Tokens obtidos com sucesso!\n');
  console.log('═══════════════════════════════════════════════');
  console.log('  Copie estas variáveis para o Railway:');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`EASYTRACKER_ACCESS_TOKEN="${data.access_token}"`);
  if (data.refresh_token) {
    console.log(`EASYTRACKER_REFRESH_TOKEN="${data.refresh_token}"`);
  }
  if (data.expires_in) {
    const min = Math.round(data.expires_in / 60);
    console.log(`\n⏰ Token expira em ${min} minutos`);
    console.log('   Depois de colocar no Railway, configure também:');
    console.log(`   EASYTRACKER_REFRESH_TOKEN (se houver) para refresh automático`);
  } else {
    console.log('\n⚠️ Sem expires_in — token pode não ter refresh associado');
  }
  console.log('\n📌 Depois de adicionar ao Railway, faça redeploy.');
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
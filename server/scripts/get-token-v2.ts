/**
 * OAuth PKCE flow for EasyTracker MCP.
 * Run: npx tsx scripts/get-token-v2.ts
 *
 * Usa o Client ID gerado pelo MCP SDK (que o EasyTracker já aceita).
 * Abre servidor local, browser para autorização, troca código por token.
 */
import http from 'http';
import crypto from 'crypto';

const MCP_URL = 'https://api.easytracker.digital/api/mcp/v1';
const AUTH_URL = 'https://api.easytracker.digital/api/oauth/mcp/authorize';
const TOKEN_URL = 'https://api.easytracker.digital/api/oauth/mcp/token';
// This client_id is registered for OAuth with EasyTracker
const CLIENT_ID = '01cb977c-78c4-4f93-9c1e-65e31da52607';
const CLIENT_SECRET = ''; // Public client — no secret needed with PKCE

function base64URLEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function main() {
  // 1. Start local server on random port
  const server = http.createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  // 2. Generate PKCE
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = base64URLEncode(hash);
  const state = base64URLEncode(crypto.randomBytes(16));

  // 3. Build auth URL
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
  console.log(authUrl);
  console.log('\n⏳ Aguardando autorização...\n');

  // 4. Wait for callback
  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Timeout (5 min)'));
    }, 300000);

    server.on('request', (req, res) => {
      try {
        const url = new URL(req.url!, `http://127.0.0.1:${port}`);

        if (url.pathname === '/callback') {
          const errParam = url.searchParams.get('error');
          if (errParam) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>❌ Erro: ${errParam}</h1><p>${url.searchParams.get('error_description') || ''}</p>`);
            clearTimeout(timeout);
            reject(new Error(`OAuth error: ${errParam}`));
            return;
          }

          const s = url.searchParams.get('state');
          const c = url.searchParams.get('code');

          if (!c || s !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>❌ State mismatch ou sem code</h1>');
            clearTimeout(timeout);
            reject(new Error('State mismatch or missing code'));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>✅ Autorizado! Pode fechar esta aba.</h1><script>window.close()</script>');
          clearTimeout(timeout);
          resolve(c);
        }
      } catch (e) {
        console.error('Request error:', e);
      }
    });
  });

  server.close();

  // 5. Exchange code for token
  console.log('🔄 Trocando código por token de acesso...\n');

  const body = new URLSearchParams();
  body.append('grant_type', 'authorization_code');
  body.append('code', code);
  body.append('code_verifier', codeVerifier);
  body.append('client_id', CLIENT_ID);
  body.append('redirect_uri', redirectUri);

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
  console.log('  Adicione estas variáveis no Railway:');
  console.log('═══════════════════════════════════════════════\n');

  console.log(`EASYTRACKER_CLIENT_ID="${CLIENT_ID}"`);
  console.log(`EASYTRACKER_ACCESS_TOKEN="${data.access_token}"`);
  if (data.refresh_token) {
    console.log(`EASYTRACKER_REFRESH_TOKEN="${data.refresh_token}"`);
  }
  console.log(`EASYTRACKER_MCP_URL="${MCP_URL}"`);
  console.log(`EASYTRACKER_REDIRECT_URI=""`);

  if (data.expires_in) {
    console.log(`\n⏰ Expira em ${Math.round(data.expires_in / 60)} minutos`);
  }

  console.log('\n📌 Após adicionar no Railway, faça redeploy.');
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
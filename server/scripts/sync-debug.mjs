/**
 * DEBUG: Captura e imprime TUDO
 */
import { createServer } from 'http';
import { exec } from 'child_process';
import crypto from 'crypto';

const BASE = 'https://api.easytracker.digital';
const PORT = 43001;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const b64u = b => b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const sha256 = s => crypto.createHash('sha256').update(s).digest();
const state = b64u(crypto.randomBytes(16));
const codeVerifier = b64u(crypto.randomBytes(32));
const codeChallenge = b64u(sha256(codeVerifier));

async function main() {
  let resolveCode;
  const codePromise = new Promise(r => resolveCode = r);
  const server = createServer((req, res) => {
    const u = new URL(req.url, REDIRECT_URI);
    console.log(`[server] Full URL: ${req.url}`);
    console.log(`[server] Parsed path: ${u.pathname}`);
    console.log(`[server] Parsed code: ${u.searchParams.get('code')?.substring(0,30)}...`);
    console.log(`[server] Parsed state: ${u.searchParams.get('state')}`);
    if (u.pathname === '/callback') {
      const code = u.searchParams.get('code');
      if (code) { res.writeHead(200,{'Content-Type':'text/html'}); res.end('<h1>OK</h1>'); server.close(); resolveCode(code); }
    }
  });
  server.listen(PORT);

  // 1. DCR
  console.log('=== DCR ===');
  const dcrBody = { client_name: 'trafficboard-sync', redirect_uris: [REDIRECT_URI] };
  console.log(`POST ${BASE}/api/oauth/mcp/register`);
  console.log(`Body:`, JSON.stringify(dcrBody));
  const dcr = await fetch(`${BASE}/api/oauth/mcp/register`, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(dcrBody)
  });
  const info = await dcr.json();
  console.log(`DCR Response:`, JSON.stringify(info, null, 2));

  // 2. Metadata
  console.log('\n=== Metadata ===');
  const meta = await fetch(`${BASE}/.well-known/oauth-authorization-server`).then(r => r.json());
  console.log(JSON.stringify(meta, null, 2));

  // 3. Authorization URL
  const authUrl = new URL(meta.authorization_endpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', info.client_id);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('state', state);
  console.log('\n=== Auth URL ===');
  console.log(authUrl.toString());
  console.log(`code_verifier: ${codeVerifier}`);

  exec(`start "" "${authUrl}"`);

  const code = await codePromise;
  console.log(`\n=== Code Received ===`);
  console.log(`code: ${code}`);
  console.log(`code_verifier: ${codeVerifier}`);

  // 4. Token Exchange
  console.log('\n=== Token Exchange ===');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT_URI,
    client_id: info.client_id,
  });
  console.log(`POST ${meta.token_endpoint}`);
  console.log(`Body:`, body.toString());

  const tokenResp = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body
  });
  const tokenText = await tokenResp.text();
  console.log(`Response (${tokenResp.status}):`, tokenText);
}
main().catch(e => { console.error(e.message); process.exit(1); });

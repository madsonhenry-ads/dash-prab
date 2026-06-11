/**
 * Sync EasyTracker -> Railway (v2)
 *
 * Fluxo completo num processo só:
 * 1. Abre servidor local para OAuth callback
 * 2. Mostra URL pro usuário autorizar
 * 3. Recebe callback, troca código por token
 * 4. Busca dados via MCP HTTP com o token
 * 5. Envia tudo pro Railway
 *
 * Uso: node scripts/sync-all-v2.mjs
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { randomBytes } from 'node:crypto';

const MCP_URL = 'https://api.easytracker.digital/api/mcp/v1';
const AUTH_URL = 'https://api.easytracker.digital/api/oauth/mcp/authorize';
const TOKEN_URL = 'https://api.easytracker.digital/api/oauth/mcp/token';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';

// Use the same client_id pattern as the MCP authenticate tool
// The EasyTracker uses dynamic client registration.
// We register a temporary client by making an initial request
const DEFAULT_CLIENT_ID = 'e145f0b5-0bbc-44b8-ac1b-9125f38abc29';

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function jsonRpc(url, method, params, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return await resp.json();
}

async function main() {
  // 1. Start local OAuth callback server
  const server = http.createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  const codeVerifier = b64url(randomBytes(32));
  const codeChallenge = b64url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = b64url(randomBytes(16));
  const clientId = DEFAULT_CLIENT_ID;

  // First, try to discover the OAuth server
  console.log('🔍 Descobrindo OAuth endpoints...');
  const metaResp = await fetch('https://api.easytracker.digital/.well-known/oauth-authorization-server').catch(() => null);
  if (metaResp?.ok) {
    const meta = await metaResp.json();
    console.log(`   Authorization: ${meta.authorization_endpoint}`);
    console.log(`   Token: ${meta.token_endpoint}\n`);
  }

  // Build auth URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    state,
    scope: 'tracker:read reports:read ads_manager:read',
    resource: MCP_URL,
  });

  const authUrl = `${AUTH_URL}?${params.toString()}`;

  console.log('='.repeat(60));
  console.log('📌 Abra esta URL no navegador e autorize:');
  console.log('='.repeat(60) + '\n');
  console.log(authUrl + '\n');
  console.log('⏳ Aguardando autorização (5 min timeout)...\n');

  // 2. Wait for OAuth callback
  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('⏰ Timeout de 5 minutos. Execute novamente.'));
    }, 300000);

    server.on('request', (req, res) => {
      try {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        if (url.pathname === '/callback') {
          const err = url.searchParams.get('error');
          if (err) {
            res.writeHead(400, { 'Content-Type': 'text/html' })
              .end(`<h1>❌ Erro: ${err}</h1><p>${url.searchParams.get('error_description') || ''}</p>`);
            clearTimeout(timeout);
            reject(new Error(`OAuth: ${err}`));
            return;
          }

          const c = url.searchParams.get('code');
          const s = url.searchParams.get('state');

          if (c && s === state) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
              .end(`<h1>✅ Autorizado!</h1><p>Token recebido. Pode fechar esta aba.</p><script>window.close()</script>`);
            clearTimeout(timeout);
            resolve(c);
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' })
              .end(`<h1>❌ State mismatch</h1>`);
          }
        }
      } catch (e) {
        console.error('Callback error:', e.message);
      }
    });
  });
  server.close();

  console.log('🔄 Trocando código por token...');

  // 3. Exchange code for token
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  const tokenResp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });

  if (!tokenResp.ok) {
    const text = await tokenResp.text();
    console.error(`❌ Token exchange falhou (${tokenResp.status}): ${text}`);
    process.exit(1);
  }

  const tokenData = await tokenResp.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  console.log('✅ Token obtido!\n');

  // 4. Fetch data from MCP
  const data = { period: 'today', account: 'all' };

  async function callTool(name, args = {}) {
    const resp = await jsonRpc(MCP_URL, 'tools/call', { name, arguments: args }, accessToken);
    if (resp.error) throw new Error(`${resp.error.message}`);
    return resp.result;
  }

  console.log('📊 Dashboard...');
  try {
    const r = await callTool('easytracker_get_dashboard_report', { period: 'today' });
    const text = r.content?.[0]?.text;
    if (text) {
      const p = JSON.parse(text);
      data.kpis = p.kpis || p;
      data.funnel = p.funnel;
      data.salesByHour = p.salesByHour;
      data.salesByDay = p.salesByDay;
      data.salesByCountry = p.salesByCountry;
      data.salesByPayment = p.salesByPayment;
      console.log('   ✅ Dashboard');
    }
  } catch (e) { console.warn('   ⚠️', e.message); }

  console.log('📦 Campanhas...');
  try {
    const r = await callTool('easytracker_list_campaigns', {});
    if (r.content?.[0]?.text) { data.campaigns = JSON.parse(r.content[0].text); console.log(`   ✅ ${data.campaigns.length}`); }
  } catch (e) { console.warn('   ⚠️', e.message); }

  console.log('📦 Criativos...');
  try {
    const r = await callTool('easytracker_list_ads', { period: 'today' });
    if (r.content?.[0]?.text) { data.ads = data.creatives = JSON.parse(r.content[0].text); console.log(`   ✅ ${data.ads.length}`); }
  } catch (e) { console.warn('   ⚠️', e.message); }

  console.log('📦 Ad sets...');
  try {
    const r = await callTool('easytracker_list_ad_sets', {});
    if (r.content?.[0]?.text) { data.adSets = JSON.parse(r.content[0].text); console.log(`   ✅ ${data.adSets.length}`); }
  } catch (e) { console.warn('   ⚠️', e.message); }

  console.log('📦 Contas, produtos, canais...');
  try {
    const results = await Promise.allSettled([
      callTool('easytracker_list_ad_accounts', {}),
      callTool('easytracker_list_offers', {}),
      callTool('easytracker_list_traffic_channels', {}),
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.content?.[0]?.text) {
        const parsed = JSON.parse(result.value.content[0].text);
        if (Array.isArray(parsed)) {
          // Determine type by checking if it has specific fields
          if (parsed[0]?.platform) { data.adAccounts = parsed; console.log(`   ✅ ${parsed.length} contas`); }
          else if (parsed[0]?.price) { data.products = parsed; console.log(`   ✅ ${parsed.length} produtos`); }
          else if (parsed[0]?.name) { data.trafficChannels = parsed; console.log(`   ✅ ${parsed.length} canais`); }
        }
      }
    }
  } catch (e) { console.warn('   ⚠️', e.message); }

  // 5. Send to Railway
  console.log('\n📤 Enviando para Railway...');
  const syncResp = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SYNC_SECRET}` },
    body: JSON.stringify({ data }),
  });

  if (!syncResp.ok) {
    console.error(`❌ Sync falhou (${syncResp.status}): ${await syncResp.text()}`);
    process.exit(1);
  }

  const result = await syncResp.json();
  console.log('✅ Sync concluído!');
  console.log(`   Keys: ${result.data.keys.join(', ')}`);
  console.log(`   ${new Date(result.data.syncedAt).toLocaleString('pt-BR')}`);

  // 6. Print tokens for Railway env vars
  console.log('\n' + '='.repeat(60));
  console.log('📌 Salve estes tokens no Railway:');
  console.log('='.repeat(60) + '\n');
  console.log(`EASYTRACKER_ACCESS_TOKEN="${accessToken}"`);
  if (refreshToken) {
    console.log(`EASYTRACKER_REFRESH_TOKEN="${refreshToken}"`);
  }
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
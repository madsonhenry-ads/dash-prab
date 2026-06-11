/**
 * Sync tudo do EasyTracker para o Railway.
 *
 * Como usar (CMD):
 *   cd C:\Dash-Prab\trafficboard\server
 *   npx tsx scripts/sync-all.mjs
 *
 * Ou instale tsx e rode: node scripts/sync-all.mjs (mas precisa de fetch nativo)
 */

import http from 'node:http';
import crypto from 'node:crypto';

// Config
const MCP_URL = 'https://api.easytracker.digital/api/mcp/v1';
const AUTH_URL = 'https://api.easytracker.digital/api/oauth/mcp/authorize';
const TOKEN_URL = 'https://api.easytracker.digital/api/oauth/mcp/token';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function mcpCall(token, name, args = {}) {
  const resp = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const d = await resp.json();
  if (d.error) throw new Error(`${name}: ${d.error.message}`);
  return d.result;
}

async function main() {
  // 1. Start local OAuth server
  const server = http.createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  const codeVerifier = b64url(crypto.randomBytes(32));
  const codeChallenge = b64url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = b64url(crypto.randomBytes(16));
  const clientId = b64url(crypto.randomBytes(12)); // ephemeral client

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

  console.log('\n' + '='.repeat(60));
  console.log('📌 Abra esta URL no navegador e autorize:');
  console.log('='.repeat(60) + '\n');
  console.log(authUrl + '\n');
  console.log('⏳ Aguardando autorização...\n');

  // Wait for OAuth callback
  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { server.close(); reject(new Error('Timeout (5 min)')); }, 300000);
    server.on('request', (req, res) => {
      try {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        if (url.pathname === '/callback') {
          const errParam = url.searchParams.get('error');
          if (errParam) {
            res.writeHead(400).end(`<h1>${errParam}</h1>`);
            clearTimeout(timeout); reject(new Error(errParam));
            return;
          }
          const c = url.searchParams.get('code');
          const s = url.searchParams.get('state');
          if (c && s === state) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
              .end('<h1>✅ Autorizado! Pode fechar esta aba.</h1><script>window.close()</script>');
            clearTimeout(timeout);
            resolve(c);
          }
        }
      } catch (e) { /* ignore */ }
    });
  });
  server.close();

  // 2. Exchange code for token
  console.log('🔄 Trocando código por token de acesso...');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  const tokenResp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenResp.ok) {
    console.error(`❌ Token exchange falhou (${tokenResp.status}): ${await tokenResp.text()}`);
    process.exit(1);
  }

  const tokenData = await tokenResp.json();
  const token = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  console.log('✅ Token de acesso obtido!\n');

  // Save token to env for later use
  console.log(`📝 Token: ${token.substring(0, 20)}...${token.substring(token.length - 5)}`);
  if (refreshToken) console.log(`📝 Refresh: ${refreshToken.substring(0, 20)}...`);
  console.log('');

  // 3. Fetch ALL data from EasyTracker MCP
  const data = { period: 'today', account: 'all' };

  console.log('📊 Buscando dashboard report...');
  try {
    const r = await mcpCall(token, 'easytracker_get_dashboard_report', { period: 'today' });
    const text = r.content?.[0]?.text;
    if (text) {
      const p = JSON.parse(text);
      data.kpis = p.kpis || p;
      data.funnel = p.funnel;
      data.salesByHour = p.salesByHour;
      data.salesByDay = p.salesByDay;
      data.salesByCountry = p.salesByCountry;
      data.salesByPayment = p.salesByPayment;
      console.log('   ✅ Dashboard KPIs + funnel + vendas');
    }
  } catch (e) { console.warn('   ⚠️ Dashboard:', e.message); }

  console.log('📦 Buscando campanhas...');
  try {
    const r = await mcpCall(token, 'easytracker_list_campaigns', {});
    if (r.content?.[0]?.text) { data.campaigns = JSON.parse(r.content[0].text); console.log(`   ✅ ${data.campaigns.length} campanhas`); }
  } catch (e) { console.warn('   ⚠️ Campanhas:', e.message); }

  console.log('📦 Buscando ad sets...');
  try {
    const r = await mcpCall(token, 'easytracker_list_ad_sets', {});
    if (r.content?.[0]?.text) { data.adSets = JSON.parse(r.content[0].text); console.log(`   ✅ ${data.adSets.length} ad sets`); }
  } catch (e) { console.warn('   ⚠️ Ad sets:', e.message); }

  console.log('📦 Buscando criativos...');
  try {
    const r = await mcpCall(token, 'easytracker_list_ads', { period: 'today' });
    if (r.content?.[0]?.text) { data.ads = data.creatives = JSON.parse(r.content[0].text); console.log(`   ✅ ${data.ads.length} criativos`); }
  } catch (e) { console.warn('   ⚠️ Criativos:', e.message); }

  console.log('📦 Buscando contas, produtos e canais...');
  try {
    const [ac, of, tc] = await Promise.all([
      mcpCall(token, 'easytracker_list_ad_accounts', {}).catch(() => ({ content: [] })),
      mcpCall(token, 'easytracker_list_offers', {}).catch(() => ({ content: [] })),
      mcpCall(token, 'easytracker_list_traffic_channels', {}).catch(() => ({ content: [] })),
    ]);
    if (ac.content?.[0]?.text) { data.adAccounts = JSON.parse(ac.content[0].text); console.log(`   ✅ ${data.adAccounts.length} contas`); }
    if (of.content?.[0]?.text) { data.products = JSON.parse(of.content[0].text); console.log(`   ✅ ${data.products.length} produtos`); }
    if (tc.content?.[0]?.text) { data.trafficChannels = JSON.parse(tc.content[0].text); console.log(`   ✅ ${data.trafficChannels.length} canais`); }
  } catch (e) { console.warn('   ⚠️', e.message); }

  // 4. Sync to Railway
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
  console.log('✅ Sync concluído com sucesso!');
  console.log(`   Keys enviadas: ${result.data.keys.join(', ')}`);
  console.log(`   Horário: ${new Date(result.data.syncedAt).toLocaleString('pt-BR')}`);

  // Show token for Railway env vars
  console.log('\n' + '='.repeat(60));
  console.log('📌 Para evitar OAuth toda vez, adicione no Railway:');
  console.log('='.repeat(60));
  console.log(`\nEASYTRACKER_ACCESS_TOKEN="${token}"`);
  if (refreshToken) {
    console.log(`EASYTRACKER_REFRESH_TOKEN="${refreshToken}"`);
  }
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
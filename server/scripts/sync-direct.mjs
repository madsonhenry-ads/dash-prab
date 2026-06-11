/**
 * Sync EasyTracker -> Railway (OAuth manual + API direta)
 * Uso: node scripts/sync-direct.mjs
 */
import { createServer } from 'http';
import { exec } from 'child_process';
import crypto from 'crypto';

const EASYTRACKER_BASE = 'https://api.easytracker.digital';
const MCP_URL = `${EASYTRACKER_BASE}/api/mcp/v1`;
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';
const PORT = 42666;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

function base64URL(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
function sha256(str) { return crypto.createHash('sha256').update(str).digest(); }

const codeVerifier = base64URL(crypto.randomBytes(32));
const codeChallenge = base64URL(sha256(codeVerifier));

function startCallbackServer() {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, REDIRECT_URI);
      if (u.pathname === '/callback') {
        const code = u.searchParams.get('code');
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Autorizado!</h1><p>Feche esta janela.</p>');
          server.close();
          resolve(code);
        }
      }
    });
    server.listen(PORT);
  });
}

async function main() {
  const serverPromise = startCallbackServer();
  console.log('=== TrafficBoard Sync ===\n');

  // Step 1: Dynamic Client Registration
  console.log('1. Registrando cliente...');
  const dcrResp = await fetch(`${EASYTRACKER_BASE}/api/oauth/mcp/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'trafficboard-sync',
      redirect_uris: [REDIRECT_URI],
      scope: 'tracker:read tracker:write reports:read ads_manager:read ads_manager:write ads_manager:destructive'
    })
  });
  if (!dcrResp.ok) { console.error('DCR falhou:', await dcrResp.text()); process.exit(1); }
  const clientInfo = await dcrResp.json();
  console.log(`   Client ID: ${clientInfo.client_id.substring(0, 8)}...`);
  console.log(`   Tem secret: ${!!clientInfo.client_secret} (${clientInfo.client_secret?.substring(0, 8)}...)`);
  console.log(`   DCR keys: ${Object.keys(clientInfo).join(', ')}`);

  // Step 2: Get discovery metadata
  console.log('2. Buscando metadata...');
  const metaResp = await fetch(`${EASYTRACKER_BASE}/.well-known/oauth-authorization-server`);
  const metadata = await metaResp.json();
  console.log(`   Token endpoint: ${metadata.token_endpoint}`);

  // Step 3: Open browser for authorization
  const authUrl = new URL(metadata.authorization_endpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientInfo.client_id);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', 'tracker:read tracker:write reports:read ads_manager:read ads_manager:write ads_manager:destructive');
  authUrl.searchParams.set('resource', MCP_URL);

  console.log('3. Abrindo navegador...');
  exec(process.platform === 'win32' ? `start "" "${authUrl}"` : `open "${authUrl}"`);
  console.log('   Aguardando autorizacao...');

  // Step 4: Wait for callback
  const code = await serverPromise;
  console.log(`   Code: ${code.substring(0, 12)}...`);

  // Step 5: Exchange code for token (public client - no auth)
  console.log('4. Trocando code por token...');
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT_URI,
    client_id: clientInfo.client_id,
  });

  console.log(`   body: ${tokenBody.toString().substring(0, 250)}`);

  const tokenResp = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    console.error(`   Token exchange falhou (${tokenResp.status}): ${errText}`);
    process.exit(1);
  }
  const tokens = await tokenResp.json();
  console.log(`   Token obtido! ${tokens.access_token.substring(0, 15)}...`);

  // Step 6: Call MCP tools directly with JSON-RPC
  console.log('\n5. Buscando dados...');
  const data = { period: 'today', account: 'all' };

  async function mcpCall(name, args = {}) {
    const resp = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.access_token}`
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
    });
    if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
    return resp.json();
  }

  const tasks = [
    ['Dashboard', 'easytracker_get_dashboard_report', { period: 'today' }, (r, d) => {
      if (!r.result?.content?.[0]?.text) return;
      const p = JSON.parse(r.result.content[0].text);
      d.kpis = p.kpis || p; d.funnel = p.funnel;
      d.salesByHour = p.salesByHour; d.salesByDay = p.salesByDay;
      d.salesByCountry = p.salesByCountry; d.salesByPayment = p.salesByPayment;
    }],
    ['Campanhas', 'easytracker_list_campaigns', {}, (r, d) => { if (r.result?.content?.[0]?.text) d.campaigns = JSON.parse(r.result.content[0].text); }],
    ['Ad Sets', 'easytracker_list_ad_sets', {}, (r, d) => { if (r.result?.content?.[0]?.text) d.adSets = JSON.parse(r.result.content[0].text); }],
    ['Ads', 'easytracker_list_ads', { period: 'today' }, (r, d) => { if (r.result?.content?.[0]?.text) d.ads = d.creatives = JSON.parse(r.result.content[0].text); }],
    ['Contas', 'easytracker_list_ad_accounts', {}, (r, d) => { if (r.result?.content?.[0]?.text) d.adAccounts = JSON.parse(r.result.content[0].text); }],
    ['Produtos', 'easytracker_list_offers', {}, (r, d) => { if (r.result?.content?.[0]?.text) d.products = JSON.parse(r.result.content[0].text); }],
    ['Canais', 'easytracker_list_traffic_channels', {}, (r, d) => { if (r.result?.content?.[0]?.text) d.trafficChannels = JSON.parse(r.result.content[0].text); }],
  ];

  for (const [label, name, args, extract] of tasks) {
    process.stdout.write(`   ${label}... `);
    try {
      const r = await mcpCall(name, args);
      extract(r, data);
      const arr = r.result?.content?.[0]?.text ? JSON.parse(r.result.content[0].text) : [];
      console.log(Array.isArray(arr) ? `${arr.length} itens` : 'OK');
    } catch (e) { console.log(`Falhou: ${e.message}`); }
  }

  // Step 7: Sync to Railway
  console.log('\n6. Enviando para Railway...');
  const syncResp = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SYNC_SECRET}` },
    body: JSON.stringify({ data }),
  });
  if (!syncResp.ok) { console.error(`Sync falhou (${syncResp.status}): ${await syncResp.text()}`); process.exit(1); }
  const result = await syncResp.json();
  console.log('\n=== SYNC CONCLUIDO ===');
  console.log(`   Dados: ${result.data.keys.join(', ')}`);
  console.log(`   ${new Date(result.data.syncedAt).toLocaleString('pt-BR')}`);
}

main().catch(err => { console.error(`\nErro: ${err.message}`); process.exit(1); });
/**
 * do-sync.ts — Roda local, busca dados do EasyTracker e envia pro Railway.
 *
 * 1. Inicia servidor local → abre browser → OAuth → captura token
 * 2. Busca dados reais via MCP HTTP com o token
 * 3. Envia pro Railway via POST /api/sync
 *
 * Uso (CMD):
 *   cd C:\Dash-Prab\trafficboard\server
 *   npx tsx scripts/do-sync.ts
 */
import http from 'http';
import crypto from 'crypto';
import * as fs from 'fs';

const MCP_URL = 'https://api.easytracker.digital/api/mcp/v1';
const AUTH_URL = 'https://api.easytracker.digital/api/oauth/mcp/authorize';
const TOKEN_URL = 'https://api.easytracker.digital/api/oauth/mcp/token';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function mcpRpc(token: string, method: string, params: any) {
  const resp = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await resp.json() as any;
  if (data.error) throw new Error(`MCP error (${method}): ${data.error.message}`);
  return data.result;
}

async function main() {
  // 1. Start local server for OAuth callback
  const server = http.createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  // Generate PKCE
  const codeVerifier = b64url(crypto.randomBytes(32));
  const codeChallenge = b64url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = b64url(crypto.randomBytes(16));

  const authUrl = `${AUTH_URL}?${new URLSearchParams({
    response_type: 'code',
    client_id: crypto.randomUUID(), // Will be reassigned on server redirect
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    state,
    scope: 'tracker:read reports:read ads_manager:read',
    resource: MCP_URL,
  })}`;

  console.log('\n📌 Abra esta URL no navegador e autorize:\n');
  console.log(`https://api.easytracker.digital/api/oauth/mcp/authorize?response_type=code&client_id=e145f0b5-0bbc-44b8-ac1b-9125f38abc29&code_challenge=${codeChallenge}&code_challenge_method=S256&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=tracker%3Aread+reports%3Aread+ads_manager%3Aread&resource=${encodeURIComponent(MCP_URL)}`);
  console.log('\n⏳ Aguardando autorização...');

  // Wait for callback
  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => { server.close(); reject(new Error('Timeout (5min)')); }, 300000);
    server.on('request', (req, res) => {
      try {
        const url = new URL(req.url!, `http://127.0.0.1:${port}`);
        if (url.pathname === '/callback') {
          const err = url.searchParams.get('error');
          if (err) {
            res.writeHead(400).end(`<h1>${err}</h1>`);
            clearTimeout(timeout); reject(new Error(err));
            return;
          }
          const c = url.searchParams.get('code');
          if (c && url.searchParams.get('state') === state) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
              .end('<h1>✅ Autorizado! Pode fechar.</h1><script>window.close()</script>');
            clearTimeout(timeout);
            resolve(c);
          }
        }
      } catch (e) {}
    });
  });
  server.close();

  // 2. Exchange code for token
  console.log('🔄 Trocando código por token...');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: 'e145f0b5-0bbc-44b8-ac1b-9125f38abc29',
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
  const tokenData = await resp.json() as any;
  const token = tokenData.access_token;
  console.log('✅ Token obtido!\n');

  // 3. Fetch data via MCP
  const data: any = { period: 'today', account: 'all' };

  console.log('📊 Dashboard report...');
  try {
    const r = await mcpRpc(token, 'tools/call', { name: 'easytracker_get_dashboard_report', arguments: { period: 'today' } });
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
  } catch (e: any) { console.warn('   ⚠️', e.message); }

  console.log('📦 Campanhas...');
  try {
    const r = await mcpRpc(token, 'tools/call', { name: 'easytracker_list_campaigns', arguments: {} });
    if (r.content?.[0]?.text) { data.campaigns = JSON.parse(r.content[0].text); console.log(`   ✅ ${data.campaigns.length}`); }
  } catch (e: any) { console.warn('   ⚠️', e.message); }

  console.log('📦 Criativos...');
  try {
    const r = await mcpRpc(token, 'tools/call', { name: 'easytracker_list_ads', arguments: { period: 'today' } });
    if (r.content?.[0]?.text) { data.ads = data.creatives = JSON.parse(r.content[0].text); console.log(`   ✅ ${data.ads.length}`); }
  } catch (e: any) { console.warn('   ⚠️', e.message); }

  console.log('📦 Contas, produtos, canais...');
  try {
    const [ac, of, tc] = await Promise.all([
      mcpRpc(token, 'tools/call', { name: 'easytracker_list_ad_accounts', arguments: {} }).catch(() => ({ content: [] })),
      mcpRpc(token, 'tools/call', { name: 'easytracker_list_offers', arguments: {} }).catch(() => ({ content: [] })),
      mcpRpc(token, 'tools/call', { name: 'easytracker_list_traffic_channels', arguments: {} }).catch(() => ({ content: [] })),
    ]);
    if (ac.content?.[0]?.text) { data.adAccounts = JSON.parse(ac.content[0].text); console.log(`   ✅ ${data.adAccounts.length} contas`); }
    if (of.content?.[0]?.text) { data.products = JSON.parse(of.content[0].text); console.log(`   ✅ ${data.products.length} produtos`); }
    if (tc.content?.[0]?.text) { data.trafficChannels = JSON.parse(tc.content[0].text); console.log(`   ✅ ${data.trafficChannels.length} canais`); }
  } catch (e: any) { console.warn('   ⚠️', e.message); }

  // 4. Sync to Railway
  console.log('\n📤 Enviando para Railway...');
  const syncResp = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SYNC_SECRET}` },
    body: JSON.stringify({ data }),
  });
  if (!syncResp.ok) {
    const t = await syncResp.text();
    console.error(`❌ Sync falhou (${syncResp.status}): ${t}`);
    process.exit(1);
  }
  const result = await syncResp.json() as any;
  console.log(`✅ Sync concluído! Keys: ${result.data.keys.join(', ')}`);
  console.log(`   ${new Date(result.data.syncedAt).toLocaleString('pt-BR')}`);
}

main().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
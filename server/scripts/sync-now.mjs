/**
 * Sync EasyTracker -> Railway
 * Uso: node scripts/sync-now.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServer } from 'http';
import { exec } from 'child_process';

const MCP_URL = 'https://api.easytracker.digital/api/mcp/v1';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';
const CALLBACK_PORT = 42425;

class AuthProvider {
  _tokens = undefined;
  _clientInfo = undefined;
  _codeVerifier = undefined;
  _discoveryState = undefined;

  get redirectUrl() { return `http://localhost:${CALLBACK_PORT}/callback`; }
  get clientMetadata() { return { client_name: 'trafficboard-sync', redirect_uris: [this.redirectUrl] }; }

  clientInformation() { return this._clientInfo; }
  saveClientInformation(i) { this._clientInfo = i; console.log('  [auth] DCR OK:', i.client_id?.substring(0,8)); }
  tokens() { return this._tokens; }
  saveTokens(t) { this._tokens = t; console.log('  [auth] Token salvo'); }
  redirectToAuthorization(url) {
    console.log('  [auth] Abrindo navegador...');
    exec(process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`);
  }
  saveCodeVerifier(v) { this._codeVerifier = v; }
  codeVerifier() { return this._codeVerifier; }

  // CRITICAL: Cache discovery state to avoid re-discovery delay before token exchange
  saveDiscoveryState(s) { this._discoveryState = s; }
  discoveryState() { return this._discoveryState; }

  // Prevent retry on invalid_grant (code is one-time-use, retry always fails)
  invalidateCredentials() {}
}

function startCallbackServer() {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
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
    server.listen(CALLBACK_PORT);
    console.log('  [server] Callback em :', CALLBACK_PORT);
  });
}

async function main() {
  const serverPromise = startCallbackServer();
  console.log('=== TrafficBoard Sync ===\n');

  const authProvider = new AuthProvider();
  const transport = new StreamableHTTPClientTransport(
    new URL(MCP_URL),
    { authProvider }
  );
  const client = new Client({ name: 'trafficboard-sync', version: '1.0.0' }, { capabilities: {} });

  // Step 1: connect → SDK does DCR + opens browser, throws UnauthorizedError
  try {
    await client.connect(transport);
    console.log('[OK] Ja conectado!\n');
  } catch (err) {
    if (err.message !== 'Unauthorized') throw err;
    console.log('  Aguardando callback...');

    // Step 2: wait for browser callback
    const code = await serverPromise;
    console.log(`  Code: ${code.substring(0,10)}...`);

    // Step 3: finishAuth exchanges code for token (uses cached discovery state - fast!)
    await transport.finishAuth(code);
    console.log('  [OK] finishAuth');

    // Step 4: connect with token
    await client.connect(transport);
    console.log('  [OK] Conectado!\n');
  }

  // Fetch data
  const data = { period: 'today', account: 'all' };
  const tasks = [
    ['Dashboard', 'easytracker_get_dashboard_report', { period: 'today' }, (r, d) => {
      if (!r.content?.[0]?.text) return;
      const p = JSON.parse(r.content[0].text);
      d.kpis = p.kpis || p; d.funnel = p.funnel;
      d.salesByHour = p.salesByHour; d.salesByDay = p.salesByDay;
      d.salesByCountry = p.salesByCountry; d.salesByPayment = p.salesByPayment;
    }],
    ['Campanhas', 'easytracker_list_campaigns', {}, (r, d) => { if (r.content?.[0]?.text) d.campaigns = JSON.parse(r.content[0].text); }],
    ['Ad Sets', 'easytracker_list_ad_sets', {}, (r, d) => { if (r.content?.[0]?.text) d.adSets = JSON.parse(r.content[0].text); }],
    ['Criativos/Ads', 'easytracker_list_ads', { period: 'today' }, (r, d) => { if (r.content?.[0]?.text) d.ads = d.creatives = JSON.parse(r.content[0].text); }],
    ['Contas', 'easytracker_list_ad_accounts', {}, (r, d) => { if (r.content?.[0]?.text) d.adAccounts = JSON.parse(r.content[0].text); }],
    ['Produtos', 'easytracker_list_offers', {}, (r, d) => { if (r.content?.[0]?.text) d.products = JSON.parse(r.content[0].text); }],
    ['Canais', 'easytracker_list_traffic_channels', {}, (r, d) => { if (r.content?.[0]?.text) d.trafficChannels = JSON.parse(r.content[0].text); }],
  ];

  console.log('Buscando dados:');
  for (const [label, name, args, extract] of tasks) {
    process.stdout.write(`  ${label}... `);
    try {
      const r = await client.callTool({ name, arguments: args });
      extract(r, data);
      const arr = r.content?.[0]?.text ? JSON.parse(r.content[0].text) : [];
      console.log(Array.isArray(arr) ? `${arr.length} itens` : 'OK');
    } catch (e) { console.log(`Falhou: ${e.message}`); }
  }

  // Sync to Railway
  console.log('\nEnviando dados para Railway...');
  const resp = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SYNC_SECRET}` },
    body: JSON.stringify({ data }),
  });
  if (!resp.ok) { console.error(`Sync falhou (${resp.status}): ${await resp.text()}`); process.exit(1); }
  const result = await resp.json();
  console.log('\n=== SYNC CONCLUIDO ===');
  console.log(`  Dados: ${result.data.keys.join(', ')}`);
  console.log(`  ${new Date(result.data.syncedAt).toLocaleString('pt-BR')}`);
  await client.close();
}

main().catch(err => {
  console.error(`\nErro: ${err.message}`);
  if (err.cause) console.error('Causa:', err.cause.message || err.cause);
  process.exit(1);
});

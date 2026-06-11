/**
 * Sync EasyTracker -> Railway v3
 * OAuth manual minimalista - igual ao que o Claude Code faz
 */
import { createServer } from 'http';
import { exec } from 'child_process';
import crypto from 'crypto';

const BASE = 'https://api.easytracker.digital';
const MCP_URL = `${BASE}/api/mcp/v1`;
const RAILWAY_URL = 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';
const PORT = 42999;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const b64u = b => b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const sha256 = s => crypto.createHash('sha256').update(s).digest();
const state = b64u(crypto.randomBytes(16));
const codeVerifier = b64u(crypto.randomBytes(32));
const codeChallenge = b64u(sha256(codeVerifier));

async function main() {
  // Start callback server
  let resolveCode;
  const codePromise = new Promise(r => resolveCode = r);
  const server = createServer((req, res) => {
    const u = new URL(req.url, REDIRECT_URI);
    if (u.pathname === '/callback') {
      const code = u.searchParams.get('code');
      if (code) {
        res.writeHead(200, {'Content-Type':'text/html'});
        res.end('<h1>OK</h1>');
        server.close();
        resolveCode(code);
      }
    }
  });
  server.listen(PORT);
  console.log('=== TrafficBoard Sync v3 ===\n');

  // 1. DCR
  process.stdout.write('DCR... ');
  const dcr = await fetch(`${BASE}/api/oauth/mcp/register`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({client_name:'trafficboard-sync',redirect_uris:[REDIRECT_URI]})
  });
  const info = await dcr.json();
  console.log(`${info.client_id.substring(0,8)}...`);

  // 2. Discovery
  const meta = await fetch(`${BASE}/.well-known/oauth-authorization-server`).then(r => r.json());

  // 3. Authorize (browser)
  const authUrl = new URL(meta.authorization_endpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', info.client_id);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('state', state);

  console.log('Abra o navegador...');
  exec(`start "" "${authUrl}"`);
  
  const code = await codePromise;
  console.log(`Code: ${code.substring(0,10)}...`);

  // 4. Token exchange
  process.stdout.write('Token... ');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT_URI,
    client_id: info.client_id,
  });
  
  const tokenResp = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body
  });
  
  if (!tokenResp.ok) {
    console.log(`FAIL (${tokenResp.status}): ${await tokenResp.text()}`);
    process.exit(1);
  }
  const tokens = await tokenResp.json();
  console.log(`OK (${tokens.access_token.substring(0,12)}...)`);

  // 5. Call MCP tools
  console.log('\nBuscando dados:');
  async function call(name, args={}) {
    const r = await fetch(MCP_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':`Bearer ${tokens.access_token}`},
      body: JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})
    });
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  }

  const data = {period:'today',account:'all'};
  
  try { process.stdout.write('  Dashboard... '); const r = await call('easytracker_get_dashboard_report',{period:'today'}); const p = JSON.parse(r.result.content[0].text); data.kpis = p.kpis||p; data.funnel = p.funnel; data.salesByHour = p.salesByHour; data.salesByDay = p.salesByDay; data.salesByCountry = p.salesByCountry; data.salesByPayment = p.salesByPayment; console.log('OK'); } catch(e) { console.log(e.message); }
  try { process.stdout.write('  Campanhas... '); const r = await call('easytracker_list_campaigns'); data.campaigns = JSON.parse(r.result.content[0].text); console.log(`${data.campaigns.length} itens`); } catch(e) { console.log(e.message); }
  try { process.stdout.write('  Ad Sets... '); const r = await call('easytracker_list_ad_sets'); data.adSets = JSON.parse(r.result.content[0].text); console.log(`${data.adSets.length} itens`); } catch(e) { console.log(e.message); }
  try { process.stdout.write('  Ads... '); const r = await call('easytracker_list_ads',{period:'today'}); data.ads = data.creatives = JSON.parse(r.result.content[0].text); console.log(`${data.ads.length} itens`); } catch(e) { console.log(e.message); }
  try { process.stdout.write('  Contas... '); const r = await call('easytracker_list_ad_accounts'); data.adAccounts = JSON.parse(r.result.content[0].text); console.log(`${data.adAccounts.length} itens`); } catch(e) { console.log(e.message); }
  try { process.stdout.write('  Produtos... '); const r = await call('easytracker_list_offers'); data.products = JSON.parse(r.result.content[0].text); console.log(`${data.products.length} itens`); } catch(e) { console.log(e.message); }
  try { process.stdout.write('  Canais... '); const r = await call('easytracker_list_traffic_channels'); data.trafficChannels = JSON.parse(r.result.content[0].text); console.log(`${data.trafficChannels.length} itens`); } catch(e) { console.log(e.message); }

  // 6. Sync to Railway
  console.log('\nEnviando para Railway...');
  const sync = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: {'Content-Type':'application/json','Authorization':`Bearer ${SYNC_SECRET}`},
    body: JSON.stringify({data})
  });
  if (!sync.ok) { console.error(`FAIL (${sync.status}): ${await sync.text()}`); process.exit(1); }
  const result = await sync.json();
  console.log('=== SYNC CONCLUIDO ===');
  console.log(`Dados: ${result.data.keys.join(', ')}`);
  console.log(`${new Date(result.data.syncedAt).toLocaleString('pt-BR')}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });

/**
 * Sync EasyTracker -> Railway
 * Usa MCP SDK para OAuth (registro dinâmico) e busca de dados.
 *
 * Uso:
 *   cd C:\Dash-Prab\trafficboard\server
 *   node scripts/sync.js
 */
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const MCP_URL = 'https://api.easytracker.digital/api/mcp/v1';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';

async function callMCP(client, name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  return r;
}

async function main() {
  console.log('🔌 Conectando ao EasyTracker via MCP SDK...');
  console.log('   O navegador vai abrir para autorização. Faça login e autorize.\n');

  const client = new Client({ name: 'trafficboard-sync', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));

  try {
    await client.connect(transport);
  } catch (err) {
    // If OAuth is needed, SDK opens browser automatically
    console.log('🔄 Tentando novamente com OAuth...');
    await client.connect(transport);
  }
  console.log('✅ Conectado ao EasyTracker!\n');

  // Fetch data
  const data = { period: 'today', account: 'all' };

  const tools = [
    ['📊 Dashboard', 'easytracker_get_dashboard_report', { period: 'today' }, (r, d) => {
      if (!r.content?.[0]?.text) return;
      const p = JSON.parse(r.content[0].text);
      d.kpis = p.kpis || p;
      d.funnel = p.funnel;
      d.salesByHour = p.salesByHour;
      d.salesByDay = p.salesByDay;
      d.salesByCountry = p.salesByCountry;
      d.salesByPayment = p.salesByPayment;
    }],
    ['📦 Campanhas', 'easytracker_list_campaigns', {}, (r, d) => { if (r.content?.[0]?.text) d.campaigns = JSON.parse(r.content[0].text); }],
    ['📦 Ad Sets', 'easytracker_list_ad_sets', {}, (r, d) => { if (r.content?.[0]?.text) d.adSets = JSON.parse(r.content[0].text); }],
    ['📦 Criativos', 'easytracker_list_ads', { period: 'today' }, (r, d) => { if (r.content?.[0]?.text) d.ads = d.creatives = JSON.parse(r.content[0].text); }],
    ['📦 Contas', 'easytracker_list_ad_accounts', {}, (r, d) => { if (r.content?.[0]?.text) d.adAccounts = JSON.parse(r.content[0].text); }],
    ['📦 Produtos', 'easytracker_list_offers', {}, (r, d) => { if (r.content?.[0]?.text) d.products = JSON.parse(r.content[0].text); }],
    ['📦 Canais', 'easytracker_list_traffic_channels', {}, (r, d) => { if (r.content?.[0]?.text) d.trafficChannels = JSON.parse(r.content[0].text); }],
  ];

  for (const [label, name, args, extract] of tools) {
    process.stdout.write(`${label}... `);
    try {
      const r = await callMCP(client, name, args);
      extract(r, data);
      const arr = r.content?.[0]?.text ? JSON.parse(r.content[0].text) : [];
      console.log(`✅ ${Array.isArray(arr) ? arr.length + ' itens' : 'OK'}`);
    } catch (e) {
      console.log(`⚠️ ${e.message}`);
    }
  }

  // Sync to Railway
  console.log('\n📤 Enviando para Railway...');
  const resp = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SYNC_SECRET}` },
    body: JSON.stringify({ data }),
  });

  if (!resp.ok) {
    console.error(`❌ Sync falhou: ${await resp.text()}`);
    process.exit(1);
  }

  const result = await resp.json();
  console.log('✅ Sync concluído!');
  console.log(`   Keys: ${result.data.keys.join(', ')}`);
  console.log(`   ${new Date(result.data.syncedAt).toLocaleString('pt-BR')}`);

  await client.close();
}

main().catch(err => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
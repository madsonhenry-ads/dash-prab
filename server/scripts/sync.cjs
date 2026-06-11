const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const MCP_URL = 'https://api.easytracker.digital/api/mcp/v1';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';

async function main() {
  // Use MCP SDK which handles dynamic client registration + OAuth properly
  console.log('🔌 Conectando ao EasyTracker via MCP SDK...');
  console.log('   O navegador vai abrir para autorização.\n');

  const client = new Client({ name: 'trafficboard-sync', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    // The SDK will handle OAuth with PKCE + dynamic client registration
  });

  await client.connect(transport);
  console.log('✅ Conectado ao EasyTracker!\n');

  // Fetch all data
  const data = { period: 'today', account: 'all' };

  console.log('📊 Dashboard report...');
  try {
    const r = await client.callTool({ name: 'easytracker_get_dashboard_report', arguments: { period: 'today' } });
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
    const r = await client.callTool({ name: 'easytracker_list_campaigns', arguments: {} });
    if (r.content?.[0]?.text) { data.campaigns = JSON.parse(r.content[0].text); console.log(`   ✅ ${data.campaigns.length}`); }
  } catch (e) { console.warn('   ⚠️', e.message); }

  console.log('📦 Criativos...');
  try {
    const r = await client.callTool({ name: 'easytracker_list_ads', arguments: { period: 'today' } });
    if (r.content?.[0]?.text) { data.ads = data.creatives = JSON.parse(r.content[0].text); console.log(`   ✅ ${data.ads.length}`); }
  } catch (e) { console.warn('   ⚠️', e.message); }

  console.log('📦 Contas, produtos e canais...');
  try {
    const [ac, of, tc] = await Promise.all([
      client.callTool({ name: 'easytracker_list_ad_accounts', arguments: {} }).catch(() => ({ content: [] })),
      client.callTool({ name: 'easytracker_list_offers', arguments: {} }).catch(() => ({ content: [] })),
      client.callTool({ name: 'easytracker_list_traffic_channels', arguments: {} }).catch(() => ({ content: [] })),
    ]);
    if (ac.content?.[0]?.text) { data.adAccounts = JSON.parse(ac.content[0].text); console.log(`   ✅ ${data.adAccounts.length} contas`); }
    if (of.content?.[0]?.text) { data.products = JSON.parse(of.content[0].text); console.log(`   ✅ ${data.products.length} produtos`); }
    if (tc.content?.[0]?.text) { data.trafficChannels = JSON.parse(tc.content[0].text); console.log(`   ✅ ${data.trafficChannels.length} canais`); }
  } catch (e) { console.warn('   ⚠️', e.message); }

  // Sync
  console.log('\n📤 Enviando para Railway...');
  const syncResp = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SYNC_SECRET}` },
    body: JSON.stringify({ data }),
  });
  if (!syncResp.ok) { console.error(`❌ Sync falhou: ${await syncResp.text()}`); process.exit(1); }
  const result = await syncResp.json();
  console.log(`✅ Sync concluído! Keys: ${result.data.keys.join(', ')}`);

  await client.close();
}

main().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
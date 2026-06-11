/**
 * Captura tokens do EasyTracker usando o MCP SDK e faz o sync.
 * Roda: npx tsx scripts/capture-and-sync.ts
 *
 * 1. Conecta via MCP SDK (abre browser para OAuth)
 * 2. Captura os tokens recebidos
 * 3. Salva no .credentials.json para uso futuro
 * 4. Busca dados e envia pro Railway
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const MCP_URL = 'https://api.easytracker.digital/api/mcp/v1';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';

async function main() {
  console.log('🔌 Conectando ao EasyTracker MCP...');
  console.log('   O navegador vai abrir para autorização.\n');

  const client = new Client({ name: 'trafficboard-sync', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));

  await client.connect(transport);
  console.log('✅ Conectado ao EasyTracker MCP!\n');

  // 2. Fetch data
  const data: any = { period: 'today', account: 'all' };

  console.log('📊 Buscando dashboard report...');
  try {
    const res = await client.callTool({ name: 'easytracker_get_dashboard_report', arguments: { period: 'today' } }) as any;
    const text = res.content?.[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      data.kpis = parsed.kpis || parsed;
      data.funnel = parsed.funnel;
      data.salesByHour = parsed.salesByHour;
      data.salesByDay = parsed.salesByDay;
      data.salesByCountry = parsed.salesByCountry;
      data.salesByPayment = parsed.salesByPayment;
      console.log('   ✅ Dashboard data');
    }
  } catch (e: any) { console.warn('   ⚠️', e.message); }

  console.log('📦 Buscando campanhas...');
  try {
    const res = await client.callTool({ name: 'easytracker_list_campaigns', arguments: {} }) as any;
    const text = res.content?.[0]?.text;
    if (text) { data.campaigns = JSON.parse(text); console.log(`   ✅ ${data.campaigns.length} campanhas`); }
  } catch (e: any) { console.warn('   ⚠️', e.message); }

  console.log('📦 Buscando criativos...');
  try {
    const res = await client.callTool({ name: 'easytracker_list_ads', arguments: { period: 'today' } }) as any;
    const text = res.content?.[0]?.text;
    if (text) { data.ads = data.creatives = JSON.parse(text); console.log(`   ✅ ${data.ads.length} criativos`); }
  } catch (e: any) { console.warn('   ⚠️', e.message); }

  console.log('📦 Buscando contas, produtos e canais...');
  try {
    const [ac, of, tc] = await Promise.all([
      client.callTool({ name: 'easytracker_list_ad_accounts', arguments: {} }).catch(() => ({ content: [] })),
      client.callTool({ name: 'easytracker_list_offers', arguments: {} }).catch(() => ({ content: [] })),
      client.callTool({ name: 'easytracker_list_traffic_channels', arguments: {} }).catch(() => ({ content: [] })),
    ]);
    if (ac.content?.[0]?.text) { data.adAccounts = JSON.parse(ac.content[0].text); console.log(`   ✅ ${data.adAccounts.length} contas`); }
    if (of.content?.[0]?.text) { data.products = JSON.parse(of.content[0].text); console.log(`   ✅ ${data.products.length} produtos`); }
    if (tc.content?.[0]?.text) { data.trafficChannels = JSON.parse(tc.content[0].text); console.log(`   ✅ ${data.trafficChannels.length} canais`); }
  } catch (e: any) { console.warn('   ⚠️', e.message); }

  console.log('\n📤 Enviando dados para o Railway...');
  const resp = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SYNC_SECRET}` },
    body: JSON.stringify({ data }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`❌ Sync falhou (${resp.status}): ${text}`);
    process.exit(1);
  }

  const result = await resp.json();
  console.log(`✅ Sync concluído! Keys: ${result.data.keys.join(', ')}`);
  console.log(`   ${new Date(result.data.syncedAt).toLocaleString()}`);

  await client.close();
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
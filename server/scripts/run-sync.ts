/**
 * Sync script: roda localmente, puxa dados reais do EasyTracker MCP,
 * e envia para o Railway via POST /api/sync.
 *
 * Uso:
 *   SYNC_SECRET="sua-chave" RAILWAY_URL="https://dash-prab-production.up.railway.app" npx tsx scripts/run-sync.ts
 *
 * Opcional:
 *   PERIOD=today       (default: today)
 *   ACCOUNT=all        (default: all)
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '';
const PERIOD = process.env.PERIOD || 'today';
const ACCOUNT = process.env.ACCOUNT || 'all';
const MCP_URL = 'https://api.easytracker.digital/api/mcp/v1';

async function sync() {
  if (!SYNC_SECRET) {
    console.error('❌ Defina SYNC_SECRET (ex: SYNC_SECRET="sua-chave" npx tsx scripts/run-sync.ts)');
    process.exit(1);
  }

  // 1. Connect to EasyTracker MCP locally
  console.log('🔌 Conectando ao EasyTracker MCP (local)...');
  const client = new Client({ name: 'trafficboard-sync', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));

  try {
    await client.connect(transport);
  } catch (err: any) {
    console.error('❌ Falha ao conectar MCP:', err.message);
    console.error('   Certifique-se de que o OAuth do EasyTracker está ativo.');
    console.error('   Execute: claude mcp add --transport http easytracker https://api.easytracker.digital/api/mcp/v1');
    process.exit(1);
  }

  console.log('✅ Conectado ao EasyTracker MCP!\n');

  // 2. Call all tools and collect data
  const data: any = { period: PERIOD, account: ACCOUNT };

  // Dashboard report
  console.log('📊 Buscando dashboard report...');
  try {
    const report = await client.callTool({ name: 'easytracker_get_dashboard_report', arguments: { period: PERIOD } }) as any;
    if (report.content?.[0]?.text) {
      const parsed = JSON.parse(report.content[0].text);
      data.kpis = parsed.kpis || parsed;
      data.funnel = parsed.funnel;
      data.salesByHour = parsed.salesByHour;
      data.salesByDay = parsed.salesByDay;
      data.salesByCountry = parsed.salesByCountry;
      data.salesByPayment = parsed.salesByPayment;
      console.log('   ✅ KPIs, funnel, vendas');
    }
  } catch (err: any) {
    console.warn('   ⚠️ Dashboard report:', err.message);
  }

  // Campaigns
  console.log('📦 Buscando campanhas...');
  try {
    const campaigns = await client.callTool({ name: 'easytracker_list_campaigns', arguments: {} }) as any;
    if (campaigns.content?.[0]?.text) {
      data.campaigns = JSON.parse(campaigns.content[0].text);
      console.log(`   ✅ ${data.campaigns.length} campanhas`);
    }
  } catch (err: any) {
    console.warn('   ⚠️ Campanhas:', err.message);
  }

  // Ad Sets
  console.log('📦 Buscando ad sets...');
  try {
    const adSets = await client.callTool({ name: 'easytracker_list_ad_sets', arguments: {} }) as any;
    if (adSets.content?.[0]?.text) {
      data.adSets = JSON.parse(adSets.content[0].text);
      console.log(`   ✅ ${data.adSets.length} ad sets`);
    }
  } catch (err: any) {
    console.warn('   ⚠️ Ad sets:', err.message);
  }

  // Ads / Creatives
  console.log('📦 Buscando criativos...');
  try {
    const ads = await client.callTool({ name: 'easytracker_list_ads', arguments: { period: PERIOD } }) as any;
    if (ads.content?.[0]?.text) {
      data.ads = JSON.parse(ads.content[0].text);
      data.creatives = data.ads;
      console.log(`   ✅ ${data.ads.length} criativos`);
    }
  } catch (err: any) {
    console.warn('   ⚠️ Criativos:', err.message);
  }

  // Ad Accounts
  console.log('📦 Buscando contas de anúncio...');
  try {
    const accounts = await client.callTool({ name: 'easytracker_list_ad_accounts', arguments: {} }) as any;
    if (accounts.content?.[0]?.text) {
      data.adAccounts = JSON.parse(accounts.content[0].text);
      console.log(`   ✅ ${data.adAccounts.length} contas`);
    }
  } catch (err: any) {
    console.warn('   ⚠️ Ad accounts:', err.message);
  }

  // Products (Offers)
  console.log('📦 Buscando produtos...');
  try {
    const offers = await client.callTool({ name: 'easytracker_list_offers', arguments: {} }) as any;
    if (offers.content?.[0]?.text) {
      data.products = JSON.parse(offers.content[0].text);
      console.log(`   ✅ ${data.products.length} produtos`);
    }
  } catch (err: any) {
    console.warn('   ⚠️ Produtos:', err.message);
  }

  // Traffic Channels
  console.log('📦 Buscando canais de tráfego...');
  try {
    const channels = await client.callTool({ name: 'easytracker_list_traffic_channels', arguments: {} }) as any;
    if (channels.content?.[0]?.text) {
      data.trafficChannels = JSON.parse(channels.content[0].text);
      console.log(`   ✅ ${data.trafficChannels.length} canais`);
    }
  } catch (err: any) {
    console.warn('   ⚠️ Canais:', err.message);
  }

  await client.close();

  // 3. Send to Railway
  console.log('\n📤 Enviando dados para o Railway...');
  const resp = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SYNC_SECRET}`,
    },
    body: JSON.stringify({ data }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`❌ Sync falhou (${resp.status}): ${text}`);
    process.exit(1);
  }

  const result = await resp.json();
  console.log('✅ Sync concluído!');
  console.log(`   Keys enviadas: ${result.data.keys.join(', ')}`);
  console.log(`   Synced at: ${new Date(result.data.syncedAt).toLocaleString()}`);
}

sync().catch(err => {
  console.error('\n❌ Erro no sync:', err.message);
  process.exit(1);
});
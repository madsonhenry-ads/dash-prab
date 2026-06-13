const TOKEN = process.env.EASYTRACKER_ACCESS_TOKEN;
const BASE = 'https://api.easytracker.digital/api';
const DASHBOARD_UUID = '5d266636-7c23-4add-ae7b-6aeadcfee1cb';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'x-app-id': '111127',
  Origin: 'https://app.easytracker.digital',
  Accept: 'application/json',
};

async function main() {
  console.log('1. Dashboard...');
  const dashRes = await fetch(`${BASE}/dashboards/${DASHBOARD_UUID}?dashboardId=${DASHBOARD_UUID}&beginDate=2026-06-11&endDate=2026-06-11`, { headers });
  const dash = await dashRes.json();
  const summary = Object.fromEntries((dash.data.summary || []).filter(s => s.key).map(s => [s.key, parseFloat(s.value) || 0]));
  console.log(`   Spent: ${summary.total_spent}, Revenue: ${summary.total_revenue}, ROAS: ${summary.roas}`);

  console.log('2. Campaigns...');
  const campsRes = await fetch(`${BASE}/campaigns?beginDate=2026-06-11&endDate=2026-06-11`, { headers });
  const camps = await campsRes.json();
  console.log(`   ${camps.data.length} campaigns`);

  console.log('3. Traffic channels...');
  const chRes = await fetch(`${BASE}/traffic-channels?beginDate=2026-06-11&endDate=2026-06-11`, { headers });
  const channels = await chRes.json();
  console.log(`   ${channels.data.length} channels`);

  console.log('4. Syncing to Railway...');
  const body = {
    data: {
      period: 'today',
      account: 'all',
      kpis: {
        adSpend: summary.total_spent || 0,
        profit: summary.gross_profit || 0,
        roas: summary.roas || 0,
        netRevenue: summary.total_revenue || 0,
        cpa: summary.cpa || 0,
        margin: summary.total_revenue ? ((summary.gross_profit || 0) / summary.total_revenue) * 100 : 0,
        roi: summary.roi || 0,
        arpu: summary.avg_ticket || 0,
        approvedSales: parseInt(dash.data.funnel?.purchases || 0),
        grossRevenue: summary.total_revenue || 0,
      },
      funnel: [
        { label: 'Cliques', value: parseInt(dash.data.funnel?.clicks || 0) },
        { label: 'Visualizações', value: parseInt(dash.data.funnel?.landing_views || 0) },
        { label: 'Offers', value: parseInt(dash.data.funnel?.offers || 0) },
        { label: 'Purchases', value: parseInt(dash.data.funnel?.purchases || 0) },
      ],
      topCampaigns: (dash.data.campaignComparison || []).map(c => ({
        name: c.name || '', spend: parseFloat(c.total_spent || 0), revenue: parseFloat(c.total_revenue || 0), roas: parseFloat(c.roas || 0),
      })),
      campaigns: camps.data.map(c => ({
        id: String(c.id), name: c.name || '', status: 'ACTIVE', budget: 0,
        spend: parseFloat(c.total_spent || 0), impressions: 0, clicks: 0,
        revenue: 0, profit: 0, roas: 0, cpa: 0, ctr: 0, sales: 0,
      })),
      trafficChannels: (channels.data || []).map(t => ({ id: String(t.id), name: t.name || 'Unknown', platform: t.name || '' })),
      products: [], adAccounts: [],
      ads: { rows: [], total: 0 },
      creatives: { rows: [], total: 0 },
    }
  };

  const syncRes = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SYNC_SECRET}` },
    body: JSON.stringify(body),
  });

  if (syncRes.ok) {
    const result = await syncRes.json();
    console.log('   Sync OK! Keys:', result.data.keys.join(', '));
    console.log('\n✅ DADOS REAIS ENVIADOS! Acesse o dashboard.');
  } else {
    const text = await syncRes.text();
    console.log('   Sync FAILED:', syncRes.status, text);
  }
}

main().catch(e => { console.error('ERRO:', e.message, e.stack?.split('\n')[1]); process.exit(1); });
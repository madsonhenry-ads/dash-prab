/**
 * Sync local: busca dados reais do EasyTracker via REST API
 * e envia para o Railway.
 *
 * Uso:
 *   cd C:\Dash-Prab\trafficboard\server
 *   node scripts/sync-real.js
 *
 * Opções:
 *   --period=today     (default: busca today, last_7, last_30)
 *   --debug            (mostra dados completos)
 *   --no-sync          (só busca, não envia pro Railway)
 *
 * Variáveis de ambiente:
 *   EASYTRACKER_ACCESS_TOKEN  - JWT token do cookie tracker_token (F12 > Network > cookie)
 *   RAILWAY_URL               - URL do Railway (default: https://dash-prab-production.up.railway.app)
 *   SYNC_SECRET               - Secret para sync (default: 73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310)
 */

// Tenta carregar dotenv, mas não falha se não tiver
try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') }); } catch (e) {}

const TOKEN = process.env.EASYTRACKER_ACCESS_TOKEN;
const BASE = 'https://api.easytracker.digital/api';
const DASHBOARD_UUID = '5d266636-7c23-4add-ae7b-6aeadcfee1cb';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';

const DEBUG = process.argv.includes('--debug');
const NO_SYNC = process.argv.includes('--no-sync');
const SINGLE_PERIOD = process.argv.find(a => a.startsWith('--period='));

if (!TOKEN) {
  console.error('❌ EASYTRACKER_ACCESS_TOKEN não configurado.');
  console.error('   Crie server/.env.local baseado em server/.env.example');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'x-app-id': '111127',
  Origin: 'https://app.easytracker.digital',
  Accept: 'application/json',
};

async function apiGet(path, params = '') {
  const url = `${BASE}/${path}${params ? '?' + params : ''}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`${resp.status} for ${path}`);
  return resp.json();
}

function getDateRanges() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); const yd = yesterday.toISOString().split('T')[0];
  const d7 = new Date(now); d7.setDate(d7.getDate() - 6); const d7s = d7.toISOString().split('T')[0];
  const d30 = new Date(now); d30.setDate(d30.getDate() - 29); const d30s = d30.toISOString().split('T')[0];

  if (SINGLE_PERIOD) {
    const p = SINGLE_PERIOD.split('=')[1];
    const map = { today: [today, today], yesterday: [yd, yd], last_7: [d7s, today], last_30: [d30s, today] };
    return [{ period: p, beginDate: map[p]?.[0] || today, endDate: map[p]?.[1] || today }];
  }

  return [
    { period: 'today', beginDate: today, endDate: today },
    { period: 'yesterday', beginDate: yd, endDate: yd },
    { period: 'last_7', beginDate: d7s, endDate: today },
    { period: 'last_30', beginDate: d30s, endDate: today },
  ];
}

async function fetchDashboardData(beginDate, endDate) {
  const dash = await apiGet(`dashboards/${DASHBOARD_UUID}`, `dashboardId=${DASHBOARD_UUID}&beginDate=${beginDate}&endDate=${endDate}`);
  const summary = Object.fromEntries(dash.data.summary.filter(s => s.key).map(s => [s.key, parseFloat(s.value) || 0]));
  const funnel = dash.data.funnel || {};
  const campComparison = dash.data.campaignComparison || [];

  // Build funnel steps
  const clicks = parseInt(funnel.clicks || 0);
  const landingViews = parseInt(funnel.landing_views || 0);
  const offers = parseInt(funnel.offers || 0);
  const purchases = parseInt(funnel.purchases || 0);
  const funnelSteps = [
    { label: 'Cliques', value: clicks },
    { label: 'Visualizações de Página', value: landingViews, percentage: clicks > 0 ? Math.round((landingViews / clicks) * 1000) / 10 : 0 },
  ];
  if (offers > 0) {
    funnelSteps.push({ label: 'Initiate Checkout', value: offers, percentage: clicks > 0 ? Math.round((offers / clicks) * 1000) / 10 : 0 });
    if (offers > purchases) {
      funnelSteps.push({ label: 'Attempts (Canceled)', value: offers - purchases, percentage: offers > 0 ? Math.round(((offers - purchases) / offers) * 1000) / 10 : 0 });
    }
  }
  funnelSteps.push({ label: 'Completed (Purchase)', value: purchases, percentage: offers > 0 ? Math.round((purchases / offers) * 1000) / 10 : 0 });

  // Top campaigns
  const topCampaigns = campComparison
    .map(c => ({ name: c.name || '', spend: parseFloat(c.total_spent || 0), revenue: parseFloat(c.total_revenue || 0), roas: parseFloat(c.roas || 0) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    kpis: {
      adSpend: summary.total_spent || 0,
      profit: summary.gross_profit || 0,
      roas: summary.roas || 0,
      netRevenue: summary.total_revenue || 0,
      cpa: summary.cpa || 0,
      margin: summary.total_revenue ? ((summary.gross_profit || 0) / summary.total_revenue) * 100 : 0,
      roi: summary.roi || 0,
      arpu: summary.avg_ticket || 0,
      approvedSales: purchases,
      grossRevenue: summary.total_revenue || 0,
    },
    funnel: funnelSteps,
    salesByHour: [],
    salesByDay: [],
    salesByCountry: [{ country: 'All', sales: purchases, revenue: parseFloat(summary.total_revenue || 0), flag: '🌍' }],
    salesByPayment: [],
    topCampaigns,
  };
}

async function fetchCampaigns(beginDate, endDate) {
  const result = await apiGet('campaigns', `beginDate=${beginDate}&endDate=${endDate}`);
  return (result.data || []).map(c => ({
    id: String(c.id),
    name: c.name || '',
    status: parseFloat(c.total_spent || 0) > 0 ? 'ACTIVE' : 'PAUSED',
    budget: parseFloat(c.total_spent || 0),
    spend: parseFloat(c.total_spent || 0),
    impressions: 0,
    clicks: 0,
    revenue: 0,
    profit: 0,
    roas: 0,
    cpa: 0,
    ctr: 0,
    sales: 0,
  }));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchCampaignReport(campId, beginDate, endDate) {
  try {
    await sleep(300); // Rate limit safety
    return await apiGet(`reports/campaigns/${campId}`, `groupings[]=sub6&groupings[]=sub5&groupings[]=sub4&beginDate=${beginDate}&endDate=${endDate}`);
  } catch { return { data: [] }; }
}

async function fetchCreatives(campaigns, beginDate, endDate) {
  const creativeMap = {};
  const adSetMap = {};
  let campaignRevenue = {};

  // Initialize campaign revenue from comparison data
  try {
    const dash = await apiGet(`dashboards/${DASHBOARD_UUID}`, `dashboardId=${DASHBOARD_UUID}&beginDate=${beginDate}&endDate=${endDate}`);
    (dash.data.campaignComparison || []).forEach(c => {
      campaignRevenue[String(c.id)] = {
        spend: parseFloat(c.total_spent || 0),
        revenue: parseFloat(c.total_revenue || 0),
        profit: parseFloat(c.gross_profit || 0),
        sales: parseInt(c.total_purchase || 0),
      };
    });
  } catch {}

  for (const camp of campaigns.filter(c => c.id)) {
    const report = await fetchCampaignReport(camp.id, beginDate, endDate);
    const items = report.data || [];
    const campData = campaignRevenue[camp.id] || {};

    for (const item of items) {
      const sub6 = (item.sub6 || '').trim();
      const sub5 = (item.sub5 || '').trim();
      const sub4 = (item.sub4 || '').trim();

      // Process creative (sub6 = creative name)
      if (sub6) {
        if (!creativeMap[sub6]) {
          creativeMap[sub6] = {
            id: sub6,
            name: sub6,
            campaignName: camp.name || '',
            campaignId: String(camp.id),
            adSetId: '',
            status: parseFloat(item.total_spent || 0) > 0 ? 'active' : 'no_data',
            startDate: beginDate,
            spend: 0, revenue: 0, profit: 0, roas: 0, cpa: 0, cpc: 0, ctr: 0,
            hookRate: 0, holdRate: 0, sales: 0, addToCart: 0,
            impressions: 0, clicks: 0, bounce_rate: 0,
            landing_views: 0, landing_clicks: 0, avg_ticket: 0, cic: 0,
          };
        }
        const cr = creativeMap[sub6];
        cr.spend += parseFloat(item.total_spent || 0);
        cr.revenue += parseFloat(item.total_revenue || 0);
        cr.profit += parseFloat(item.gross_profit || 0);
        cr.sales += parseInt(item.custom_purchase_count || 0, 10);
        cr.clicks += parseInt(item.clicks || 0, 10);
        cr.landing_views += parseInt(item.landing_views || 0, 10);
        cr.landing_clicks += parseInt(item.landing_clicks || 0, 10);
        cr.bounce_rate = parseFloat(item.bounce_rate || 0);
        cr.avg_ticket = parseFloat(item.avg_ticket || 0);
        cr.hookRate = parseFloat(item.hook_rate ?? 0);
        cr.holdRate = parseFloat(item.hold_rate ?? 0);
        cr.cpc = cr.clicks > 0 ? Math.round((cr.spend / cr.clicks) * 100) / 100 : 0;
        cr.roas = cr.spend > 0 ? Math.round((cr.revenue / cr.spend) * 100) / 100 : 0;
        cr.cpa = cr.sales > 0 ? Math.round((cr.spend / cr.sales) * 100) / 100 : 0;
        cr.ctr = parseFloat(item.lead_to_purchase_conversion || 0);
        cr.cic = cr.landing_clicks > 0 ? Math.round((cr.spend / cr.landing_clicks) * 100) / 100 : 0;
        if (cr.sales > 0) cr.status = 'active';
        else if (cr.clicks > 0) cr.status = 'paused';
      }

      // Process ad set (sub5)
      if (sub5) {
        const key = `${camp.id}:${sub5}`;
        if (!adSetMap[key]) {
          adSetMap[key] = {
            id: key, name: sub5, campaignId: String(camp.id), campaignName: camp.name || '',
            status: parseFloat(item.total_spent || 0) > 0 ? 'ACTIVE' : 'PAUSED',
            spend: 0, revenue: 0, profit: 0, roas: 0, impressions: 0, clicks: 0, ctr: 0, sales: 0,
          };
        }
        const as = adSetMap[key];
        as.spend += parseFloat(item.total_spent || 0);
        as.revenue += parseFloat(item.total_revenue || 0);
        as.profit += parseFloat(item.gross_profit || 0);
        as.sales += parseInt(item.custom_purchase_count || 0, 10);
        as.clicks += parseInt(item.clicks || 0, 10);
        as.roas = as.spend > 0 ? Math.round((as.revenue / as.spend) * 100) / 100 : 0;
        if (as.sales > 0) as.status = 'ACTIVE';
        else if (as.clicks > 0) as.status = 'PAUSED';
      }
    }

    // If no sub6 data from report, use campaign-level data
    if (items.length === 0 && campData.spend > 0) {
      const creativeKey = `${camp.name} - General`;
      if (!creativeMap[creativeKey]) {
        creativeMap[creativeKey] = {
          id: creativeKey, name: creativeKey, campaignName: camp.name || '', campaignId: String(camp.id),
          adSetId: '', status: 'active', startDate: beginDate,
          spend: 0, revenue: 0, profit: 0, roas: 0, cpa: 0, cpc: 0, ctr: 0,
          hookRate: 0, holdRate: 0, sales: 0, addToCart: 0,
          impressions: 0, clicks: 0, bounce_rate: 0,
          landing_views: 0, landing_clicks: 0, avg_ticket: 0, cic: 0,
        };
      }
      const cr = creativeMap[creativeKey];
      cr.spend += campData.spend;
      cr.revenue += campData.revenue;
      cr.profit += campData.profit;
      cr.sales += campData.sales;
      cr.roas = cr.spend > 0 ? Math.round((cr.revenue / cr.spend) * 100) / 100 : 0;
      cr.cpa = cr.sales > 0 ? Math.round((cr.spend / cr.sales) * 100) / 100 : 0;
    }
  }

  return {
    creatives: Object.values(creativeMap).sort((a, b) => b.spend - a.spend),
    adSets: Object.values(adSetMap).sort((a, b) => b.spend - a.spend),
  };
}

async function fetchFilters() {
  const [channelsRes, offersRes] = await Promise.all([
    apiGet('traffic-channels').catch(() => ({ data: [] })),
    apiGet('offers', 'per_page=50').catch(() => ({ data: [] })),
  ]);

  return {
    trafficChannels: (channelsRes.data || []).map(t => ({ id: String(t.id), name: t.name || 'Unknown', platform: t.name || '' })),
    products: (offersRes.data || []).map(o => ({ id: String(o.id || o.offer_id), name: o.name || `Product ${o.id}`, price: parseFloat(o.avg_ticket || 0) })),
    adAccounts: [],
  };
}

async function main() {
  console.log('🔵 SYNC REAL - EasyTracker → Railway');
  console.log(`   Token: ${TOKEN.substring(0, 20)}...`);
  console.log(`   Railway: ${RAILWAY_URL}\n`);

  const dateRanges = getDateRanges();
  const allData = {};

  // Step 1: Fetch filters (static, no period dependency)
  console.log('📦 Buscando filtros...');
  const filters = await fetchFilters();
  allData.adAccounts = filters.adAccounts;
  allData.products = filters.products;
  allData.trafficChannels = filters.trafficChannels;
  console.log(`   ✅ ${filters.trafficChannels.length} channels, ${filters.products.length} products\n`);

  // Step 2: Fetch data for each period
  for (const { period, beginDate, endDate } of dateRanges) {
    console.log(`📊 Período: ${period} (${beginDate} → ${endDate})`);

    try {
      // Dashboard data
      const dashData = await fetchDashboardData(beginDate, endDate);
      allData[`kpis_${period}`] = dashData.kpis;
      allData[`funnel_${period}`] = dashData.funnel;
      allData[`salesByHour_${period}`] = dashData.salesByHour;
      allData[`salesByDay_${period}`] = dashData.salesByDay;
      allData[`salesByCountry_${period}`] = dashData.salesByCountry;
      allData[`salesByPayment_${period}`] = dashData.salesByPayment;
      allData[`topCampaigns_${period}`] = dashData.topCampaigns;

      console.log(`   ✅ Dashboard: $${dashData.kpis.adSpend} spent, $${dashData.kpis.netRevenue} revenue, ${dashData.kpis.approvedSales} sales`);
    } catch (e) {
      console.log(`   ⚠️ Dashboard: ${e.message}`);
    }

    // Campaigns
    try {
      const campaigns = await fetchCampaigns(beginDate, endDate);
      allData[`campaigns_${period}`] = campaigns;
      console.log(`   ✅ ${campaigns.length} campanhas`);

      // Creatives & AdSets (from campaign reports)
      const { creatives, adSets } = await fetchCreatives(campaigns, beginDate, endDate);
      allData[`creatives_${period}`] = { rows: creatives, total: creatives.length };
      allData[`ads_${period}`] = { rows: creatives, total: creatives.length };
      allData[`adSets_${period}`] = adSets;
      console.log(`   ✅ ${creatives.length} criativos, ${adSets.length} ad sets`);
    } catch (e) {
      console.log(`   ⚠️ Campaigns: ${e.message}`);
    }

    console.log();
  }

  // Also store under simple keys for the current period (today)
  const todayPeriod = dateRanges.find(d => d.period === 'today') || dateRanges[0];
  const tp = todayPeriod.period;
  if (allData[`kpis_${tp}`]) allData.kpis = allData[`kpis_${tp}`];
  if (allData[`funnel_${tp}`]) allData.funnel = allData[`funnel_${tp}`];
  if (allData[`salesByHour_${tp}`]) allData.salesByHour = allData[`salesByHour_${tp}`];
  if (allData[`salesByDay_${tp}`]) allData.salesByDay = allData[`salesByDay_${tp}`];
  if (allData[`salesByCountry_${tp}`]) allData.salesByCountry = allData[`salesByCountry_${tp}`];
  if (allData[`salesByPayment_${tp}`]) allData.salesByPayment = allData[`salesByPayment_${tp}`];
  if (allData[`topCampaigns_${tp}`]) allData.topCampaigns = allData[`topCampaigns_${tp}`];
  if (allData[`campaigns_${tp}`]) allData.campaigns = allData[`campaigns_${tp}`];
  if (allData[`creatives_${tp}`]) allData.creatives = allData[`creatives_${tp}`];
  if (allData[`ads_${tp}`]) allData.ads = allData[`ads_${tp}`];
  if (allData[`adSets_${tp}`]) allData.adSets = allData[`adSets_${tp}`];

  allData.period = 'today';
  allData.account = 'all';

  if (DEBUG) {
    console.log('=== DADOS COMPLETOS ===');
    console.log(JSON.stringify(allData, null, 2).substring(0, 3000));
  }

  if (NO_SYNC) {
    console.log('👀 Modo debug (--no-sync) — dados não enviados ao Railway');
    console.log(`   Total de períodos: ${dateRanges.length}`);
    return;
  }

  // Step 3: Sync to Railway
  console.log('📤 Enviando para Railway...');
  const resp = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SYNC_SECRET}` },
    body: JSON.stringify({ data: allData }),
  });

  if (!resp.ok) {
    console.error(`❌ Sync falhou: ${resp.status} ${await resp.text()}`);
    process.exit(1);
  }

  const result = await resp.json();
  console.log(`✅ Sync concluído!`);
  console.log(`   Keys: ${result.data.keys.join(', ')}`);
  console.log(`   ${new Date(result.data.syncedAt).toLocaleString('pt-BR')}`);
  console.log(`   Períodos enviados: ${dateRanges.map(d => d.period).join(', ')}`);
  console.log(`\n🔗 Dashboard: ${RAILWAY_URL}`);
}

main().catch(err => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
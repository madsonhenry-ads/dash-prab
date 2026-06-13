/**
 * Test script to fetch real data from EasyTracker REST API
 * and display it. Used as a step before syncing to Railway.
 *
 * Usage: node scripts/fetch-real-data.js
 */
const TOKEN = process.env.EASYTRACKER_ACCESS_TOKEN || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FwaS5lYXN5dHJhY2tlci5kaWdpdGFsL2FwaS9hdXRoL2FjdGlvbi9sb2dpbiIsImlhdCI6MTc4MTE4MTUyNywiZXhwIjoxNzgxMjUzNTI3LCJuYmYiOjE3ODExODE1MjcsImp0aSI6InpJWXU3QUlvb2JSd2RQMDEiLCJzdWIiOiIzNjgiLCJwcnYiOiI0YWMwNWMwZjhhYzA4ZjM2NGNiNGQwM2ZiOGUxZjYzMWZlYzMyMmU4IiwidGlkIjoiMDE5ZTNiZjYtNWUxZS03MDRlLWI4YTQtMjRjODA3MzBiYTg1In0.6R45S-I8uotnlHCMB87w3y_usm25YIFh6Av2Ui9n8WU';
const BASE = 'https://api.easytracker.digital/api';
const DASHBOARD_UUID = '5d266636-7c23-4add-ae7b-6aeadcfee1cb';
const beginDate = process.argv[2] || '2026-06-11';
const endDate = process.argv[3] || '2026-06-11';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'x-app-id': '111127',
  Origin: 'https://app.easytracker.digital',
  Accept: 'application/json',
};

async function apiGet(path, params = '') {
  const url = `${BASE}/${path}${params ? '?' + params : ''}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText} for ${path}`);
  return resp.json();
}

async function main() {
  console.log(`=== Fetching EasyTracker data (${beginDate} to ${endDate}) ===\n`);

  // 1. Dashboard KPIs
  console.log('1. DASHBOARD KPIs');
  const dash = await apiGet(`dashboards/${DASHBOARD_UUID}`, `dashboardId=${DASHBOARD_UUID}&beginDate=${beginDate}&endDate=${endDate}`);
  const summary = Object.fromEntries(dash.data.summary.map(s => [s.key, s.value]));
  console.log(JSON.stringify(summary, null, 2));
  console.log();

  // 2. Campaigns
  console.log('2. CAMPAIGNS');
  const camps = await apiGet('campaigns', `beginDate=${beginDate}&endDate=${endDate}`);
  console.log(`   ${camps.data.length} campaigns`);
  camps.data.slice(0, 5).forEach(c => console.log(`   - ${c.name} (id:${c.id})`));
  console.log();

  // 3. Traffic Channels
  console.log('3. TRAFFIC CHANNELS');
  const channels = await apiGet('traffic-channels', `beginDate=${beginDate}&endDate=${endDate}`);
  console.log(`   ${channels.data.length} channels`);
  channels.data.forEach(c => console.log(`   - ${c.name} (id:${c.id})`));
  console.log();

  // 4. Report for campaign ID 3 (grouped by sub6 = creative name)
  console.log('4. CAMPAIGN REPORT (id=3, grouped by sub6)');
  try {
    const report = await apiGet('reports/campaigns/3', `groupings[]=sub6&beginDate=${beginDate}&endDate=${endDate}`);
    console.log(`   ${report.data.length} creative entries`);
    report.data.slice(0, 5).forEach(r => console.log(`   - ${r.sub6}: spent=${r.total_spent} revenue=${r.total_revenue}`));
  } catch (e) { console.log(`   SKIP: ${e.message}`); }
  console.log();

  // 5. Offers/Products
  console.log('5. OFFERS');
  const offers = await apiGet('offers', `beginDate=${beginDate}&endDate=${endDate}`);
  console.log(`   ${offers.data.length} offers`);
  offers.data.slice(0, 5).forEach(o => console.log(`   - ${o.name}`));
  console.log();

  // Summary
  const campComparison = dash.data.campaignComparison || [];
  console.log('=== SUMMARY ===');
  console.log(`Total Spent: ${summary.total_spent}`);
  console.log(`Total Revenue: ${summary.total_revenue}`);
  console.log(`ROAS: ${summary.roas}`);
  console.log(`Gross Profit: ${summary.gross_profit}`);
  console.log(`Purchases: ${dash.data.funnel?.purchases}`);
  console.log(`Campaigns: ${camps.data.length}`);
  console.log(`Campaigns with data: ${campComparison.length}`);
  console.log(`Traffic Channels: ${channels.data.length}`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
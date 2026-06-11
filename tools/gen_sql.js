/**
 * Gera SQL script do JSON para PostgreSQL
 * Formata arrays corretamente para TEXT[] do PostgreSQL = {val1,val2}
 * Pipe: railway connect Postgres < sync_script.sql
 */
const fs = require('fs');
const path = require('path');

const JSON_FILE = path.resolve(__dirname, '../../easytracker_dashboard.json');
const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

const esc = (v) => {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
};

// Converte array JS para array literal PostgreSQL: ["a","b"] → {a,b}
const pgArray = (arr) => {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return "'{}'";
  const vals = arr.map(v => String(v).replace(/[{}"']/g, '')).join(',');
  return `'{${vals}}'`;
};

const lines = [];
lines.push("BEGIN;");

// ── sync_log ──
lines.push("INSERT INTO sync_log (started_at, status) VALUES (NOW(), 'running');");

// ── creatives ──
let count = 0;
for (const c of data.creatives || []) {
  if (!c || typeof c !== 'object') continue;
  lines.push(`INSERT INTO creatives (creative, purchases, revenue_usd, revenue_brl, spend_usd, gross_profit, profit_usd, roas, cpa, cpc, ics, clicks, bounce_rate, landing_views, landing_clicks, conversion_rate, ic_to_purchase_rate, avg_ticket, lead_to_purchase_cvr, campaigns, products, countries, updated_at)
    VALUES (${esc(c.creative || 'N/A')}, ${c.purchases || 0}, ${c.revenue_usd || 0}, ${c.revenue_brl || 0}, ${c.spend_usd || 0}, ${c.gross_profit || 0}, ${c.profit_usd || 0}, ${c.roas || 0}, ${c.cpa || 0}, ${c.cpc || 0}, ${c.ics || 0}, ${c.clicks || 0}, ${c.bounce_rate || 0}, ${c.landing_views || 0}, ${c.landing_clicks || 0}, ${c.conversion_rate || 0}, ${c.ic_to_purchase_rate || 0}, ${c.avg_ticket || 0}, ${c.lead_to_purchase_cvr || 0}, ${pgArray(c.campaigns)}, ${pgArray(c.products)}, ${pgArray(c.countries)}, NOW())
    ON CONFLICT (creative) DO UPDATE SET purchases = EXCLUDED.purchases, revenue_usd = EXCLUDED.revenue_usd, revenue_brl = EXCLUDED.revenue_brl, spend_usd = EXCLUDED.spend_usd, profit_usd = EXCLUDED.profit_usd, roas = EXCLUDED.roas, updated_at = NOW();`);
  count++;
}
console.error(`  [ok] creatives: ${count}`);

// ── purchases ──
count = 0;
for (const p of data.purchases || []) {
  if (!p || typeof p !== 'object') continue;
  const purchasedAt = p.date ? p.date.substring(0, 19).replace('T', ' ') : null;
  lines.push(`INSERT INTO purchases (purchase_id, lead_id, creative, campaign, product, currency, value_usd, value_brl, value_gbp, value_eur, value_cad, sub4, sub5, sub7, country, country_code, device_type, device_model, browser, landing, offer_name, traffic_channel, purchased_at)
    VALUES (${esc(p.purchase_id)}, ${esc(p.lead_id)}, ${esc(p.creative || 'N/A')}, ${esc(p.campaign)}, ${esc(p.product)}, ${esc(p.currency)}, ${p.value_usd || 0}, ${p.value_brl || 0}, ${p.value_gbp || 0}, ${p.value_eur || 0}, ${p.value_cad || 0}, ${esc(p.sub4)}, ${esc(p.sub5)}, ${esc(p.sub7)}, ${esc(p.country)}, ${esc(p.country_code)}, ${esc(p.device_type)}, ${esc(p.device_model)}, ${esc(p.browser)}, ${esc(p.landing)}, ${esc(p.offer_name)}, ${esc(p.traffic_channel)}, ${purchasedAt ? `'${purchasedAt}'` : 'NULL'})
    ON CONFLICT (purchase_id) DO UPDATE SET creative = EXCLUDED.creative, value_usd = EXCLUDED.value_usd;`);
  count++;
}
console.error(`  [ok] purchases: ${count}`);

// ── daily_metrics ──
count = 0;
for (const d of data.daily || []) {
  if (!d || typeof d !== 'object') continue;
  lines.push(`INSERT INTO daily_metrics (date, clicks, ics, purchases, revenue_usd, revenue_brl, unique_creatives, conversion_rate)
    VALUES (${esc(d.date)}, ${d.clicks || 0}, 0, ${d.purchases || 0}, ${d.revenue_usd || 0}, ${d.revenue_brl || 0}, ${d.unique_creatives || 0}, 0)
    ON CONFLICT (date) DO UPDATE SET clicks = EXCLUDED.clicks, purchases = EXCLUDED.purchases, revenue_usd = EXCLUDED.revenue_usd;`);
  count++;
}
console.error(`  [ok] daily_metrics: ${count}`);

// ── campaigns (vazio mesmo, mas deixa a estrutura) ──
console.error(`  [ok] campaigns: ${(data.campaigns || []).length}`);

// ── offers ──
count = 0;
for (const o of data.offers || []) {
  if (!o || typeof o !== 'object' || !o.id) continue;
  lines.push(`INSERT INTO offers (offer_id, name, checkout, product, clicks, landing_clicks, total_spent, total_revenue, total_purchase, roas, roi, cpa, cpc, gross_profit, avg_ticket, funnel_conversion, epc, purchase_count_api, purchase_value_api)
    VALUES (${o.id}, ${esc(o.name)}, ${esc(o.checkout)}, ${esc(o.product)}, ${o.clicks || 0}, ${o.landing_clicks || 0}, ${o.total_spent || 0}, ${o.total_revenue || 0}, ${o.total_purchase || 0}, ${o.roas || 0}, ${o.roi || 0}, ${o.cpa || 0}, ${o.cpc || 0}, ${o.gross_profit || 0}, ${o.avg_ticket || 0}, ${o.funnel_conversion || 0}, ${o.epc || 0}, ${o.purchase_count_api || 0}, ${o.purchase_value_api || 0})
    ON CONFLICT (offer_id) DO UPDATE SET name = EXCLUDED.name, total_spent = EXCLUDED.total_spent, total_revenue = EXCLUDED.total_revenue;`);
  count++;
}
console.error(`  [ok] offers: ${count}`);

// ── country_stats ──
count = 0;
for (const c of data.countries || []) {
  if (!c || typeof c !== 'object') continue;
  lines.push(`INSERT INTO country_stats (country, purchases, revenue_usd, clicks, ics, conversion_rate)
    VALUES (${esc(c.country)}, ${c.purchases || 0}, ${c.revenue_usd || 0}, ${c.clicks || 0}, ${c.ics || 0}, ${c.cvr || 0})
    ON CONFLICT (country) DO UPDATE SET purchases = EXCLUDED.purchases, revenue_usd = EXCLUDED.revenue_usd;`);
  count++;
}
console.error(`  [ok] country_stats: ${count}`);

// ── device_stats ──
count = 0;
for (const d of data.devices || []) {
  if (!d || typeof d !== 'object') continue;
  lines.push(`INSERT INTO device_stats (device, purchases, revenue_usd, clicks)
    VALUES (${esc(d.device)}, ${d.purchases || 0}, ${d.revenue_usd || 0}, ${d.clicks || 0})
    ON CONFLICT (device) DO UPDATE SET purchases = EXCLUDED.purchases, revenue_usd = EXCLUDED.revenue_usd;`);
  count++;
}
console.error(`  [ok] device_stats: ${count}`);

// Update sync_log
const overview = data.overview || {};
lines.push(`UPDATE sync_log SET finished_at = NOW(), status = 'success', total_leads = ${overview.total_clicks || 0}, total_purchases = ${overview.total_purchases || 0}, total_ics = ${overview.initiate_checkouts || 0} WHERE id = (SELECT max(id) FROM sync_log);`);
lines.push("COMMIT;");

const outPath = path.resolve(__dirname, '../../sync_script.sql');
fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
console.error(`[+] Script SQL gerado: ${outPath} (${lines.length} linhas)`);
console.error(`[+] Execute: railway connect Postgres < sync_script.sql`);
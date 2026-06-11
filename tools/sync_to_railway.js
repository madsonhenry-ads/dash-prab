/**
 * Sync easytracker_dashboard.json → PostgreSQL via Railway
 * Roda com: railway run node tools/sync_to_railway.js
 * (o railway run resolve o DNS interno railway.internal)
 */
const fs = require('fs');
const path = require('path');

const JSON_FILE = path.resolve(__dirname, '../../easytracker_dashboard.json');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[!] DATABASE_URL não encontrada. Rode com: railway run node ...');
  process.exit(1);
}

async function main() {
  // Load JSON
  if (!fs.existsSync(JSON_FILE)) {
    console.error('[!] JSON não encontrado em:', JSON_FILE);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  const overview = data.overview || {};
  console.log(`[*] JSON carregado: ${overview.total_purchases || 0} purchases, ${overview.unique_creatives || 0} criativos`);

  // Connect to PostgreSQL
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Sync log
    const syncRes = await client.query(
      `INSERT INTO sync_log (started_at, status) VALUES (NOW(), 'running') RETURNING id`
    );
    const syncId = syncRes.rows[0].id;
    console.log(`[*] Sync ID: ${syncId}`);

    // ── creatives ──
    const creatives = data.creatives || [];
    if (creatives.length > 0) {
      let count = 0;
      for (const c of creatives) {
        if (!c || typeof c !== 'object') continue;
        await client.query(`
          INSERT INTO creatives
            (creative, purchases, revenue_usd, revenue_brl, ics, clicks,
             conversion_rate, ic_to_purchase_rate, campaigns, products, countries, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
          ON CONFLICT (creative) DO UPDATE SET
            purchases = EXCLUDED.purchases, revenue_usd = EXCLUDED.revenue_usd,
            revenue_brl = EXCLUDED.revenue_brl, ics = EXCLUDED.ics,
            clicks = EXCLUDED.clicks, updated_at = NOW()
        `, [
          c.creative || 'N/A', c.purchases || 0, c.revenue_usd || 0,
          c.revenue_brl || 0, c.ics || 0, c.clicks || 0,
          c.conversion_rate || 0, c.ic_to_purchase_rate || 0,
          JSON.stringify(c.campaigns || []), JSON.stringify(c.products || []),
          JSON.stringify(c.countries || []),
        ]);
        count++;
      }
      console.log(`  [ok] creatives: ${count} registros`);
    }

    // ── purchases ──
    const purchases = data.purchases || [];
    if (purchases.length > 0) {
      let count = 0;
      for (const p of purchases) {
        if (!p || typeof p !== 'object') continue;
        const purchasedAt = p.date ? p.date.substring(0, 19).replace('T', ' ') : null;
        await client.query(`
          INSERT INTO purchases
            (purchase_id, lead_id, creative, campaign, product, currency,
             value_usd, value_brl, value_gbp, value_eur, value_cad,
             sub4, sub5, sub7, country, country_code, device_type,
             device_model, browser, landing, offer_name, traffic_channel, purchased_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
          ON CONFLICT (purchase_id) DO UPDATE SET
            creative = EXCLUDED.creative, value_usd = EXCLUDED.value_usd,
            value_brl = EXCLUDED.value_brl
        `, [
          p.purchase_id, p.lead_id, p.creative || 'N/A', p.campaign, p.product,
          p.currency, p.value_usd || 0, p.value_brl || 0, p.value_gbp || 0,
          p.value_eur || 0, p.value_cad || 0, p.sub4, p.sub5, p.sub7,
          p.country, p.country_code, p.device_type, p.device_model,
          p.browser, p.landing, p.offer_name, p.traffic_channel, purchasedAt,
        ]);
        count++;
      }
      console.log(`  [ok] purchases: ${count} registros`);
    }

    // ── daily_metrics ──
    const daily = data.daily || [];
    if (daily.length > 0) {
      let count = 0;
      for (const d of daily) {
        if (!d || typeof d !== 'object') continue;
        await client.query(`
          INSERT INTO daily_metrics
            (date, clicks, ics, purchases, revenue_usd, revenue_brl,
             unique_creatives, conversion_rate)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (date) DO UPDATE SET
            clicks = EXCLUDED.clicks, purchases = EXCLUDED.purchases,
            revenue_usd = EXCLUDED.revenue_usd, revenue_brl = EXCLUDED.revenue_brl
        `, [
          d.date, d.clicks || 0, 0, d.purchases || 0,
          d.revenue_usd || 0, d.revenue_brl || 0,
          d.unique_creatives || 0, 0,
        ]);
        count++;
      }
      console.log(`  [ok] daily_metrics: ${count} registros`);
    }

    // ── campaigns ──
    const campaigns = data.campaigns || [];
    if (campaigns.length > 0) {
      let count = 0;
      for (const c of campaigns) {
        if (!c || typeof c !== 'object' || !c.id) continue;
        await client.query(`
          INSERT INTO campaigns
            (campaign_id, name, domain, traffic_channel, clicks, landing_clicks,
             total_spent, total_revenue, total_purchase, purchase_leads,
             roas, roi, cpa, cpl, cpc, gross_profit, avg_ticket,
             funnel_conversion, bounce_rate)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          ON CONFLICT (campaign_id) DO UPDATE SET
            name = EXCLUDED.name, total_spent = EXCLUDED.total_spent,
            total_revenue = EXCLUDED.total_revenue
        `, [
          c.id, c.name, c.domain, c.traffic_channel, c.clicks || 0,
          c.landing_clicks || 0, c.total_spent || 0, c.total_revenue || 0,
          c.total_purchase || 0, c.purchase_leads || 0, c.roas || 0,
          c.roi || 0, c.cpa || 0, c.cpl || 0, c.cpc || 0,
          c.gross_profit || 0, c.avg_ticket || 0, c.funnel_conversion || 0,
          c.bounce_rate || 0,
        ]);
        count++;
      }
      console.log(`  [ok] campaigns: ${count} registros`);
    }

    // ── offers ──
    const offers = data.offers || [];
    if (offers.length > 0) {
      let count = 0;
      for (const o of offers) {
        if (!o || typeof o !== 'object' || !o.id) continue;
        await client.query(`
          INSERT INTO offers
            (offer_id, name, checkout, product, clicks, landing_clicks,
             total_spent, total_revenue, total_purchase, roas, roi, cpa, cpc,
             gross_profit, avg_ticket, funnel_conversion, epc,
             purchase_count_api, purchase_value_api)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          ON CONFLICT (offer_id) DO UPDATE SET
            total_spent = EXCLUDED.total_spent, total_revenue = EXCLUDED.total_revenue
        `, [
          o.id, o.name, o.checkout, o.product, o.clicks || 0,
          o.landing_clicks || 0, o.total_spent || 0, o.total_revenue || 0,
          o.total_purchase || 0, o.roas || 0, o.roi || 0, o.cpa || 0,
          o.cpc || 0, o.gross_profit || 0, o.avg_ticket || 0,
          o.funnel_conversion || 0, o.epc || 0, o.purchase_count_api || 0,
          o.purchase_value_api || 0,
        ]);
        count++;
      }
      console.log(`  [ok] offers: ${count} registros`);
    }

    // ── country_stats ──
    const countries = data.countries || [];
    if (countries.length > 0) {
      let count = 0;
      for (const c of countries) {
        if (!c || typeof c !== 'object') continue;
        await client.query(`
          INSERT INTO country_stats (country, purchases, revenue_usd, clicks, ics, conversion_rate)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (country) DO UPDATE SET
            purchases = EXCLUDED.purchases, revenue_usd = EXCLUDED.revenue_usd
        `, [
          c.country, c.purchases || 0, c.revenue_usd || 0,
          c.clicks || 0, c.ics || 0, c.cvr || 0,
        ]);
        count++;
      }
      console.log(`  [ok] country_stats: ${count} registros`);
    }

    // ── device_stats ──
    const devices = data.devices || [];
    if (devices.length > 0) {
      let count = 0;
      for (const d of devices) {
        if (!d || typeof d !== 'object') continue;
        await client.query(`
          INSERT INTO device_stats (device, purchases, revenue_usd, clicks)
          VALUES ($1,$2,$3,$4)
          ON CONFLICT (device) DO UPDATE SET
            purchases = EXCLUDED.purchases, revenue_usd = EXCLUDED.revenue_usd
        `, [
          d.device, d.purchases || 0, d.revenue_usd || 0, d.clicks || 0,
        ]);
        count++;
      }
      console.log(`  [ok] device_stats: ${count} registros`);
    }

    // Update sync log
    await client.query(`
      UPDATE sync_log SET
        finished_at = NOW(), status = 'success',
        total_leads = $1, total_purchases = $2, total_ics = $3
      WHERE id = $4
    `, [
      overview.total_clicks || 0, overview.total_purchases || 0,
      overview.initiate_checkouts || 0, syncId,
    ]);

    await client.query('COMMIT');
    console.log(`\n[+] Sincronização concluída com sucesso!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n[!] Erro: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
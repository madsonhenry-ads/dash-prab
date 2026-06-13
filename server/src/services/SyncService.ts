/**
 * SyncService — busca dados do EasyTracker via REST API
 * e salva no PostgreSQL para fallback offline.
 *
 * Usa o EasyTrackerProxy para chamar a API real, depois
 * insere/atualiza as tabelas do PostgreSQL.
 */
import { postgresService } from './PostgresService';
import * as proxy from './EasyTrackerProxy';
import { cacheService } from './CacheService';

interface SyncResult {
  success: boolean;
  creatives: number;
  campaigns: number;
  offers: number;
  channels: number;
  errors: string[];
  duration: number;
}

// ── Date ranges to sync (so offline fallback has data) ──
const SYNC_PERIODS: { key: string; daysBack: number }[] = [
  { key: 'today', daysBack: 0 },
  { key: 'yesterday', daysBack: 1 },
  { key: 'last_7', daysBack: 6 },
  { key: 'last_30', daysBack: 29 },
];

function getDateRange(daysBack: number): { beginDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  const start = new Date(now.getTime() - daysBack * 86400000).toISOString().split('T')[0];
  return { beginDate: start, endDate: end };
}

export async function syncAll(): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    success: true,
    creatives: 0,
    campaigns: 0,
    offers: 0,
    channels: 0,
    errors: [],
    duration: 0,
  };

  if (!postgresService.isConnected()) {
    result.success = false;
    result.errors.push('PostgreSQL not connected');
    result.duration = Date.now() - startTime;
    return result;
  }

  // Sync for all periods so cache + offline have full coverage
  for (const period of SYNC_PERIODS) {
    const { beginDate, endDate } = getDateRange(period.daysBack);

    try {
      const count = await syncCreatives(beginDate, endDate);
      result.creatives += count;
    } catch (err: any) {
      result.errors.push(`creatives (${period.key}): ${err.message}`);
    }

    try {
      const count = await syncCampaigns(beginDate, endDate);
      result.campaigns += count;
    } catch (err: any) {
      result.errors.push(`campaigns (${period.key}): ${err.message}`);
    }
  }

  // Sync global data (no date filter)
  try {
    result.offers = await syncOffers();
  } catch (err: any) {
    result.errors.push(`offers: ${err.message}`);
  }

  try {
    result.channels = await syncChannels();
  } catch (err: any) {
    result.errors.push(`channels: ${err.message}`);
  }

  // Also populate the in-memory cache with fresh proxy data
  await populateCache();

  result.duration = Date.now() - startTime;
  result.success = result.errors.length === 0;
  return result;
}

// ── Creatives sync ──

async function syncCreatives(beginDate: string, endDate: string): Promise<number> {
  const { rows } = await proxy.getCreatives(beginDate, endDate, { pageSize: 10000 });
  if (!rows.length) return 0;

  let count = 0;
  for (const c of rows) {
    try {
      await postgresService.query(
        `INSERT INTO creatives
          (creative, purchases, revenue_usd, revenue_brl, spend_usd, profit_usd, roas, cpa,
           ics, clicks, conversion_rate, ic_to_purchase_rate, hook_rate, lead_to_purchase_cvr,
           landing_clicks, landing_views, campaigns, products, countries, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
         ON CONFLICT (creative) DO UPDATE SET
           purchases = EXCLUDED.purchases,
           revenue_usd = EXCLUDED.revenue_usd,
           revenue_brl = EXCLUDED.revenue_brl,
           spend_usd = EXCLUDED.spend_usd,
           profit_usd = EXCLUDED.profit_usd,
           roas = EXCLUDED.roas,
           cpa = EXCLUDED.cpa,
           ics = EXCLUDED.ics,
           clicks = EXCLUDED.clicks,
           conversion_rate = EXCLUDED.conversion_rate,
           ic_to_purchase_rate = EXCLUDED.ic_to_purchase_rate,
           hook_rate = EXCLUDED.hook_rate,
           lead_to_purchase_cvr = EXCLUDED.lead_to_purchase_cvr,
           landing_clicks = EXCLUDED.landing_clicks,
           landing_views = EXCLUDED.landing_views,
           campaigns = EXCLUDED.campaigns,
           products = EXCLUDED.products,
           countries = EXCLUDED.countries,
           updated_at = NOW()`,
        [
          c.name,
          c.sales || 0,
          c.revenue || 0,
          0, // revenue_brl
          c.spend || 0,
          c.profit || 0,
          c.roas || 0,
          c.cpa || 0,
          c.sales || 0, // ics reuse — we don't have separate IC count per creative
          c.clicks || 0,
          c.ctr || 0,
          c.holdRate || 0,
          c.hookRate || 0,
          c.holdRate || 0,
          c.landing_clicks || 0,
          c.landing_views || 0,
          c.campaignName ? [c.campaignName] : [],
          [],
          [],
        ]
      );
      count++;
    } catch (err: any) {
      console.warn(`[Sync] Skipping creative "${c.name}": ${err.message}`);
    }
  }
  console.log(`[Sync] Synced ${count} creatives for ${beginDate}..${endDate}`);
  return count;
}

// ── Campaigns sync ──

async function syncCampaigns(beginDate: string, endDate: string): Promise<number> {
  const { rows } = await proxy.getCampaigns(beginDate, endDate, { pageSize: 10000 });
  if (!rows.length) return 0;

  let count = 0;
  for (const c of rows) {
    try {
      await postgresService.query(
        `INSERT INTO campaigns
          (campaign_id, name, total_spent, total_revenue, total_purchase, roas, clicks, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (campaign_id) DO UPDATE SET
           name = EXCLUDED.name,
           total_spent = EXCLUDED.total_spent,
           total_revenue = EXCLUDED.total_revenue,
           total_purchase = EXCLUDED.total_purchase,
           roas = EXCLUDED.roas,
           clicks = EXCLUDED.clicks,
           synced_at = NOW()`,
        [
          parseInt(c.id, 10) || 0,
          c.name || '',
          c.spend || 0,
          c.revenue || 0,
          c.sales || 0,
          c.roas || 0,
          c.clicks || 0,
        ]
      );
      count++;
    } catch (err: any) {
      console.warn(`[Sync] Skipping campaign "${c.name}": ${err.message}`);
    }
  }
  console.log(`[Sync] Synced ${count} campaigns for ${beginDate}..${endDate}`);
  return count;
}

// ── Offers sync ──

async function syncOffers(): Promise<number> {
  const offers = await proxy.getProducts('2024-01-01', new Date().toISOString().split('T')[0]);
  if (!offers.length) return 0;

  let count = 0;
  for (const o of offers) {
    try {
      const offerId = parseInt(o.id, 10);
      if (!offerId) continue;
      await postgresService.query(
        `INSERT INTO offers (offer_id, name, avg_ticket, synced_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (offer_id) DO UPDATE SET
           name = EXCLUDED.name,
           avg_ticket = EXCLUDED.avg_ticket,
           synced_at = NOW()`,
        [offerId, o.name, o.price]
      );
      count++;
    } catch {}
  }
  console.log(`[Sync] Synced ${count} offers`);
  return count;
}

// ── Traffic channels sync ──

async function syncChannels(): Promise<number> {
  const channels = await proxy.getTrafficChannels();
  if (!channels.length) return 0;
  console.log(`[Sync] Synced ${channels.length} traffic channels`);
  return channels.length;
}

// ── Populate in-memory cache with fresh proxy data ──

async function populateCache(): Promise<void> {
  try {
    const now = new Date().toISOString().split('T')[0];
    const last7 = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

    // Cache KPIs for last_7
    const kpis = await proxy.getKpis(last7, now);
    if (kpis) cacheService.set('kpis', kpis, 'last_7:all');

    // Cache funnel
    const funnel = await proxy.getFunnel(last7, now);
    if (funnel) cacheService.set('funnel', funnel, 'last_7:all');

    // Cache creatives
    const { rows, total } = await proxy.getCreatives(last7, now, { pageSize: 500 });
    if (rows.length) cacheService.set('creatives', { rows, total }, 'last_7');

    console.log(`[Sync] Populated in-memory cache for last_7`);
  } catch (err: any) {
    console.warn(`[Sync] Cache population skipped: ${err.message}`);
  }
}

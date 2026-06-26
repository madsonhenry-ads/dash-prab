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
  // 1. Get merged data (ads-manager primary + reports enrichment)
  const { rows: merged } = await proxy.getCreatives(beginDate, endDate, { pageSize: 10000 });
  if (!merged.length) return 0;

  let count = 0;
  for (const c of merged) {
    try {
      const clicks = c.clicks || 0;
      const landingClicks = c.landing_clicks || 0;
      const sales = c.sales || 0;
      const spend = c.spend || 0;
      const revenue = c.revenue || 0;
      const impressions = c.impressions || 0;

      await postgresService.query(
        `INSERT INTO creatives
          (creative, purchases, revenue_usd, revenue_brl, spend_usd, profit_usd, roas, cpa,
           ics, clicks, conversion_rate, ic_to_purchase_rate, hook_rate, lead_to_purchase_cvr,
           landing_clicks, landing_views, campaigns, products, countries, updated_at,
           status, impressions, reach, frequency, clicks_all, cpc_all, cpm, cpc,
           avg_ticket, bounce_rate, video_plays, video_views, video_25, video_50, video_75, video_100,
           avg_watch_time, pixel_purchase, play_rate, body_rate, completion_rate,
           landing_rate, checkout_rate, cost_per_checkout, first_seen)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(),
                 $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35,
                 $36, $37, $38, $39, $40, $41, $42, $43, NOW())
         ON CONFLICT (creative) DO UPDATE SET
           purchases = EXCLUDED.purchases,
           revenue_usd = EXCLUDED.revenue_usd,
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
           updated_at = NOW(),
           status = EXCLUDED.status,
           impressions = EXCLUDED.impressions,
           reach = EXCLUDED.reach,
           frequency = EXCLUDED.frequency,
           clicks_all = EXCLUDED.clicks_all,
           cpc_all = EXCLUDED.cpc_all,
           cpm = EXCLUDED.cpm,
           cpc = EXCLUDED.cpc,
           avg_ticket = EXCLUDED.avg_ticket,
           bounce_rate = EXCLUDED.bounce_rate,
           video_plays = EXCLUDED.video_plays,
           video_views = EXCLUDED.video_views,
           video_25 = EXCLUDED.video_25,
           video_50 = EXCLUDED.video_50,
           video_75 = EXCLUDED.video_75,
           video_100 = EXCLUDED.video_100,
           avg_watch_time = EXCLUDED.avg_watch_time,
           pixel_purchase = EXCLUDED.pixel_purchase,
           play_rate = EXCLUDED.play_rate,
           body_rate = EXCLUDED.body_rate,
           completion_rate = EXCLUDED.completion_rate,
           landing_rate = EXCLUDED.landing_rate,
           checkout_rate = EXCLUDED.checkout_rate,
           cost_per_checkout = EXCLUDED.cost_per_checkout`,
        [
          c.name,
          sales,
          revenue,
          0, // revenue_brl
          spend,
          revenue - spend, // profit
          spend > 0 ? revenue / spend : 0, // roas
          sales > 0 ? spend / sales : 0, // cpa
          landingClicks, // ics
          clicks,
          clicks > 0 ? (sales / clicks) : 0, // conversion_rate
          landingClicks > 0 ? sales / landingClicks : 0, // ic_to_purchase_rate
          c.hookRate || 0,
          landingClicks > 0 ? sales / landingClicks : 0, // lead_to_purchase_cvr
          landingClicks,
          c.landing_views || 0,
          c.campaignName ? [c.campaignName] : [],
          [],
          [],
          // ads-manager fields
          c.status || 'no_data',
          impressions,
          c.reach || 0,
          c.frequency || 0,
          c.clicks_all || clicks,
          c.cpc_all || 0,
          c.cpm || 0,
          clicks > 0 ? spend / clicks : 0, // cpc
          c.avg_ticket || 0,
          c.bounce_rate || 0,
          c.video_plays || 0,
          c.video_views || 0,
          c.video_25 || 0,
          c.video_50 || 0,
          c.video_75 || 0,
          c.video_100 || 0,
          c.avg_watch_time || 0,
          c.pixel_purchase || 0,
          c.play_rate || 0,
          c.body_rate || 0,
          c.completion_rate || 0,
          impressions > 0 ? ((c.landing_views || 0) / impressions) * 100 : 0, // landing_rate
          clicks > 0 ? (landingClicks / clicks) * 100 : 0, // checkout_rate
          landingClicks > 0 ? spend / landingClicks : 0, // cost_per_checkout
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

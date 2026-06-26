/**
 * EasyTrackerProxy — live proxy to EasyTracker REST API.
 *
 * Receives beginDate/endDate from the frontend period selector,
 * calls the actual EasyTracker API with those dates, formats responses
 * to match the frontend types.
 *
 * Token: EASYTRACKER_ACCESS_TOKEN env var (JWT from .et_token)
 */
import { cacheService } from './CacheService';
import type { FunnelStep } from '../types';

const BASE = 'https://api.easytracker.digital/api';
const DASHBOARD_UUID = '5d266636-7c23-4add-ae7b-6aeadcfee1cb';

interface TokenStore {
  accessToken: string;
}
let tokenStore: TokenStore | null = null;

// ── Helpers ──

function safeStr(v: any, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

function getHeaders(): Record<string, string> {
  const token = process.env.EASYTRACKER_ACCESS_TOKEN || tokenStore?.accessToken;
  if (!token) throw new Error('EasyTracker token not configured. Set EASYTRACKER_ACCESS_TOKEN env var.');
  return {
    Authorization: `Bearer ${token}`,
    'x-app-id': '111127',
    Origin: 'https://app.easytracker.digital',
    Accept: 'application/json',
    'User-Agent': 'TrafficBoard/1.0',
  };
}

/**
 * Convert frontend period to beginDate/endDate strings.
 * Supports timezone param (default: UTC). Use 'Europe/London' for London time.
 */
export function periodToDates(period: string, timezone?: string): { beginDate: string; endDate: string } {
  const tz = timezone || 'UTC';
  const now = new Date();

  // If timezone is specified, convert to that timezone's current date
  let nowTz: Date;
  if (tz === 'UTC') {
    nowTz = now;
  } else {
    // Get date string in the target timezone, then parse back to a Date
    const tzDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    nowTz = new Date(tzDateStr + 'T00:00:00Z');
  }

  const endDate = nowTz.toISOString().split('T')[0];

  let beginDate: string;
  switch (period) {
    case 'today':
      beginDate = endDate;
      break;
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      beginDate = y.toISOString().split('T')[0];
      break;
    }
    case 'last_7': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      beginDate = d.toISOString().split('T')[0];
      break;
    }
    case 'last_30': {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      beginDate = d.toISOString().split('T')[0];
      break;
    }
    case 'this_month': {
      beginDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      break;
    }
    default:
      beginDate = endDate;
  }
  return { beginDate, endDate };
}

async function apiGet(path: string, params: string = ''): Promise<any> {
  const url = `${BASE}/${path}${params ? '?' + params : ''}`;
  const resp = await fetch(url, { headers: getHeaders() });
  if (!resp.ok) {
    throw new Error(`EasyTracker API error (${resp.status}): ${resp.statusText} for ${path}`);
  }
  return resp.json();
}

// ── Dashboard KPIs ──

function dashboardParams(beginDate: string, endDate: string, channels?: string): string {
  let params = `dashboardId=${DASHBOARD_UUID}&beginDate=${beginDate}&endDate=${endDate}`;
  if (channels) {
    const ids = channels.split(',').filter(Boolean);
    ids.forEach((id: string) => { params += `&traffic_channel_ids[]=${id}`; });
  }
  return params;
}

export async function getKpis(beginDate: string, endDate: string, channels?: string): Promise<any> {
  const cacheKey = `proxy_kpis_${beginDate}_${endDate}_${channels || ''}`;
  const cached = cacheService.get<any>(cacheKey as any);
  if (cached) return cached;

  const result = await apiGet(`dashboards/${DASHBOARD_UUID}`, dashboardParams(beginDate, endDate, channels));
  const data = result?.data;
  if (!data) throw new Error('Empty dashboard response');

  const summary: Record<string, number> = {};
  (data.summary || []).forEach((s: any) => { summary[s.key] = parseFloat(s.value) || 0; });

  const kpis = {
    adSpend: summary.total_spent || 0,
    profit: summary.gross_profit || 0,
    roas: summary.roas || 0,
    netRevenue: summary.total_revenue || 0,
    cpa: summary.cpa || 0,
    margin: summary.total_revenue ? ((summary.gross_profit / summary.total_revenue) * 100) : 0,
    roi: summary.roi || 0,
    arpu: summary.avg_ticket || 0,
    approvedSales: data.funnel?.purchases || 0,
    grossRevenue: summary.total_revenue || 0,
  };

  return kpis;
}

// ── Funnel ──

export async function getFunnel(beginDate: string, endDate: string, channels?: string): Promise<FunnelStep[]> {
  const cacheKey = `proxy_funnel_${beginDate}_${endDate}_${channels || ''}`;
  const cached = cacheService.get<any>(cacheKey as any);
  if (cached) return cached;

  const result = await apiGet(`dashboards/${DASHBOARD_UUID}`, dashboardParams(beginDate, endDate, channels));
  const funnel = result?.data?.funnel;
  if (!funnel) throw new Error('Empty funnel data');

  const steps: FunnelStep[] = [
    { label: 'Clicks', value: parseInt(funnel.clicks || 0, 10) },
    { label: 'Page Views', value: parseInt(funnel.landing_views || 0, 10) },
  ];
  if (funnel.offers > 0) {
    const clicks = parseInt(funnel.clicks || 0, 10);
    const offers = parseInt(funnel.offers || 0, 10);
    steps.push({
      label: 'Initiate Checkout',
      value: offers,
      percentage: clicks > 0 ? Math.round((offers / clicks) * 1000) / 10 : 0,
    });
  }
  const purchases = parseInt(funnel.purchases || 0, 10);
  const offers = parseInt(funnel.offers || 0, 10);
  const canceled = offers > purchases ? offers - purchases : 0;
  if (canceled > 0) {
    steps.push({
      label: 'Attempts (Canceled)',
      value: canceled,
      percentage: offers > 0 ? Math.round((canceled / offers) * 1000) / 10 : 0,
    });
  }
  steps.push({
    label: 'Completed (Purchase)',
    value: purchases,
    percentage: offers > 0 ? Math.round((purchases / offers) * 1000) / 10 : 0,
  });

  return steps;
}

// ── Creatives ──

export async function getCreatives(beginDate: string, endDate: string, params?: {
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
  campaignId?: string;
  channels?: string;
}): Promise<{ rows: any[]; total: number }> {
  const { search = '', sortBy = 'purchases', sortOrder = 'desc', page = 1, pageSize = 50, campaignId = '', channels = '' } = params || {};

  // STEP 1: Get campaigns for the report
  const campaignsResult = await apiGet('campaigns', `beginDate=${beginDate}&endDate=${endDate}`);
  const campaigns = campaignsResult?.data || [];

  const channelIds = channels ? channels.split(',').filter(Boolean).map(Number) : [];
  const filteredCampaigns = channelIds.length > 0
    ? campaigns.filter((c: any) => {
        const tc = c.traffic_channel_id;
        const tcId = tc?.value ?? tc;
        return channelIds.includes(Number(tcId));
      })
    : campaigns;

  // STEP 2: Fetch report per campaign, aggregate by sub6 (creative name)
  // This gives us: revenue, purchases, clicks, landing_views, landing_clicks, spend
  const reportsBySub6: Record<string, any> = {};

  for (const camp of filteredCampaigns) {
    const campId = camp.id;
    if (!campId) continue;
    if (campaignId && String(campId) !== campaignId) continue;

    try {
      const report = await apiGet(`reports/campaigns/${campId}`, `groupings[]=sub6&beginDate=${beginDate}&endDate=${endDate}`);
      const items = report?.data || [];
      for (const item of items) {
        const sub6 = (item.sub6 || '').trim();
        if (!sub6) continue;
        if (!reportsBySub6[sub6]) {
          reportsBySub6[sub6] = {
            spend: 0, revenue: 0, profit: 0, sales: 0,
            clicks: 0, landing_views: 0, landing_clicks: 0,
            bounce_rate: 0, avg_ticket: 0, hookRate: 0, holdRate: 0,
            campaignName: safeStr(camp.name) || '',
            campaignId: String(campId),
          };
        }
        const r = reportsBySub6[sub6];
        r.spend += parseFloat(item.total_spent || 0);
        r.revenue += parseFloat(item.total_revenue || 0);
        r.profit += parseFloat(item.gross_profit || 0);
        r.sales += parseInt(item.custom_purchase_count || 0, 10);
        r.clicks += parseInt(item.clicks || 0, 10);
        r.landing_views += parseInt(item.landing_views || 0, 10);
        r.landing_clicks += parseInt(item.landing_clicks || 0, 10);
        r.bounce_rate = parseFloat(item.bounce_rate || 0);
        r.avg_ticket = parseFloat(item.avg_ticket || 0);
        r.hookRate = parseFloat(item.hook_rate ?? item.video_watch_rate ?? 0);
        r.holdRate = parseFloat(item.hold_rate ?? item.lead_to_purchase_conversion ?? 0);
      }
    } catch (err: any) {
      console.warn(`[Proxy] Skipping campaign ${campId}: ${err.message}`);
    }
  }

  // STEP 3: Get ads-manager data (Facebook rich metrics) — for enrichment
  const adsManagerRows = await getAdsManagerAds(beginDate, endDate);

  // Build ads-by-name lookup
  const adsByName: Record<string, any> = {};
  for (const ad of adsManagerRows) {
    const key = ad.name.toLowerCase().trim();
    adsByName[key] = ad;
  }

  // STEP 4: Iterate over REPORTS as primary source, enrich with ads-manager where matched
  const mergedRows: any[] = [];
  const usedAdsNames = new Set<string>();

  for (const [sub6, report] of Object.entries(reportsBySub6) as [string, any]) {
    const nameLower = sub6.toLowerCase().trim();
    const ad = adsByName[nameLower];
    usedAdsNames.add(nameLower);

    const spend = report.spend || 0;
    const revenue = report.revenue || 0;
    const clicks = report.clicks || 0;
    const landingClicks = report.landing_clicks || 0;
    const sales = report.sales || 0;

    mergedRows.push({
      id: ad?.id || sub6,
      name: sub6,
      campaignName: report.campaignName || '',
      campaignId: report.campaignId || '',
      adSetId: '',
      status: ad?.status || (sales > 0 ? 'active' : (clicks > 0 ? 'paused' : 'no_data')),
      startDate: ad?.start_date || beginDate,
      spend,
      revenue,
      profit: revenue - spend,
      roas: spend > 0 ? revenue / spend : 0,
      cpa: sales > 0 ? spend / sales : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      ctr: ad?.ctr || report.holdRate || 0,
      hookRate: ad?.hook_rate || report.hookRate || 0,
      holdRate: report.holdRate || 0,
      sales,
      addToCart: 0,
      impressions: ad?.impressions || 0,
      clicks,
      bounce_rate: report.bounce_rate || 0,
      landing_views: report.landing_views || 0,
      landing_clicks: landingClicks,
      avg_ticket: report.avg_ticket || (sales > 0 ? revenue / sales : 0),
      cic: landingClicks > 0 ? spend / landingClicks : 0,
      // Ads-manager fields (enriched where match exists)
      reach: ad?.reach || 0,
      frequency: ad?.frequency || 0,
      clicks_all: ad?.clicks_all || 0,
      cpc_all: ad?.cpc_all || 0,
      cpm: ad?.cpm || 0,
      video_plays: ad?.video_plays || 0,
      video_views: ad?.video_views || 0,
      video_25: ad?.video_25 || 0,
      video_50: ad?.video_50 || 0,
      video_75: ad?.video_75 || 0,
      video_100: ad?.video_100 || 0,
      avg_watch_time: ad?.avg_watch_time || 0,
      pixel_purchase: ad?.pixel_purchase || 0,
      play_rate: ad?.play_rate || 0,
      body_rate: ad?.body_rate || 0,
      completion_rate: ad?.completion_rate || 0,
      landing_rate: (ad?.impressions || 0) > 0 ? ((report.landing_views || 0) / (ad.impressions || 0)) * 100 : 0,
      checkout_rate: clicks > 0 ? (landingClicks / clicks) * 100 : 0,
      cost_per_checkout: landingClicks > 0 ? spend / landingClicks : 0,
      last_updated: ad?.updated_time || '',
      source: ad ? 'merged' : 'reports',
    });
  }

  // STEP 5: Add ads-manager-only items (ads that exist in Facebook but have no matching sub6 in reports)
  for (const ad of adsManagerRows) {
    const nameLower = ad.name.toLowerCase().trim();
    if (usedAdsNames.has(nameLower)) continue;
    const spend = ad.spend || 0;
    const clicks = ad.clicks_all || 0;

    mergedRows.push({
      id: ad.id,
      name: ad.name,
      campaignName: '',
      campaignId: '',
      adSetId: '',
      status: ad.status || 'no_data',
      startDate: ad.start_date || beginDate,
      spend,
      revenue: 0,
      profit: -spend,
      roas: 0,
      cpa: 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      ctr: ad.ctr || 0,
      hookRate: ad.hook_rate || 0,
      holdRate: 0,
      sales: 0,
      addToCart: 0,
      impressions: ad.impressions || 0,
      clicks,
      bounce_rate: 0,
      landing_views: 0,
      landing_clicks: 0,
      avg_ticket: 0,
      cic: 0,
      reach: ad.reach || 0,
      frequency: ad.frequency || 0,
      clicks_all: ad.clicks_all || 0,
      cpc_all: ad.cpc_all || 0,
      cpm: ad.cpm || 0,
      video_plays: ad.video_plays || 0,
      video_views: ad.video_views || 0,
      video_25: ad.video_25 || 0,
      video_50: ad.video_50 || 0,
      video_75: ad.video_75 || 0,
      video_100: ad.video_100 || 0,
      avg_watch_time: ad.avg_watch_time || 0,
      pixel_purchase: ad.pixel_purchase || 0,
      play_rate: ad.play_rate || 0,
      body_rate: ad.body_rate || 0,
      completion_rate: ad.completion_rate || 0,
      landing_rate: 0,
      checkout_rate: 0,
      cost_per_checkout: 0,
      last_updated: ad.updated_time || '',
      source: 'ads-manager',
    });
  }

  let result = mergedRows;

  // Filter
  if (search) {
    const term = search.toLowerCase();
    result = result.filter((c: any) => c.name.toLowerCase().includes(term));
  }

  // Sort
  const sortField = sortBy || 'sales';
  result.sort((a: any, b: any) => {
    const va = a[sortField] ?? 0;
    const vb = b[sortField] ?? 0;
    return sortOrder === 'asc' ? va - vb : vb - va;
  });

  const total = result.length;
  const start = (page - 1) * pageSize;
  const rows = result.slice(start, start + pageSize);

  return { rows, total };
}

// ── Ads Manager (Facebook rich metrics) ──

export async function getAdsManagerAds(beginDate: string, endDate: string): Promise<any[]> {
  try {
    const result = await apiGet('ads-manager/ads', `provider=facebook&beginDate=${beginDate}&endDate=${endDate}&skipTimezone=1`);
    const ads = result?.data || [];

    return ads.map((ad: any) => {
      const impressions = parseInt(ad.impressions || 0, 10);
      const clicks = parseInt(ad.clicks || 0, 10);
      const spend = parseFloat(ad.spend || 0);
      const videoViews = ad.video_play_actions?.video_view
        ? parseInt(ad.video_play_actions.video_view, 10)
        : (typeof ad.actions?.video_view === 'number'
            ? ad.actions.video_view
            : parseInt(ad.actions?.video_view || 0, 10));
      const videoPlays = typeof ad.actions?.video_view === 'number'
        ? ad.actions.video_view
        : parseInt(ad.actions?.video_view || 0, 10);
      const p25 = ad.video_p25_watched_actions?.video_view
        ? parseInt(ad.video_p25_watched_actions.video_view, 10) : 0;
      const p50 = ad.video_p50_watched_actions?.video_view
        ? parseInt(ad.video_p50_watched_actions.video_view, 10) : 0;
      const p75 = ad.video_p75_watched_actions?.video_view
        ? parseInt(ad.video_p75_watched_actions.video_view, 10) : 0;
      const p100 = ad.video_p100_watched_actions?.video_view
        ? parseInt(ad.video_p100_watched_actions.video_view, 10) : 0;

      return {
        id: String(ad.id || ''),
        name: safeStr(ad.name) || '',
        status: (ad.status || 'UNKNOWN').toLowerCase(),
        spend,
        impressions,
        reach: parseInt(ad.reach || 0, 10),
        frequency: parseFloat(ad.frequency || 0),
        clicks_all: clicks,
        ctr: parseFloat(ad.ctr || 0),
        cpc_all: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        video_plays: videoPlays,
        video_views: videoViews,
        video_25: p25,
        video_50: p50,
        video_75: p75,
        video_100: p100,
        avg_watch_time: parseFloat(ad.avg_watch_time || 0),
        pixel_purchase: typeof ad.actions?.pixel_purchase === 'number'
          ? ad.actions.pixel_purchase
          : parseInt(ad.actions?.pixel_purchase || 0, 10),
        start_date: ad.start_time || '',
        updated_time: ad.updated_time || '',
        // Derived metrics
        play_rate: impressions > 0 ? (videoViews / impressions) * 100 : 0,
        hook_rate: videoViews > 0 ? (p25 / videoViews) * 100 : 0,
        body_rate: videoViews > 0 ? (p50 / videoViews) * 100 : 0,
        completion_rate: videoViews > 0 ? (p100 / videoViews) * 100 : 0,
      };
    });
  } catch (err: any) {
    console.warn(`[Proxy] Ads-manager error: ${err.message}`);
    return [];
  }
}

// ── Ad Sets ──

export async function getAdSets(beginDate: string, endDate: string, params?: {
  search?: string;
  campaignId?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
  channels?: string;
}): Promise<{ rows: any[]; total: number }> {
  const { search = '', campaignId = '', sortBy = 'revenue', sortOrder = 'desc', page = 1, pageSize = 50, channels = '' } = params || {};

  // Get campaigns first
  const campaignsResult = await apiGet('campaigns', `beginDate=${beginDate}&endDate=${endDate}`);
  const campaigns = campaignsResult?.data || [];

  // Filter by channel and/or campaignId
  const channelIds = channels ? channels.split(',').filter(Boolean).map(Number) : [];
  let filteredCampaigns = campaigns;
  if (channelIds.length > 0) {
    filteredCampaigns = campaigns.filter((c: any) => {
      const tc = c.traffic_channel_id;
      const tcId = tc?.value ?? tc;
      return channelIds.includes(Number(tcId));
    });
  }
  if (campaignId) {
    filteredCampaigns = filteredCampaigns.filter((c: any) => String(c.id) === campaignId);
  }

  // Fetch report per campaign and aggregate by sub5 (ad set name)
  const adSetMap: Record<string, any> = {};

  for (const camp of filteredCampaigns) {
    const campId = camp.id;
    if (!campId) continue;
    try {
      const report = await apiGet(`reports/campaigns/${campId}`, `groupings[]=sub5&beginDate=${beginDate}&endDate=${endDate}`);
      const items = report?.data || [];
      for (const item of items) {
        const sub5 = (item.sub5 || '').trim();
        if (!sub5) continue;
        const key = `${campId}:${sub5}`;
        if (!adSetMap[key]) {
          adSetMap[key] = {
            id: key,
            name: sub5,
            campaignId: String(campId),
            campaignName: safeStr(camp.name) || '',
            status: parseFloat(item.total_spent || 0) > 0 ? 'ACTIVE' : 'PAUSED',
            spend: 0,
            revenue: 0,
            profit: 0,
            roas: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            sales: 0,
          };
        }
        const as = adSetMap[key];
        as.spend += parseFloat(item.total_spent || 0);
        as.revenue += parseFloat(item.total_revenue || 0);
        as.profit += parseFloat(item.gross_profit || 0);
        as.sales += parseInt(item.custom_purchase_count || 0, 10);
        as.clicks += parseInt(item.clicks || 0, 10);
        as.impressions += parseInt(item.clicks || 0, 10);
        as.roas = as.spend > 0 ? as.revenue / as.spend : 0;
        as.ctr = parseFloat(item.lead_to_purchase_conversion || 0);
        if (as.sales > 0) as.status = 'ACTIVE';
        else if (as.clicks > 0) as.status = 'PAUSED';
      }
    } catch (err: any) {
      console.warn(`[Proxy] Skipping campaign ${campId} for ad sets: ${err.message}`);
    }
  }

  let result = Object.values(adSetMap);

  // Filter by search
  if (search) {
    const term = search.toLowerCase();
    result = result.filter((a: any) => a.name.toLowerCase().includes(term));
  }

  // Sort
  result.sort((a: any, b: any) => {
    const va = a[sortBy] ?? 0;
    const vb = b[sortBy] ?? 0;
    return sortOrder === 'asc' ? va - vb : vb - va;
  });

  const total = result.length;
  const start = (page - 1) * pageSize;
  const rows = result.slice(start, start + pageSize);

  return { rows, total };
}

// ── Campaigns ──

export async function getCampaigns(beginDate: string, endDate: string, params?: {
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
  channels?: string;
}): Promise<{ rows: any[]; total: number }> {
  const { search = '', sortBy = 'total_revenue', sortOrder = 'desc', page = 1, pageSize = 50, channels = '' } = params || {};

  const dashboardResult = await apiGet(`dashboards/${DASHBOARD_UUID}`, dashboardParams(beginDate, endDate, channels));
  const campaigns = dashboardResult?.data?.campaignComparison || [];

  let result = campaigns.map((c: any) => ({
    id: String(c.id),
    name: safeStr(c.name) || '',
    status: parseFloat(c.total_spent || 0) > 0 ? 'ACTIVE' : 'PAUSED',
    budget: parseFloat(c.total_spent || 0),
    spend: parseFloat(c.total_spent || 0),
    impressions: parseInt(c.clicks || 0, 10),
    clicks: parseInt(c.clicks || 0, 10),
    revenue: parseFloat(c.total_revenue || 0),
    profit: parseFloat(c.gross_profit || 0),
    roas: parseFloat(c.roas || 0),
    cpa: parseFloat(c.cpa || 0),
    ctr: 0,
    sales: parseInt(c.total_purchase || 0, 10),
  }));

  if (search) {
    const term = search.toLowerCase();
    result = result.filter((c: any) => c.name.toLowerCase().includes(term));
  }

  result.sort((a: any, b: any) => {
    const va = a[sortBy] ?? 0;
    const vb = b[sortBy] ?? 0;
    return sortOrder === 'asc' ? va - vb : vb - va;
  });

  const total = result.length;
  const start = (page - 1) * pageSize;
  const rows = result.slice(start, start + pageSize);

  return { rows, total };
}

// ── Filters ──

export async function getProducts(beginDate: string, endDate: string): Promise<any[]> {
  const result = await apiGet('offers', `beginDate=${beginDate}&endDate=${endDate}`);
  const offers = result?.data || [];
  return offers.map((o: any) => ({
    id: String(o.id || o.offer_id),
    name: safeStr(o.name) || `Product ${o.id}`,
    price: parseFloat(o.avg_ticket || 0),
  }));
}

export async function getTrafficChannels(): Promise<any[]> {
  const result = await apiGet('traffic-channels');
  const channels = result?.data || [];
  return channels.map((t: any) => ({
    id: String(t.id || t.traffic_channel_id?.value || `tc_${t.name}`),
    name: safeStr(t.name) || 'Unknown',
    platform: safeStr(t.name) || '',
  }));
}

// ── Sales by Country ──

export async function getSalesByCountry(beginDate: string, endDate: string): Promise<any[]> {
  // From the dashboard endpoint we don't have country breakdown directly,
  // so we'll use a placeholder. Real country data comes from leads.
  const result = await apiGet(`dashboards/${DASHBOARD_UUID}`, `dashboardId=${DASHBOARD_UUID}&beginDate=${beginDate}&endDate=${endDate}`);
  const summary = result?.data?.summary || [];
  const totalRevenue = summary.find((s: any) => s.key === 'total_revenue')?.value || 0;
  const totalPurchases = result?.data?.funnel?.purchases || 0;

  // Return a simplified country view (we can enhance later)
  return [
    { country: 'All', sales: parseInt(totalPurchases, 10), revenue: parseFloat(totalRevenue), flag: '🌍' },
  ];
}

// ── Sales by Day ──

export async function getSalesByDay(_beginDate: string, _endDate: string): Promise<any[]> {
  // Not available from dashboard endpoint directly
  return [];
}

// ── Sales by Hour ──

export async function getSalesByHour(_beginDate: string, _endDate: string): Promise<any[]> {
  // Not available from dashboard endpoint directly
  return [];
}

// ── Sales by Payment ──

export async function getSalesByPayment(_beginDate: string, _endDate: string): Promise<any[]> {
  // Not available from dashboard endpoint directly
  return [];
}

// ── Top Campaigns (from dashboard campaignComparison) ──

export async function getTopCampaigns(beginDate: string, endDate: string, channels?: string): Promise<any[]> {
  const result = await apiGet(`dashboards/${DASHBOARD_UUID}`, dashboardParams(beginDate, endDate, channels));
  const campaigns = result?.data?.campaignComparison || [];
  return campaigns
    .map((c: any) => ({
      name: safeStr(c.name) || '',
      spend: parseFloat(c.total_spent || 0),
      revenue: parseFloat(c.total_revenue || 0),
      roas: parseFloat(c.roas || 0),
    }))
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 10);
}

// ── Sales by Traffic Channel ──

export async function getSalesByChannel(beginDate: string, endDate: string, channels?: string): Promise<any[]> {
  const result = await apiGet(`dashboards/${DASHBOARD_UUID}`, dashboardParams(beginDate, endDate, channels));
  const campaignsResult = await apiGet('campaigns', `beginDate=${beginDate}&endDate=${endDate}`);
  const campaigns = result?.data?.campaignComparison || [];
  const allCampaigns = campaignsResult?.data || [];

  // Build a channel map from campaign data
  const channelMap: Record<string, any> = {};

  for (const camp of allCampaigns) {
    const tcId = camp.traffic_channel_id?.value ?? camp.traffic_channel_id;
    const tcName = camp.traffic_channel_label || camp.traffic_channel;
    if (!tcName && !tcId) continue;

    const key = String(tcId || tcName);
    if (!channelMap[key]) {
      channelMap[key] = {
        id: key,
        name: safeStr(tcName) || `Channel ${key}`,
        spend: 0,
        revenue: 0,
        profit: 0,
        sales: 0,
      };
    }

    // Find matching campaign in campaignComparison for metrics
    const match = campaigns.find((c: any) => String(c.id) === String(camp.id));
    if (match) {
      channelMap[key].spend += parseFloat(match.total_spent || 0);
      channelMap[key].revenue += parseFloat(match.total_revenue || 0);
      channelMap[key].profit += parseFloat(match.gross_profit || 0);
      channelMap[key].sales += parseInt(match.total_purchase || 0, 10);
    }
  }

  return Object.values(channelMap)
    .map((c: any) => ({ ...c, roas: c.spend > 0 ? Math.round((c.revenue / c.spend) * 100) / 100 : 0 }))
    .sort((a: any, b: any) => b.revenue - a.revenue);
}

// ── Sales by Product ──

export async function getSalesByProduct(beginDate: string, endDate: string, _channels?: string): Promise<any[]> {
  const offersResult = await apiGet('offers', `beginDate=${beginDate}&endDate=${endDate}`);
  const offers = offersResult?.data || [];
  return offers.map((o: any) => ({
    id: String(o.id || o.offer_id),
    name: safeStr(o.name) || `Product ${o.id}`,
    price: parseFloat(o.avg_ticket || 0),
    sales: parseInt(o.custom_purchase_count || o.purchases || 0, 10),
    revenue: parseFloat(o.total_revenue || 0),
  }));
}

// ── Health check ──

export async function checkConnection(): Promise<boolean> {
  try {
    await apiGet('campaigns', 'per_page=1');
    return true;
  } catch {
    return false;
  }
}
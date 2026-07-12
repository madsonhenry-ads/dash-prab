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
import { getValidAccessToken, forceRefresh, isAutoLoginConfigured } from './EasyTrackerAutoLogin';
import type { FunnelStep } from '../types';

const BASE = 'https://api.easytracker.digital/api';
const DASHBOARD_UUID = '5d266636-7c23-4add-ae7b-6aeadcfee1cb';

// ── Helpers ──

function safeStr(v: any, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

/**
 * Get headers with a valid token.
 * Uses auto-login (email/password) if configured, otherwise falls back to EASYTRACKER_ACCESS_TOKEN env var.
 */
async function getHeaders(): Promise<Record<string, string>> {
  let token: string | null = null;

  if (isAutoLoginConfigured()) {
    token = await getValidAccessToken();
  } else {
    token = process.env.EASYTRACKER_ACCESS_TOKEN || null;
  }

  if (!token) {
    throw new Error('EasyTracker token not configured. Set EASYTRACKER_EMAIL/PASSWORD or EASYTRACKER_ACCESS_TOKEN env var.');
  }

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
  const headers = await getHeaders();
  const resp = await fetch(url, { headers });

  // If 401, try one auto-refresh then retry once
  if (resp.status === 401 && isAutoLoginConfigured()) {
    console.log('[Proxy] 401 received, attempting token refresh...');
    const newToken = await forceRefresh();
    const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
    const retry = await fetch(url, { headers: retryHeaders });
    if (!retry.ok) {
      throw new Error(`EasyTracker API error (${retry.status}): ${retry.statusText} for ${path}`);
    }
    return retry.json();
  }

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

  const checkouts = parseInt(data.funnel?.offers || 0, 10);

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
    checkouts,
    costPerCheckout: checkouts > 0 ? (summary.total_spent || 0) / checkouts : 0,
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
  const { search = '', sortBy = 'spend', sortOrder = 'desc', page = 1, pageSize = 50 } = params || {};

  // SOURCE: Facebook ads-manager only — all metrics come from the API directly
  const rows = await getAdsManagerAds(beginDate, endDate);

  // Filter
  let result = rows;
  if (search) {
    const term = search.toLowerCase();
    result = result.filter((c: any) => c.name.toLowerCase().includes(term));
  }

  // Sort
  result.sort((a: any, b: any) => {
    const va = a[sortBy] ?? 0;
    const vb = b[sortBy] ?? 0;
    return sortOrder === 'asc' ? va - vb : vb - va;
  });

  const total = result.length;
  const start = (page - 1) * pageSize;
  const paged = result.slice(start, start + pageSize);

  return { rows: paged, total };
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
      const reach = parseInt(ad.reach || 0, 10);

      // Video metrics
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

      // Action-based metrics
      const getAction = (key: string): number => {
        const v = ad.actions?.[key];
        if (typeof v === 'number') return v;
        return parseInt(v || 0, 10);
      };
      const getActionValue = (key: string): number => {
        const v = ad.action_values?.[key];
        if (typeof v === 'number') return v;
        return parseFloat(v || 0);
      };

      const landingViews = getAction('landing_page_view');
      const checkouts = getAction('initiate_checkout');
      const pixelPurchase = getAction('offsite_conversion_fb_pixel_purchase') || getAction('purchase') || getAction('pixel_purchase');
      const purchaseValue = getActionValue('offsite_conversion_fb_pixel_purchase') || getActionValue('purchase');
      const sales = getAction('purchase');

      // ROAS from Facebook
      const roas = ad.purchase_roas?.omni_purchase
        ? parseFloat(ad.purchase_roas.omni_purchase)
        : (ad.website_purchase_roas?.offsite_conversion_fb_pixel_purchase
            ? parseFloat(ad.website_purchase_roas.offsite_conversion_fb_pixel_purchase)
            : (spend > 0 && purchaseValue > 0 ? purchaseValue / spend : 0));

      // CPA (cost per purchase)
      const cpa = pixelPurchase > 0 ? spend / pixelPurchase : 0;

      // CPC from Facebook
      const cpc = parseFloat(ad.cpc || 0);

      // Cost per landing view
      const cic = landingViews > 0 ? spend / landingViews : 0;

      // Cost per checkout
      const costPerCheckout = checkouts > 0 ? spend / checkouts : 0;

      // Checkout rate (checkouts / landing_views)
      const checkoutRate = landingViews > 0 ? (checkouts / landingViews) * 100 : 0;

      // Landing rate (landing_views / clicks)
      const landingRate = clicks > 0 ? (landingViews / clicks) * 100 : 0;

      // Conv rate (sales / clicks)
      const convRate = clicks > 0 ? (sales / clicks) * 100 : 0;

      return {
        id: String(ad.id || ''),
        name: safeStr(ad.name) || '',
        status: (ad.status || 'UNKNOWN').toLowerCase(),
        spend,
        cpa,
        roas,
        impressions,
        reach,
        frequency: parseFloat(ad.frequency || 0),
        clicks,
        clicks_all: clicks,
        ctr: parseFloat(ad.ctr || 0),
        cpc,
        cpc_all: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        landing_views: landingViews,
        cic,
        landing_clicks: checkouts,
        cost_per_checkout: costPerCheckout,
        checkout_rate: checkoutRate,
        pixel_purchase: pixelPurchase,
        revenue: purchaseValue,
        sales: convRate,
        play_rate: impressions > 0 ? (videoViews / impressions) * 100 : 0,
        hook_rate: videoViews > 0 ? (p25 / videoViews) * 100 : 0,
        body_rate: videoViews > 0 ? (p50 / videoViews) * 100 : 0,
        completion_rate: videoViews > 0 ? (p100 / videoViews) * 100 : 0,
        video_plays: videoPlays,
        video_views: videoViews,
        video_25: p25,
        video_50: p50,
        video_75: p75,
        video_100: p100,
        landing_rate: landingRate,
        avg_watch_time: parseFloat(ad.avg_watch_time || 0),
        start_date: ad.start_time || '',
        updated_time: ad.updated_time || '',
        last_updated: ad.updated_time || ad._fetched_at || '',
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

// ── Simplified Dashboard (pass-through) ──

export async function getSimplifiedDashboard(beginDate: string, endDate: string, timezone?: string): Promise<any> {
  const tz = timezone || 'UTC';
  const params = `provider=all&timezone=${encodeURIComponent(tz)}&beginDate=${beginDate}&endDate=${endDate}`;
  const result = await apiGet('simplified-dashboard', params);
  return result?.data || result;
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
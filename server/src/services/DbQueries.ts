import { postgresService } from './PostgresService';
import type {
  DashboardKpis, FunnelStep, SalesByCountry,
} from '../types';

/**
 * PostgreSQL queries for the TrafficBoard dashboard.
 * Maps PG tables → Frontend types.
 */

// ── Dashboard KPIs ──

export async function getKpis(): Promise<DashboardKpis> {
  const [revenue, sales, spend, creativesStats, clicks, ics] = await Promise.all([
    postgresService.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(value_usd), 0) as total FROM purchases`
    ),
    postgresService.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM purchases`
    ),
    postgresService.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(spend_usd), 0) as total FROM creatives`
    ),
    postgresService.queryOne<{ count: number; with_sales: number }>(
      `SELECT COUNT(*) as count, SUM(CASE WHEN purchases > 0 THEN 1 ELSE 0 END) as with_sales FROM creatives`
    ),
    postgresService.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(clicks), 0) as total FROM creatives`
    ),
    postgresService.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(ics), 0) as total FROM creatives`
    ),
  ]);

  const totalRevenue = parseFloat(String(revenue?.total || 0));
  const totalSales = parseInt(String(sales?.count || 0), 10);
  const totalSpend = parseFloat(String(spend?.total || 0));
  const totalClicks = parseInt(String(clicks?.total || 0), 10);
  const totalIcs = parseInt(String(ics?.total || 0), 10);

  const profit = totalRevenue - totalSpend;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const cpa = totalSales > 0 ? totalSpend / totalSales : 0;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const roi = totalSpend > 0 ? (profit / totalSpend) * 100 : 0;
  const arpu = totalSales > 0 ? totalRevenue / totalSales : 0;

  return {
    adSpend: totalSpend,
    profit,
    roas,
    netRevenue: totalRevenue,
    cpa,
    margin,
    roi,
    arpu,
    approvedSales: totalSales,
    grossRevenue: totalRevenue,
  };
}

// ── Funnel ──

export async function getFunnel(): Promise<FunnelStep[]> {
  const clicks = await postgresService.queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(clicks), 0) as total FROM creatives`
  );
  const ics = await postgresService.queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(ics), 0) as total FROM creatives`
  );
  const sales = await postgresService.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM purchases`
  );

  const totalClicks = parseInt(String(clicks?.total || 0), 10);
  const totalIcs = parseInt(String(ics?.total || 0), 10);
  const totalSales = parseInt(String(sales?.total || 0), 10);

  const landingViews = parseInt(String(clicks?.total || 0), 10);
  const purchases = totalSales;

  const cancelledAttempts = totalIcs > purchases ? totalIcs - purchases : 0;

  const funnel: FunnelStep[] = [
    { label: 'Clicks', value: totalClicks },
    { label: 'Page Views', value: landingViews, percentage: totalClicks > 0 ? 100 : 0 },
  ];
  if (totalIcs > 0) {
    funnel.push({
      label: 'Initiate Checkout',
      value: totalIcs,
      percentage: totalClicks > 0 ? Math.round((totalIcs / totalClicks) * 1000) / 10 : 0,
    });
  }
  if (cancelledAttempts > 0) {
    funnel.push({
      label: 'Attempts (Canceled)',
      value: cancelledAttempts,
      percentage: totalIcs > 0 ? Math.round((cancelledAttempts / totalIcs) * 1000) / 10 : 0,
    });
  }
  funnel.push({
    label: 'Completed (Purchase)',
    value: purchases,
    percentage: totalIcs > 0 ? Math.round((purchases / totalIcs) * 1000) / 10 : (totalClicks > 0 ? Math.round((purchases / totalClicks) * 10000) / 100 : 0),
  });

  return funnel;
}

// ── Sales by Country ──

export async function getSalesByCountry(): Promise<SalesByCountry[]> {
  const rows = await postgresService.query<any>(
    `SELECT country, purchases as sales, revenue_usd as revenue FROM country_stats ORDER BY revenue_usd DESC`
  );
  return rows.map((r: any) => ({
    country: r.country,
    sales: parseInt(r.sales, 10),
    revenue: parseFloat(r.revenue),
    flag: getFlagEmoji(r.country),
  }));
}

// ── Top Campaigns ──

export async function getTopCampaigns(): Promise<any[]> {
  const rows = await postgresService.query<any>(
    `SELECT name, total_spent as spend, total_revenue as revenue, roas
     FROM campaigns ORDER BY total_revenue DESC`
  );
  return rows;
}

// ── Creatives (Ads / AdCreative) ──

export interface CreativeRow {
  id: number;
  creative: string;
  purchases: number;
  revenue_usd: number;
  revenue_brl: number;
  ics: number;
  clicks: number;
  conversion_rate: number;
  ic_to_purchase_rate: number;
  campaigns: string[];
  products: string[];
  countries: string[];
}

export async function getCreatives(params: {
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: CreativeRow[]; total: number }> {
  const { search, status, sortBy = 'purchases', sortOrder = 'desc', page = 1, pageSize = 50 } = params;
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (search) {
    conditions.push(`creative ILIKE $${idx++}`);
    values.push(`%${search}%`);
  }

  // Status filter maps PG data to creative statuses
  if (status === 'active') {
    conditions.push(`purchases > 0`);
  } else if (status === 'paused') {
    conditions.push(`purchases = 0 AND ics > 0`);
  } else if (status === 'no_data') {
    conditions.push(`purchases = 0 AND ics = 0 AND clicks = 0`);
  } else if (status === 'rejected') {
    conditions.push(`purchases = 0 AND ics = 0 AND clicks = 0`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Allowed sort columns
  const sortMap: Record<string, string> = {
    name: 'creative',
    sales: 'purchases',
    revenue: 'revenue_usd',
    spend: 'spend_usd',
    profit: 'profit_usd',
    roas: 'roas',
    cpa: 'cpa',
    clicks: 'clicks',
    ics: 'ics',
    ctr: 'conversion_rate',
    hookRate: 'hook_rate',
    holdRate: 'lead_to_purchase_cvr',
  };
  const sortCol = sortMap[sortBy] || 'purchases';
  const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Count
  const countResult = await postgresService.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM creatives ${where}`, values
  );
  const total = parseInt(String(countResult?.total || 0), 10);

  // Data
  const offset = (page - 1) * pageSize;
  const rows = await postgresService.query<any>(
    `SELECT * FROM creatives ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, pageSize, offset]
  );

  return {
    rows: rows.map(mapCreativeRow),
    total,
  };
}

export async function getCreativesTotals(params: { search?: string; status?: string }): Promise<any> {
  const { search, status } = params;
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (search) {
    conditions.push(`creative ILIKE $${idx++}`);
    values.push(`%${search}%`);
  }
  if (status === 'active') conditions.push('purchases > 0');
  else if (status === 'paused') conditions.push('purchases = 0 AND ics > 0');
  else if (status === 'no_data') conditions.push('purchases = 0 AND ics = 0 AND clicks = 0');
  else if (status === 'rejected') conditions.push('purchases = 0 AND ics = 0 AND clicks = 0');

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const row = await postgresService.queryOne<any>(
    `SELECT
       COALESCE(SUM(purchases), 0) as sales,
       COALESCE(SUM(revenue_usd), 0) as revenue,
       COALESCE(SUM(spend_usd), 0) as spend,
       COALESCE(SUM(profit_usd), 0) as profit,
       COALESCE(SUM(ics), 0) as ics,
       COALESCE(SUM(clicks), 0) as clicks,
       COUNT(*) as total_creatives,
       COALESCE(AVG(conversion_rate), 0) as avg_conversion
     FROM creatives ${where}`,
    values
  );
  return row;
}

function mapCreativeRow(r: any): CreativeRow {
  return {
    id: r.id,
    creative: r.creative,
    purchases: parseInt(r.purchases, 10),
    revenue_usd: parseFloat(r.revenue_usd),
    revenue_brl: parseFloat(r.revenue_brl),
    ics: parseInt(r.ics, 10),
    clicks: parseInt(r.clicks, 10),
    conversion_rate: parseFloat(r.conversion_rate),
    ic_to_purchase_rate: parseFloat(r.ic_to_purchase_rate),
    campaigns: r.campaigns || [],
    products: r.products || [],
    countries: r.countries || [],
  };
}

// ── Campaigns ──

export async function getCampaigns(params: {
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: any[]; total: number }> {
  const { search, sortBy = 'total_revenue', sortOrder = 'desc', page = 1, pageSize = 50 } = params;
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (search) {
    conditions.push(`name ILIKE $${idx++}`);
    values.push(`%${search}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortMap: Record<string, string> = {
    name: 'name', status: 'name', spend: 'total_spent',
    revenue: 'total_revenue', profit: 'total_revenue', roas: 'roas',
    cpa: 'cpa', sales: 'total_purchase', clicks: 'clicks',
    impressions: 'clicks', ctr: 'roas',
  };
  const sortCol = sortMap[sortBy] || 'total_revenue';
  const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await postgresService.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM campaigns ${where}`, values
  );
  const total = parseInt(String(countResult?.total || 0), 10);

  const offset = (page - 1) * pageSize;
  const rows = await postgresService.query<any>(
    `SELECT * FROM campaigns ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, pageSize, offset]
  );

  return {
    rows: rows.map((r: any) => ({
      id: String(r.campaign_id),
      name: r.name || '',
      status: r.total_purchase > 0 ? 'ACTIVE' : 'PAUSED',
      budget: r.total_spent || 0,
      spend: parseFloat(r.total_spent || 0),
      impressions: r.clicks || 0,
      clicks: r.clicks || 0,
      revenue: parseFloat(r.total_revenue || 0),
      profit: parseFloat(r.total_revenue || 0) - parseFloat(r.total_spent || 0),
      roas: parseFloat(r.roas || 0),
      cpa: parseFloat(r.cpa || 0),
      ctr: 0,
      sales: parseInt(r.total_purchase || 0, 10),
    })),
    total,
  };
}

// ── Filters ──

export async function getProducts(): Promise<any[]> {
  const rows = await postgresService.query<any>(
    `SELECT offer_id as id, name, clicks, total_spent, total_revenue FROM offers ORDER BY total_revenue DESC`
  );
  return rows.map((r: any) => ({
    id: String(r.id),
    name: r.name || `Product ${r.id}`,
    price: r.total_revenue > 0 ? r.total_revenue / (r.total_purchase || 1) : 0,
  }));
}

export async function getTrafficChannels(): Promise<any[]> {
  const rows = await postgresService.query<any>(
    `SELECT DISTINCT traffic_channel FROM purchases WHERE traffic_channel IS NOT NULL AND traffic_channel != ''`
  );
  return rows.map((r: any, i: number) => ({
    id: `tc_${i + 1}`,
    name: r.traffic_channel,
    platform: r.traffic_channel,
  }));
}

// ── Sales by Day (from purchases) ──

export async function getSalesByDay(): Promise<any[]> {
  const rows = await postgresService.query<any>(
    `SELECT
       EXTRACT(DOW FROM purchased_at) as dow,
       COUNT(*) as sales,
       SUM(value_usd) as revenue
     FROM purchases
     WHERE purchased_at IS NOT NULL
     GROUP BY EXTRACT(DOW FROM purchased_at)
     ORDER BY dow`
  );
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sales = rows.map((r: any) => ({
    day: dayNames[parseInt(r.dow, 10)] || `Day ${r.dow}`,
    sales: parseInt(r.sales, 10),
    revenue: parseFloat(r.revenue),
  }));
  const total = sales.reduce((s: number, d: any) => s + d.sales, 0);
  const maxSales = Math.max(...sales.map((d: any) => d.sales));
  return sales.map((d: any) => ({
    ...d,
    percentage: total > 0 ? Math.round((d.sales / total) * 10000) / 100 : 0,
    isBest: d.sales === maxSales,
  }));
}

// ── Helpers ──

function getFlagEmoji(country: string): string {
  const map: Record<string, string> = {
    'United States': '🇺🇸',
    'United Kingdom': '🇬🇧',
    'Portugal': '🇵🇹',
    'Brasil': '🇧🇷',
    'Brazil': '🇧🇷',
    'Angola': '🇦🇴',
    'Moçambique': '🇲🇿',
    'Cabo Verde': '🇨🇻',
  };
  return map[country] || '🌍';
}
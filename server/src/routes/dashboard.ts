import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { cacheService } from '../services/CacheService';
import { mcpOrCache } from '../services/SyncHelper';
import { postgresService } from '../services/PostgresService';
import * as db from '../services/DbQueries';
import * as proxy from '../services/EasyTrackerProxy';

const router = Router();

function safeStr(v: any, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

function getDates(req: any): { beginDate: string; endDate: string } {
  if (req.query.beginDate && req.query.endDate) {
    return { beginDate: req.query.beginDate as string, endDate: req.query.endDate as string };
  }
  const tz = req.query.timezone as string || 'UTC';
  return proxy.periodToDates(req.query.period as string || 'today', tz);
}

function getPeriodKey(req: any): string {
  if (req.query.beginDate && req.query.endDate) {
    return `${req.query.beginDate}_${req.query.endDate}`;
  }
  return req.query.period as string || 'today';
}

function getChannelFilter(req: any): string | undefined {
  const channels = req.query.channels as string;
  return channels && channels !== 'all' && channels !== '' ? channels : undefined;
}

function getProductFilter(req: any): string | undefined {
  const products = req.query.products as string;
  return products && products !== 'all' && products !== '' ? products : undefined;
}

// Helper to safely get MCP fallback or cache data
async function mcpFallback<T>(name: string, args: Record<string, any>, cacheKey: string, suffix: string): Promise<T | undefined> {
  const cached = cacheService.get<T>(cacheKey as any, suffix);
  if (cached) return cached;
  return mcpOrCache<T>(name, args, cacheKey, suffix);
}

router.get('/kpis', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const channels = getChannelFilter(req);
    const kpis = await proxy.getKpis(beginDate, endDate, channels);
    return res.json({ success: true, data: kpis });
  } catch {
    try { if (postgresService.isConnected()) { const kpis = await db.getKpis(); return res.json({ success: true, data: kpis }); } } catch {}
    try {
      const suffix = `${req.query.period || 'today'}:${req.query.account || 'all'}`;
      const cached = cacheService.get<any>('kpis', suffix);
      if (cached) return res.json({ success: true, data: cached });
    } catch {}
    res.json({ success: true, data: { adSpend: 0, profit: 0, roas: 0, netRevenue: 0, cpa: 0, margin: 0, roi: 0, arpu: 0, approvedSales: 0, grossRevenue: 0 } });
  }
});

router.get('/funnel', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const channels = getChannelFilter(req);
    const funnel = await proxy.getFunnel(beginDate, endDate, channels);
    return res.json({ success: true, data: funnel });
  } catch {
    try { if (postgresService.isConnected()) { const funnel = await db.getFunnel(); return res.json({ success: true, data: funnel }); } } catch {}
    const report = await mcpFallback<any>('easytracker_get_dashboard_report', { period: req.query.period || 'today' }, 'funnel', 'fallback');
    if (report?.funnel) return res.json({ success: true, data: report.funnel });
    res.json({ success: true, data: [] });
  }
});

router.get('/sales-by-hour', async (req: AuthRequest, res: any) => {
  const channels = getChannelFilter(req);
  const periodKey = getPeriodKey(req);
  const cacheSuffix = channels ? `${periodKey}_${channels}` : periodKey;
  try {
    const { beginDate, endDate } = getDates(req);
    const data = await proxy.getSalesByHour(beginDate, endDate);
    if (data.length > 0) return res.json({ success: true, data });
  } catch {}
  const cached = cacheService.get<any>('salesByHour', cacheSuffix);
  if (cached) { res.json({ success: true, data: cached }); return; }
  const report = await mcpFallback<any>('easytracker_get_dashboard_report', { period: req.query.period as string || 'today', channels }, 'salesByHour', cacheSuffix);
  res.json({ success: true, data: (report?.salesByHour) || [] });
});

router.get('/sales-by-day', async (req: AuthRequest, res: any) => {
  const channels = getChannelFilter(req);
  const periodKey = getPeriodKey(req);
  const cacheSuffix = channels ? `${periodKey}_${channels}` : periodKey;
  try {
    const { beginDate, endDate } = getDates(req);
    const data = await proxy.getSalesByDay(beginDate, endDate);
    if (data.length > 0) return res.json({ success: true, data });
  } catch {}
  try { if (postgresService.isConnected()) { const data = await db.getSalesByDay(); return res.json({ success: true, data }); } } catch {}
  const cached = cacheService.get<any>('salesByDay', cacheSuffix);
  if (cached) { res.json({ success: true, data: cached }); return; }
  const report = await mcpFallback<any>('easytracker_get_dashboard_report', { period: req.query.period as string || 'today', channels }, 'salesByDay', cacheSuffix);
  const data = (report?.salesByDay) || [];
  const total = data.reduce((s: number, d: any) => s + d.sales, 0);
  data.forEach((d: any) => { d.percentage = total > 0 ? Math.round((d.sales / total) * 10000) / 100 : 0; });
  cacheService.set('salesByDay', data, cacheSuffix);
  res.json({ success: true, data });
});

router.get('/sales-by-country', async (req: AuthRequest, res: any) => {
  const channels = getChannelFilter(req);
  const periodKey = getPeriodKey(req);
  const cacheSuffix = channels ? `${periodKey}_${channels}` : periodKey;
  try {
    const { beginDate, endDate } = getDates(req);
    const data = await proxy.getSalesByCountry(beginDate, endDate);
    if (data.length > 0 && data[0].country !== 'All') return res.json({ success: true, data });
  } catch {}
  try { if (postgresService.isConnected()) { const data = await db.getSalesByCountry(); return res.json({ success: true, data }); } } catch {}
  const cached = cacheService.get<any>('salesByCountry', cacheSuffix);
  if (cached) { res.json({ success: true, data: cached }); return; }
  const report = await mcpFallback<any>('easytracker_get_dashboard_report', { period: req.query.period as string || 'today', channels }, 'salesByCountry', cacheSuffix);
  res.json({ success: true, data: (report?.salesByCountry) || [] });
});

router.get('/sales-by-payment', async (req: AuthRequest, res: any) => {
  const channels = getChannelFilter(req);
  const periodKey = getPeriodKey(req);
  const cacheSuffix = channels ? `${periodKey}_${channels}` : periodKey;
  try {
    const { beginDate, endDate } = getDates(req);
    const data = await proxy.getSalesByPayment(beginDate, endDate);
    if (data.length > 0) return res.json({ success: true, data });
  } catch {}
  const cached = cacheService.get<any>('salesByPayment', cacheSuffix);
  if (cached) { res.json({ success: true, data: cached }); return; }
  const report = await mcpFallback<any>('easytracker_get_dashboard_report', { period: req.query.period as string || 'today', channels }, 'salesByPayment', cacheSuffix);
  res.json({ success: true, data: (report?.salesByPayment) || [] });
});

router.get('/top-campaigns', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const channels = getChannelFilter(req);
    const data = await proxy.getTopCampaigns(beginDate, endDate, channels);
    return res.json({ success: true, data });
  } catch {
    try { if (postgresService.isConnected()) { const data = await db.getTopCampaigns(); return res.json({ success: true, data }); } } catch {}
    const periodKey = getPeriodKey(req);
    const suffix = `${periodKey}:all`;
    const campaigns = await mcpFallback<any>('easytracker_list_campaigns', {}, 'campaigns', suffix);
    const data = ((campaigns as any[]) || []).map((c: any) => ({
      name: safeStr(c.name), spend: c.spend, revenue: c.revenue, roas: c.roas,
    })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);
    res.json({ success: true, data });
  }
});

// GET /api/dashboard/sales-by-channel
router.get('/sales-by-channel', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const channels = getChannelFilter(req);
    const data = await proxy.getSalesByChannel(beginDate, endDate, channels);
    return res.json({ success: true, data });
  } catch {
    const periodKey = getPeriodKey(req);
    const cached = cacheService.get<any>('salesByChannel', periodKey);
    if (cached) return res.json({ success: true, data: cached });
    res.json({ success: true, data: [] });
  }
});

// GET /api/dashboard/sales-by-product
router.get('/sales-by-product', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const data = await proxy.getSalesByProduct(beginDate, endDate, getChannelFilter(req));
    return res.json({ success: true, data });
  } catch {
    const periodKey = getPeriodKey(req);
    const cached = cacheService.get<any>('salesByProduct', periodKey);
    if (cached) return res.json({ success: true, data: cached });
    res.json({ success: true, data: [] });
  }
});

export default router;
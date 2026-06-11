import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { cacheService } from '../services/CacheService';
import { mcpOrCache } from '../services/SyncHelper';
import { postgresService } from '../services/PostgresService';
import * as db from '../services/DbQueries';
import * as proxy from '../services/EasyTrackerProxy';

const router = Router();

function getDates(req: any): { beginDate: string; endDate: string } {
  if (req.query.beginDate && req.query.endDate) {
    return { beginDate: req.query.beginDate as string, endDate: req.query.endDate as string };
  }
  return proxy.periodToDates(req.query.period as string || 'today');
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

router.get('/kpis', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const channels = getChannelFilter(req);
    const kpis = await proxy.getKpis(beginDate, endDate, channels);
    return res.json({ success: true, data: kpis });
  } catch (err: any) {
    // Fallback: PostgreSQL
    try {
      if (postgresService.isConnected()) {
        const kpis = await db.getKpis();
        return res.json({ success: true, data: kpis });
      }
    } catch {}
    // Fallback: cache
    try {
      const suffix = `${req.query.period || 'today'}:${req.query.account || 'all'}`;
      const cached = cacheService.get<any>('kpis', suffix);
      if (cached) return res.json({ success: true, data: cached });
    } catch {}
    // Fallback: MCP mock
    try {
      const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: req.query.period || 'today' }, 'kpis', 'fallback');
      if (report?.kpis) return res.json({ success: true, data: report.kpis });
    } catch {}
    res.status(502).json({ success: false, error: 'Error loading KPIs: ' + err.message });
  }
});

router.get('/funnel', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const channels = getChannelFilter(req);
    const funnel = await proxy.getFunnel(beginDate, endDate, channels);
    return res.json({ success: true, data: funnel });
  } catch (err: any) {
    try {
      if (postgresService.isConnected()) {
        const funnel = await db.getFunnel();
        return res.json({ success: true, data: funnel });
      }
    } catch {}
    // Fallback: MCP mock
    try {
      const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: req.query.period || 'today' }, 'funnel', 'fallback');
      if (report?.funnel) return res.json({ success: true, data: report.funnel });
    } catch {}
    res.status(503).json({ success: false, error: 'Error loading funnel: ' + err.message });
  }
});

router.get('/sales-by-hour', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const data = await proxy.getSalesByHour(beginDate, endDate);
    if (data.length > 0) return res.json({ success: true, data });
  } catch {}
  const periodKey = getPeriodKey(req);
  const cached = cacheService.get<any>('salesByHour', periodKey);
  if (cached) { res.json({ success: true, data: cached }); return; }
  const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: req.query.period as string || 'today' }, 'salesByHour', periodKey);
  cacheService.set('salesByHour', report.salesByHour || [], periodKey);
  res.json({ success: true, data: report.salesByHour || [] });
});

router.get('/sales-by-day', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const data = await proxy.getSalesByDay(beginDate, endDate);
    if (data.length > 0) return res.json({ success: true, data });
  } catch {}
  try {
    if (postgresService.isConnected()) {
      const data = await db.getSalesByDay();
      return res.json({ success: true, data });
    }
  } catch {}
  const periodKey = getPeriodKey(req);
  const cached = cacheService.get<any>('salesByDay', periodKey);
  if (cached) { res.json({ success: true, data: cached }); return; }
  const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: req.query.period as string || 'today' }, 'salesByDay', periodKey);
  const data = report.salesByDay || [];
  const total = data.reduce((s: number, d: any) => s + d.sales, 0);
  data.forEach((d: any) => { d.percentage = Math.round((d.sales / total) * 10000) / 100; });
  cacheService.set('salesByDay', data, periodKey);
  res.json({ success: true, data });
});

router.get('/sales-by-country', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const data = await proxy.getSalesByCountry(beginDate, endDate);
    if (data.length > 0 && data[0].country !== 'All') return res.json({ success: true, data });
  } catch {}
  try {
    if (postgresService.isConnected()) {
      const data = await db.getSalesByCountry();
      return res.json({ success: true, data });
    }
  } catch {}
  const periodKey = getPeriodKey(req);
  const cached = cacheService.get<any>('salesByCountry', periodKey);
  if (cached) { res.json({ success: true, data: cached }); return; }
  const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: req.query.period as string || 'today' }, 'salesByCountry', periodKey);
  cacheService.set('salesByCountry', report.salesByCountry || [], periodKey);
  res.json({ success: true, data: report.salesByCountry || [] });
});

router.get('/sales-by-payment', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const data = await proxy.getSalesByPayment(beginDate, endDate);
    if (data.length > 0) return res.json({ success: true, data });
  } catch {}
  const periodKey = getPeriodKey(req);
  const cached = cacheService.get<any>('salesByPayment', periodKey);
  if (cached) { res.json({ success: true, data: cached }); return; }
  const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: req.query.period as string || 'today' }, 'salesByPayment', periodKey);
  cacheService.set('salesByPayment', report.salesByPayment || [], periodKey);
  res.json({ success: true, data: report.salesByPayment || [] });
});

router.get('/top-campaigns', async (req: AuthRequest, res: any) => {
  try {
    const { beginDate, endDate } = getDates(req);
    const channels = getChannelFilter(req);
    const data = await proxy.getTopCampaigns(beginDate, endDate, channels);
    return res.json({ success: true, data });
  } catch (err: any) {
    // Fallback
    try {
      if (postgresService.isConnected()) {
        const data = await db.getTopCampaigns();
        return res.json({ success: true, data });
      }
    } catch {}
    const periodKey = getPeriodKey(req);
    const suffix = `${periodKey}:all`;
    const campaigns = await mcpOrCache<any>('easytracker_list_campaigns', {}, 'campaigns', suffix);
    const data = (campaigns as any[] || []).map((c: any) => ({
      name: c.name, spend: c.spend, revenue: c.revenue, roas: c.roas,
    })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);
    res.json({ success: true, data });
  }
});

export default router;
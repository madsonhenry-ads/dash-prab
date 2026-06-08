import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { cacheService } from '../services/CacheService';
import { mcpOrCache } from '../services/SyncHelper';

const router = Router();

router.get('/kpis', async (req: AuthRequest, res: any) => {
  try {
    const suffix = `${req.query.period || 'today'}:${req.query.account || 'all'}`;
    const cached = cacheService.get<any>('kpis', suffix);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: req.query.period || 'today' }, 'kpis', suffix);
    const kpis = report.kpis || report;
    cacheService.set('kpis', kpis, suffix);
    res.json({ success: true, data: kpis });
  } catch (err: any) {
    if (err.message?.includes('cache')) {
      res.status(503).json({ success: false, error: err.message });
    } else {
      res.status(502).json({ success: false, error: 'Erro ao carregar KPIs: ' + err.message });
    }
  }
});

router.get('/funnel', async (req: AuthRequest, res: any) => {
  try {
    const period = req.query.period as string;
    const cached = cacheService.get<any>('funnel', period);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: period || 'today' }, 'funnel', period);
    const funnel = report.funnel || [];
    for (let i = 1; i < funnel.length; i++) {
      funnel[i].percentage = Math.round((funnel[i].value / funnel[i - 1].value) * 1000) / 10;
    }
    cacheService.set('funnel', funnel, period);
    res.json({ success: true, data: funnel });
  } catch (err: any) {
    res.status(503).json({ success: false, error: 'Erro ao carregar funil: ' + err.message });
  }
});

router.get('/sales-by-hour', async (req: AuthRequest, res: any) => {
  try {
    const period = req.query.period as string;
    const cached = cacheService.get<any>('salesByHour', period);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: period || 'today' }, 'salesByHour', period);
    cacheService.set('salesByHour', report.salesByHour || [], period);
    res.json({ success: true, data: report.salesByHour || [] });
  } catch (err: any) {
    res.status(503).json({ success: false, error: 'Erro ao carregar vendas por hora: ' + err.message });
  }
});

router.get('/sales-by-day', async (req: AuthRequest, res: any) => {
  try {
    const period = req.query.period as string;
    const cached = cacheService.get<any>('salesByDay', period);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: period || 'today' }, 'salesByDay', period);
    const data = report.salesByDay || [];
    const total = data.reduce((s: number, d: any) => s + d.sales, 0);
    data.forEach((d: any) => { d.percentage = Math.round((d.sales / total) * 10000) / 100; });
    cacheService.set('salesByDay', data, period);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(503).json({ success: false, error: 'Erro ao carregar vendas por dia: ' + err.message });
  }
});

router.get('/sales-by-country', async (req: AuthRequest, res: any) => {
  try {
    const period = req.query.period as string;
    const cached = cacheService.get<any>('salesByCountry', period);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: period || 'today' }, 'salesByCountry', period);
    cacheService.set('salesByCountry', report.salesByCountry || [], period);
    res.json({ success: true, data: report.salesByCountry || [] });
  } catch (err: any) {
    res.status(503).json({ success: false, error: 'Erro ao carregar vendas por país: ' + err.message });
  }
});

router.get('/sales-by-payment', async (req: AuthRequest, res: any) => {
  try {
    const period = req.query.period as string;
    const cached = cacheService.get<any>('salesByPayment', period);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: period || 'today' }, 'salesByPayment', period);
    cacheService.set('salesByPayment', report.salesByPayment || [], period);
    res.json({ success: true, data: report.salesByPayment || [] });
  } catch (err: any) {
    res.status(503).json({ success: false, error: 'Erro ao carregar vendas por pagamento: ' + err.message });
  }
});

router.get('/top-campaigns', async (req: AuthRequest, res: any) => {
  try {
    const period = req.query.period as string;
    const suffix = `${period || 'today'}:all`;
    const cached = cacheService.get<any>('topCampaigns', suffix);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpOrCache<any>('easytracker_get_dashboard_report', { period: period || 'today' }, 'topCampaigns', suffix);
    const campaigns = await mcpOrCache<any>('easytracker_list_campaigns', {}, 'campaigns', suffix);
    const data = (campaigns as any[] || []).map((c: any) => ({
      name: c.name,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
    })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);
    cacheService.set('topCampaigns', data, suffix);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(503).json({ success: false, error: err.message });
  }
});

export default router;

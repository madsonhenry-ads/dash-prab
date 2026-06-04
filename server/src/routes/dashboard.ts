import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { mcpService } from '../services/McpService';
import { cacheService } from '../services/CacheService';

const router = Router();

router.get('/kpis', async (req: AuthRequest, res: any) => {
  try {
    const suffix = `${req.query.period || 'today'}:${req.query.account || 'all'}`;
    let cached = cacheService.get<any>('kpis', suffix);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpService.callTool('easytracker_get_dashboard_report', { period: req.query.period || 'today' });
    const kpis = report.kpis || report;
    cacheService.set('kpis', kpis, suffix);
    res.json({ success: true, data: kpis });
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao carregar KPIs: ' + err.message });
  }
});

router.get('/funnel', async (req: AuthRequest, res: any) => {
  try {
    const cached = cacheService.get<any>('funnel', req.query.period as string);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpService.callTool('easytracker_get_dashboard_report', { period: req.query.period || 'today' });
    const funnel = report.funnel || [];
    for (let i = 1; i < funnel.length; i++) {
      funnel[i].percentage = Math.round((funnel[i].value / funnel[i - 1].value) * 1000) / 10;
    }
    cacheService.set('funnel', funnel, req.query.period as string);
    res.json({ success: true, data: funnel });
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao carregar funil: ' + err.message });
  }
});

router.get('/sales-by-hour', async (req: AuthRequest, res: any) => {
  try {
    const cached = cacheService.get<any>('salesByHour', req.query.period as string);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpService.callTool('easytracker_get_dashboard_report', { period: req.query.period || 'today' });
    cacheService.set('salesByHour', report.salesByHour || [], req.query.period as string);
    res.json({ success: true, data: report.salesByHour || [] });
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao carregar vendas por hora: ' + err.message });
  }
});

router.get('/sales-by-day', async (req: AuthRequest, res: any) => {
  try {
    const cached = cacheService.get<any>('salesByDay', req.query.period as string);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpService.callTool('easytracker_get_dashboard_report', { period: req.query.period || 'today' });
    const data = report.salesByDay || [];
    const total = data.reduce((s: number, d: any) => s + d.sales, 0);
    data.forEach((d: any) => { d.percentage = Math.round((d.sales / total) * 10000) / 100; });
    cacheService.set('salesByDay', data, req.query.period as string);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao carregar vendas por dia: ' + err.message });
  }
});

router.get('/sales-by-country', async (req: AuthRequest, res: any) => {
  try {
    const cached = cacheService.get<any>('salesByCountry', req.query.period as string);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpService.callTool('easytracker_get_dashboard_report', { period: req.query.period || 'today' });
    cacheService.set('salesByCountry', report.salesByCountry || [], req.query.period as string);
    res.json({ success: true, data: report.salesByCountry || [] });
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao carregar vendas por país: ' + err.message });
  }
});

router.get('/sales-by-payment', async (req: AuthRequest, res: any) => {
  try {
    const cached = cacheService.get<any>('salesByPayment', req.query.period as string);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await mcpService.callTool('easytracker_get_dashboard_report', { period: req.query.period || 'today' });
    cacheService.set('salesByPayment', report.salesByPayment || [], req.query.period as string);
    res.json({ success: true, data: report.salesByPayment || [] });
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao carregar vendas por pagamento: ' + err.message });
  }
});

router.get('/top-campaigns', async (req: AuthRequest, res: any) => {
  try {
    const report = await mcpService.callTool('easytracker_get_dashboard_report', { period: req.query.period || 'today' });
    const campaigns = await mcpService.callTool('easytracker_list_campaigns', {});
    const data = (campaigns as any[] || []).map(c => ({
      name: c.name,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
    })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

export default router;

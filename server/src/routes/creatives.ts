import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { cacheService } from '../services/CacheService';
import { fromCacheOrMCP } from '../services/SyncHelper';
import type { Creative } from '../types';

const router = Router();

router.get('/', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    const status = (req.query.status as string) || '';
    const search = (req.query.search as string) || '';
    const product = (req.query.product as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const sortBy = (req.query.sortBy as string) || '';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    const suffix = `${period}:${product}`;
    let data = cacheService.get<Creative[]>('creatives', suffix);

    if (!data) {
      data = await fromCacheOrMCP<Creative[]>('creatives', suffix, 'easytracker_list_ads', { period });
    }

    let result = [...data];

    // Apply filters
    if (status) {
      result = result.filter(c => c.status === status);
    }
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(term));
    }

    // Sort
    if (sortBy) {
      result.sort((a: any, b: any) => {
        const valA = a[sortBy] ?? 0;
        const valB = b[sortBy] ?? 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }

    // Paginate
    const total = result.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginated = result.slice(start, start + pageSize);

    // Footer totals
    const totals = {
      spend: result.reduce((s, c) => s + c.spend, 0),
      revenue: result.reduce((s, c) => s + c.revenue, 0),
      profit: result.reduce((s, c) => s + c.profit, 0),
      sales: result.reduce((s, c) => s + c.sales, 0),
      roas: result.reduce((s, c) => s + c.roas, 0) / (result.length || 1),
      cpa: result.reduce((s, c) => s + (c.sales > 0 ? c.spend / c.sales : 0), 0) / (result.filter(c => c.sales > 0).length || 1),
      hookRate: result.reduce((s, c) => s + c.hookRate, 0) / (result.length || 1),
      holdRate: result.reduce((s, c) => s + c.holdRate, 0) / (result.length || 1),
      ctr: result.reduce((s, c) => s + c.ctr, 0) / (result.length || 1),
      bounce_rate: result.reduce((s, c) => s + (c.bounce_rate || 0), 0) / (result.length || 1),
      landing_views: result.reduce((s, c) => s + (c.landing_views || 0), 0),
      landing_clicks: result.reduce((s, c) => s + (c.landing_clicks || 0), 0),
      avg_ticket: result.reduce((s, c) => s + (c.avg_ticket || 0), 0) / (result.length || 1),
      cic: result.filter(c => (c.landing_clicks || 0) > 0).reduce((s, c) => s + ((c.landing_clicks || 0) > 0 ? c.spend / c.landing_clicks : 0), 0) / (result.filter(c => (c.landing_clicks || 0) > 0).length || 1),
    };

    res.json({
      success: true,
      data: paginated,
      meta: { page, pageSize, total, totalPages },
      footer: totals,
    });
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao carregar criativos: ' + err.message });
  }
});

router.get('/export', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    let data = cacheService.get<Creative[]>('creatives', period);
    if (!data) {
      data = await fromCacheOrMCP<Creative[]>('creatives', period, 'easytracker_list_ads', { period });
    }

    const headers = ['Nome', 'Status', 'Data Veiculação', 'Gastos', 'Faturamento', 'Lucro', 'ROAS', 'CPA', 'CPC', 'CTR', 'Hook Rate', 'Hold Rate', 'Vendas', 'Add to Cart'];
    const rows = data.map(c => [c.name, c.status, c.startDate, c.spend, c.revenue, c.profit, c.roas, c.cpa, c.cpc, c.ctr, c.hookRate, c.holdRate, c.sales, c.addToCart]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=creatives-report.csv');
    res.send(csvContent);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao exportar: ' + err.message });
  }
});

export default router;
import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { mcpService } from '../services/McpService';
import { cacheService } from '../services/CacheService';
import type { Campaign, AdSet, AdCreative } from '../types';

const router = Router();

// GET /api/campaigns-report/campaigns — list campaigns
router.get('/campaigns', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const sortBy = (req.query.sortBy as string) || '';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    let data = cacheService.get<Campaign[]>('campaigns', period);
    if (!data) {
      data = await mcpService.callTool('easytracker_list_campaigns', {}) as Campaign[];
      cacheService.set('campaigns', data, period);
    }

    let result = [...data];
    if (search) result = result.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    if (status) result = result.filter(c => c.status === status);

    if (sortBy) {
      result.sort((a: any, b: any) => {
        const va = a[sortBy] ?? 0, vb = b[sortBy] ?? 0;
        return sortOrder === 'asc' ? va - vb : vb - va;
      });
    }

    const total = result.length;
    const totalPages = Math.ceil(total / pageSize);
    const paginated = result.slice((page - 1) * pageSize, page * pageSize);

    const footer = {
      spend: result.reduce((s, c) => s + c.spend, 0),
      revenue: result.reduce((s, c) => s + c.revenue, 0),
      profit: result.reduce((s, c) => s + c.profit, 0),
      sales: result.reduce((s, c) => s + c.sales, 0),
      roas: result.reduce((s, c) => s + c.roas, 0) / (result.length || 1),
    };

    res.json({ success: true, data: paginated, meta: { page, pageSize, total, totalPages }, footer });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// GET /api/campaigns-report/ad-sets
router.get('/ad-sets', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    const campaignId = (req.query.campaignId as string) || '';
    const search = (req.query.search as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const sortBy = (req.query.sortBy as string) || '';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    let data = cacheService.get<AdSet[]>('adSets', period);
    if (!data) {
      data = await mcpService.callTool('easytracker_list_ad_sets', {}) as AdSet[];
      cacheService.set('adSets', data, period);
    }

    let result = [...data];
    if (campaignId) result = result.filter(a => a.campaignId === campaignId);
    if (search) result = result.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

    if (sortBy) {
      result.sort((a: any, b: any) => {
        const va = a[sortBy] ?? 0, vb = b[sortBy] ?? 0;
        return sortOrder === 'asc' ? va - vb : vb - va;
      });
    }

    const total = result.length;
    const totalPages = Math.ceil(total / pageSize);
    const paginated = result.slice((page - 1) * pageSize, page * pageSize);

    const footer = {
      spend: result.reduce((s, c) => s + c.spend, 0),
      revenue: result.reduce((s, c) => s + c.revenue, 0),
      profit: result.reduce((s, c) => s + c.profit, 0),
      sales: result.reduce((s, c) => s + c.sales, 0),
      roas: result.reduce((s, c) => s + c.roas, 0) / (result.length || 1),
    };

    res.json({ success: true, data: paginated, meta: { page, pageSize, total, totalPages }, footer });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// GET /api/campaigns-report/ads
router.get('/ads', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    const status = (req.query.status as string) || '';
    const search = (req.query.search as string) || '';
    const campaignId = (req.query.campaignId as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const sortBy = (req.query.sortBy as string) || '';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    let data = cacheService.get<AdCreative[]>('ads', period);
    if (!data) {
      data = await mcpService.callTool('easytracker_list_ads', { period }) as AdCreative[];
      cacheService.set('ads', data, period);
    }

    let result = [...data];
    if (status) result = result.filter(a => a.status === status);
    if (campaignId) result = result.filter(a => a.campaignId === campaignId);
    if (search) result = result.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

    if (sortBy) {
      result.sort((a: any, b: any) => {
        const va = a[sortBy] ?? 0, vb = b[sortBy] ?? 0;
        return sortOrder === 'asc' ? va - vb : vb - va;
      });
    }

    const total = result.length;
    const totalPages = Math.ceil(total / pageSize);
    const paginated = result.slice((page - 1) * pageSize, page * pageSize);

    const footer = {
      spend: result.reduce((s, c) => s + c.spend, 0),
      revenue: result.reduce((s, c) => s + c.revenue, 0),
      profit: result.reduce((s, c) => s + c.profit, 0),
      sales: result.reduce((s, c) => s + c.sales, 0),
      roas: result.reduce((s, c) => s + c.roas, 0) / (result.length || 1),
      cpa: result.reduce((s, c) => s + (c.sales > 0 ? c.spend / c.sales : 0), 0) / (result.filter(c => c.sales > 0).length || 1),
      ctr: result.reduce((s, c) => s + c.ctr, 0) / (result.length || 1),
    };

    res.json({ success: true, data: paginated, meta: { page, pageSize, total, totalPages }, footer });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// GET /api/campaigns-report/campaigns/export
router.get('/campaigns/export', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    let data = cacheService.get<Campaign[]>('campaigns', period);
    if (!data) {
      data = await mcpService.callTool('easytracker_list_campaigns', {}) as Campaign[];
    }

    const headers = ['Nome', 'Status', 'Orçamento', 'Gastos', 'Impressões', 'Cliques', 'Faturamento', 'Lucro', 'ROAS', 'CPA', 'CTR', 'Vendas'];
    const rows = data.map(c => [c.name, c.status, c.budget, c.spend, c.impressions, c.clicks, c.revenue, c.profit, c.roas, c.cpa, c.ctr, c.sales]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=campaigns-report.csv');
    res.send(csvContent);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao exportar: ' + err.message });
  }
});

// GET /api/campaigns-report/ads/export
router.get('/ads/export', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    let data = cacheService.get<AdCreative[]>('ads', period);
    if (!data) {
      data = await mcpService.callTool('easytracker_list_ads', { period }) as AdCreative[];
    }

    const headers = ['Nome', 'Status', 'Data Início', 'Gastos', 'Faturamento', 'Lucro', 'ROAS', 'CPA', 'CPC', 'CTR', 'Hook Rate', 'Hold Rate', 'Vendas', 'Add to Cart', 'Impressões', 'Cliques'];
    const rows = data.map(a => [a.name, a.status, a.startDate, a.spend, a.revenue, a.profit, a.roas, a.cpa, a.cpc, a.ctr, a.hookRate, a.holdRate, a.sales, a.addToCart, a.impressions, a.clicks]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=ads-report.csv');
    res.send(csvContent);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao exportar: ' + err.message });
  }
});

export default router;

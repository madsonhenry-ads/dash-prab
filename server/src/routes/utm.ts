import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { cacheService } from '../services/CacheService';
import { mcpOrCache } from '../services/SyncHelper';
import * as proxy from '../services/EasyTrackerProxy';
import * as db from '../services/DbQueries';
import { postgresService } from '../services/PostgresService';
import type { Campaign, AdSet, AdCreative } from '../types';

const router = Router();

// GET /api/campaigns-report/campaigns — list campaigns
router.get('/campaigns', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    const { beginDate, endDate } = proxy.periodToDates(period);
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const sortBy = (req.query.sortBy as string) || 'total_revenue';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const channels = (req.query.channels as string) || '';

    let rows: any[], total: number;

    try {
      const proxyResult = await proxy.getCampaigns(beginDate, endDate, {
        search, sortBy, sortOrder, page, pageSize, channels,
      });
      rows = proxyResult.rows;
      total = proxyResult.total;
    } catch {
      // PostgreSQL fallback
      try {
        if (postgresService.isConnected()) {
          const dbResult = await db.getCampaigns({ search, sortBy, sortOrder, page, pageSize });
          rows = dbResult.rows;
          total = dbResult.total;
        } else { throw new Error('PG not connected'); }
      } catch {
        // MCP fallback
        const campaigns = await mcpOrCache<any>('easytracker_list_campaigns', {}, 'campaigns', `${period}:all`);
        const all = (campaigns as any[] || []).map((c: any) => ({
          id: c.id || '',
          name: c.name || '',
          status: c.status || 'ACTIVE',
          budget: c.budget || 0,
          spend: c.spend || 0,
          impressions: c.impressions || 0,
          clicks: c.clicks || 0,
          revenue: c.revenue || 0,
          profit: c.profit || 0,
          roas: c.roas || 0,
          cpa: c.cpa || 0,
          ctr: c.ctr || 0,
          sales: c.sales || 0,
        }));
        rows = all;
        total = all.length;
      }
    }

    let result = rows as Campaign[];

    // Additional status filter that the proxy doesn't handle internally
    if (status) {
      result = result.filter((c: any) => c.status === status);
    }

    const totalPages = Math.ceil(total / pageSize);
    const footer = {
      spend: result.reduce((s: number, c: any) => s + c.spend, 0),
      revenue: result.reduce((s: number, c: any) => s + c.revenue, 0),
      profit: result.reduce((s: number, c: any) => s + c.profit, 0),
      sales: result.reduce((s: number, c: any) => s + c.sales, 0),
      roas: result.length > 0 ? result.reduce((s: number, c: any) => s + c.roas, 0) / result.length : 0,
    };

    return res.json({
      success: true,
      data: result,
      meta: { page, pageSize, total, totalPages },
      footer,
    });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// GET /api/campaigns-report/ad-sets
router.get('/ad-sets', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    const { beginDate, endDate } = proxy.periodToDates(period);
    const campaignId = (req.query.campaignId as string) || '';
    const search = (req.query.search as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const sortBy = (req.query.sortBy as string) || 'revenue';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const channels = (req.query.channels as string) || '';

    let rows: any[], total: number;

    try {
      const proxyResult = await proxy.getAdSets(beginDate, endDate, {
        search, campaignId, sortBy, sortOrder, page, pageSize, channels,
      });
      rows = proxyResult.rows;
      total = proxyResult.total;
    } catch {
      // MCP fallback
      const adSets = await mcpOrCache<any>('easytracker_list_ad_sets', { campaignId, period }, 'adSets', `${period}:${campaignId}`);
      rows = (adSets as any[] || []).map((a: any) => ({
        id: a.id || '',
        name: a.name || '',
        campaignId: a.campaignId || '',
        campaignName: a.campaignName || '',
        status: a.status || 'PAUSED',
        spend: a.spend || 0,
        revenue: a.revenue || 0,
        profit: a.profit || 0,
        roas: a.roas || 0,
        impressions: a.impressions || 0,
        clicks: a.clicks || 0,
        ctr: a.ctr || 0,
        sales: a.sales || 0,
      }));
      total = rows.length;
    }

    let result = rows as AdSet[];
    const totalPages = Math.ceil(total / pageSize);

    const footer = {
      spend: result.reduce((s: number, c: any) => s + c.spend, 0),
      revenue: result.reduce((s: number, c: any) => s + c.revenue, 0),
      profit: result.reduce((s: number, c: any) => s + c.profit, 0),
      sales: result.reduce((s: number, c: any) => s + c.sales, 0),
      roas: result.length > 0 ? result.reduce((s: number, c: any) => s + c.roas, 0) / result.length : 0,
    };

    res.json({ success: true, data: result, meta: { page, pageSize, total, totalPages }, footer });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// GET /api/campaigns-report/ads
router.get('/ads', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    const { beginDate, endDate } = proxy.periodToDates(period);
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const campaignId = (req.query.campaignId as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const sortBy = (req.query.sortBy as string) || 'purchases';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const channels = (req.query.channels as string) || '';

    let rows: any[], total: number;

    try {
      const proxyResult = await proxy.getCreatives(beginDate, endDate, {
        search, sortBy, sortOrder, page, pageSize, campaignId, channels,
      });
      rows = proxyResult.rows;
      total = proxyResult.total;
    } catch {
      // MCP fallback
      try {
        const cached = cacheService.get<any>('ads', period);
        if (cached) {
          rows = cached.rows;
          total = cached.total;
        } else {
          const ads = await mcpOrCache<any>('easytracker_list_ads', { period }, 'ads', period);
          rows = (ads as any[] || []).map((a: any) => ({
            id: a.id || '',
            name: a.name || '',
            campaignId: a.campaignId || '',
            campaignName: a.campaignName || '',
            adSetId: a.adSetId || '',
            status: a.status || 'no_data',
            startDate: a.startDate || '',
            spend: a.spend || 0,
            revenue: a.revenue || 0,
            profit: a.profit || 0,
            roas: a.roas || 0,
            cpa: a.cpa || 0,
            cpc: a.cpc || 0,
            ctr: a.ctr || 0,
            hookRate: a.hookRate || 0,
            holdRate: a.holdRate || 0,
            sales: a.sales || 0,
            addToCart: a.addToCart || 0,
            impressions: a.impressions || 0,
            clicks: a.clicks || 0,
            bounce_rate: a.bounce_rate || 0,
            landing_views: a.landing_views || 0,
            landing_clicks: a.landing_clicks || 0,
            avg_ticket: a.avg_ticket || 0,
          }));
          total = rows.length;
          cacheService.set('ads', { rows, total }, period);
        }
      } catch {
        rows = [];
        total = 0;
      }
    }

    let result = rows as AdCreative[];

    // Additional status filter
    if (status) {
      result = result.filter((a: any) => a.status === status);
    }

    const totalPages = Math.ceil(total / pageSize);
    const footer = {
      spend: result.reduce((s: number, c: any) => s + c.spend, 0),
      revenue: result.reduce((s: number, c: any) => s + c.revenue, 0),
      profit: result.reduce((s: number, c: any) => s + c.profit, 0),
      sales: result.reduce((s: number, c: any) => s + c.sales, 0),
      roas: result.length > 0 ? result.reduce((s: number, c: any) => s + c.roas, 0) / result.length : 0,
      cpa: result.filter((c: any) => c.sales > 0).reduce((s: number, c: any) => s + c.cpa, 0) / (result.filter((c: any) => c.sales > 0).length || 1),
      ctr: result.reduce((s: number, c: any) => s + c.ctr, 0) / (result.length || 1),
    };

    res.json({ success: true, data: result, meta: { page, pageSize, total, totalPages }, footer });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// GET /api/campaigns-report/campaigns/export
router.get('/campaigns/export', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    const { beginDate, endDate } = proxy.periodToDates(period);
    const { rows } = await proxy.getCampaigns(beginDate, endDate, { pageSize: 10000 });

    const headers = ['Name', 'Status', 'Budget', 'Spend', 'Impressions', 'Clicks', 'Revenue', 'Profit', 'ROAS', 'CPA', 'CTR', 'Sales'];
    const csvRows = rows.map((c: any) => [c.name, c.status, c.budget, c.spend, c.impressions, c.clicks, c.revenue, c.profit, c.roas, c.cpa, c.ctr, c.sales]);
    const csvContent = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=campaigns-report.csv');
    res.send(csvContent);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Error exporting: ' + err.message });
  }
});

// GET /api/campaigns-report/ads/export
router.get('/ads/export', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    const { beginDate, endDate } = proxy.periodToDates(period);
    const { rows } = await proxy.getCreatives(beginDate, endDate, { pageSize: 10000 });

    const headers = ['Name', 'Status', 'Start Date', 'Spend', 'Revenue', 'Profit', 'ROAS', 'CPA', 'CPC', 'CTR', 'Hook Rate', 'Hold Rate', 'Sales', 'Add to Cart', 'Impressions', 'Clicks', 'Bounce Rate', 'Landing Views', 'Avg Ticket'];
    const csvRows = rows.map((a: any) => [a.name, a.status, a.startDate, a.spend, a.revenue, a.profit, a.roas, a.cpa, a.cpc, a.ctr, a.hookRate, a.holdRate, a.sales, a.addToCart, a.impressions, a.clicks, a.bounce_rate, a.landing_views, a.avg_ticket]);
    const csvContent = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=ads-report.csv');
    res.send(csvContent);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Error exporting: ' + err.message });
  }
});

export default router;
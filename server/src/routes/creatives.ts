import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { cacheService } from '../services/CacheService';
import { mcpOrCache } from '../services/SyncHelper';
import * as proxy from '../services/EasyTrackerProxy';
import * as db from '../services/DbQueries';
import { postgresService } from '../services/PostgresService';
import type { Creative } from '../types';

const router = Router();

function safeStr(v: any, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

router.get('/', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    const tz = (req.query.timezone as string) || 'UTC';
    const queryBegin = req.query.beginDate as string | undefined;
    const queryEnd = req.query.endDate as string | undefined;
    const { beginDate, endDate } = queryBegin && queryEnd
      ? { beginDate: queryBegin, endDate: queryEnd }
      : proxy.periodToDates(period, tz);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const search = (req.query.search as string) || '';
    const sortBy = (req.query.sortBy as string) || 'sales';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const channels = (req.query.channels as string) || '';

    let rows: any[], total: number;
    let dataSource = '';

    // FIRST: Try PostgreSQL (offline fallback with historical data)
    try {
      if (postgresService.isConnected()) {
        const dbResult = await db.getCreatives({ search, sortBy, sortOrder, page, pageSize });
        if (dbResult.rows.length > 0) {
          rows = dbResult.rows.map((r: any) => {
            const spend = r.spend_usd || 0;
            const revenue = r.revenue_usd || 0;
            const clicks = r.clicks || 0;
            const landingClicks = r.landing_clicks || 0;
            const sales = r.purchases || 0;
            return {
              id: String(r.id),
              name: r.creative,
              campaignName: (r.campaigns || []).join(', '),
              campaignId: '',
              adSetId: '',
              status: r.status || (sales > 0 ? 'active' : (landingClicks > 0 ? 'paused' : (clicks > 0 ? 'under_review' : 'no_data'))),
              startDate: r.first_seen ? new Date(r.first_seen).toISOString().split('T')[0] : '',
              spend,
              revenue,
              profit: revenue - spend,
              roas: r.roas || (spend > 0 ? revenue / spend : 0),
              cpa: r.cpa || (sales > 0 ? spend / sales : 0),
              cpc: r.cpc || (clicks > 0 ? spend / clicks : 0),
              ctr: r.ctr || r.conversion_rate || 0,
              hookRate: r.hook_rate || 0,
              holdRate: r.ic_to_purchase_rate || r.lead_to_purchase_cvr || 0,
              sales,
              addToCart: 0,
              impressions: r.impressions || 0,
              clicks,
              bounce_rate: r.bounce_rate || 0,
              landing_views: r.landing_views || 0,
              landing_clicks: landingClicks,
              avg_ticket: r.avg_ticket || (sales > 0 ? revenue / sales : 0),
              cic: landingClicks > 0 ? spend / landingClicks : 0,
              // New ads-manager fields
              reach: r.reach || 0,
              frequency: r.frequency || 0,
              clicks_all: r.clicks_all || clicks,
              cpc_all: r.cpc_all || 0,
              cpm: r.cpm || 0,
              video_plays: r.video_plays || 0,
              video_views: r.video_views || 0,
              video_25: r.video_25 || 0,
              video_50: r.video_50 || 0,
              video_75: r.video_75 || 0,
              video_100: r.video_100 || 0,
              avg_watch_time: r.avg_watch_time || 0,
              pixel_purchase: r.pixel_purchase || 0,
              play_rate: r.play_rate || 0,
              body_rate: r.body_rate || 0,
              completion_rate: r.completion_rate || 0,
              landing_rate: r.landing_rate || 0,
              checkout_rate: r.checkout_rate || 0,
              cost_per_checkout: r.cost_per_checkout || 0,
              last_updated: r.updated_at ? new Date(r.updated_at).toISOString() : '',
            };
          });
          total = dbResult.total;
          dataSource = 'postgres';
        } else {
          throw new Error('PG empty');
        }
      } else {
        throw new Error('PG not connected');
      }
    } catch {
      // SECOND: Try Proxy (real EasyTracker API)
      try {
        const proxyResult = await proxy.getCreatives(beginDate, endDate, {
          search, sortBy, sortOrder, page, pageSize, channels,
        });
        rows = proxyResult.rows;
        total = proxyResult.total;
        dataSource = 'proxy';

        // Enrich with ads-manager data if available
        try {
          const adsData = await proxy.getAdsManagerAds(beginDate, endDate);
          const adsByName: Record<string, any> = {};
          for (const ad of adsData) {
            adsByName[ad.name.toLowerCase().trim()] = ad;
          }
          rows = rows.map((r: any) => {
            const ad = adsByName[r.name?.toLowerCase().trim()] || {};
            return { ...r, ...ad, name: r.name, campaignName: r.campaignName, sales: r.sales };
          });
        } catch {
          // ads-manager enrichment is optional
        }
      } catch {
        // LAST: Try cache or MCP (mock data)
        try {
          const cached = cacheService.get<any>('creatives', period);
          if (cached) {
            rows = cached.rows;
            total = cached.total;
            dataSource = 'cache';
          } else {
            const ads = await mcpOrCache<any>('easytracker_list_ads', { period }, 'ads', period);
            const mapped = (ads as any[] || []).map((a: any) => ({
              id: a.id || '',
              name: safeStr(a.name) || '',
              campaignName: a.campaignName || '',
              campaignId: a.campaignId || '',
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
              cic: a.landing_clicks > 0 ? ((a.spend || 0) / a.landing_clicks) : 0,
              reach: a.reach || 0,
              frequency: a.frequency || 0,
              clicks_all: a.clicks_all || 0,
              cpc_all: a.cpc_all || 0,
              cpm: a.cpm || 0,
              video_plays: a.video_plays || 0,
              video_views: a.video_views || 0,
              video_25: a.video_25 || 0,
              video_50: a.video_50 || 0,
              video_75: a.video_75 || 0,
              video_100: a.video_100 || 0,
              avg_watch_time: a.avg_watch_time || 0,
              pixel_purchase: a.pixel_purchase || 0,
              play_rate: a.play_rate || 0,
              body_rate: a.body_rate || 0,
              completion_rate: a.completion_rate || 0,
              landing_rate: a.landing_rate || 0,
              checkout_rate: a.checkout_rate || 0,
              cost_per_checkout: a.cost_per_checkout || 0,
              last_updated: '',
            }));
            rows = mapped;
            total = mapped.length;
            cacheService.set('creatives', { rows, total }, period);
          }
        } catch {
          rows = [];
          total = 0;
        }
      }
    }

    // Apply search filter (in case proxy didn't)
    let filtered = rows;
    if (search) {
      const term = search.toLowerCase();
      filtered = rows.filter((c: any) => c.name?.toLowerCase().includes(term));
    }

    // Compute CIC for each row
    filtered.forEach((c: any) => {
      if (c.landing_clicks > 0 && !c.cic) {
        c.cic = c.spend / c.landing_clicks;
      }
    });

    // Sort
    const sortField = sortBy || 'sales';
    filtered.sort((a: any, b: any) => {
      const va = a[sortField] ?? 0;
      const vb = b[sortField] ?? 0;
      return sortOrder === 'asc' ? va - vb : vb - va;
    });

    const data: Creative[] = filtered.map((r: any) => ({
      id: r.id,
      name: safeStr(r.name),
      campaignName: safeStr(r.campaignName) || '',
      campaignId: r.campaignId || '',
      adSetId: r.adSetId || '',
      status: (r.status as Creative['status']) || 'no_data',
      startDate: r.startDate || '',
      spend: r.spend || 0,
      revenue: r.revenue || 0,
      profit: r.profit || 0,
      roas: r.roas || 0,
      cpa: r.cpa || 0,
      cpc: r.cpc || 0,
      ctr: r.ctr || 0,
      hookRate: r.hookRate || 0,
      holdRate: r.holdRate || 0,
      sales: r.sales || 0,
      addToCart: r.addToCart || 0,
      impressions: r.impressions || 0,
      clicks: r.clicks || 0,
      bounce_rate: r.bounce_rate || 0,
      landing_views: r.landing_views || 0,
      landing_clicks: r.landing_clicks || 0,
      avg_ticket: r.avg_ticket || 0,
      cic: r.cic || 0,
      reach: r.reach || 0,
      frequency: r.frequency || 0,
      clicks_all: r.clicks_all || 0,
      cpc_all: r.cpc_all || 0,
      cpm: r.cpm || 0,
      video_plays: r.video_plays || 0,
      video_views: r.video_views || 0,
      video_25: r.video_25 || 0,
      video_50: r.video_50 || 0,
      video_75: r.video_75 || 0,
      video_100: r.video_100 || 0,
      avg_watch_time: r.avg_watch_time || 0,
      pixel_purchase: r.pixel_purchase || 0,
      play_rate: r.play_rate || 0,
      body_rate: r.body_rate || 0,
      completion_rate: r.completion_rate || 0,
      landing_rate: r.landing_rate || 0,
      checkout_rate: r.checkout_rate || 0,
      cost_per_checkout: r.cost_per_checkout || 0,
      last_updated: r.last_updated || '',
    }));

    // Footer totals
    const footer = {
      spend: data.reduce((s, c) => s + c.spend, 0),
      revenue: data.reduce((s, c) => s + c.revenue, 0),
      profit: data.reduce((s, c) => s + c.profit, 0),
      sales: data.reduce((s, c) => s + c.sales, 0),
      roas: data.reduce((s, c) => s + c.roas, 0) / (data.length || 1),
      cpa: data.filter(c => c.sales > 0).reduce((s, c) => s + c.cpa, 0) / (data.filter(c => c.sales > 0).length || 1),
      hookRate: data.reduce((s, c) => s + c.hookRate, 0) / (data.length || 1),
      holdRate: data.reduce((s, c) => s + c.holdRate, 0) / (data.length || 1),
      ctr: data.reduce((s, c) => s + c.ctr, 0) / (data.length || 1),
      bounce_rate: data.reduce((s, c) => s + (c.bounce_rate || 0), 0) / (data.length || 1),
      landing_views: data.reduce((s, c) => s + (c.landing_views || 0), 0),
      landing_clicks: data.reduce((s, c) => s + (c.landing_clicks || 0), 0),
      avg_ticket: data.reduce((s, c) => s + (c.avg_ticket || 0), 0) / (data.length || 1),
      cic: data.filter(c => (c.landing_clicks || 0) > 0).reduce((s, c) => s + c.cic, 0) / (data.filter(c => (c.landing_clicks || 0) > 0).length || 1),
    };

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      success: true,
      data,
      meta: { page, pageSize, total, totalPages },
      footer,
      source: dataSource,
    });
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao carregar criativos: ' + err.message });
  }
});

router.get('/export', async (req: AuthRequest, res: any) => {
  try {
    const period = (req.query.period as string) || 'today';
    const tz = (req.query.timezone as string) || 'UTC';
    const queryBegin = req.query.beginDate as string | undefined;
    const queryEnd = req.query.endDate as string | undefined;
    const { beginDate, endDate } = queryBegin && queryEnd
      ? { beginDate: queryBegin, endDate: queryEnd }
      : proxy.periodToDates(period, tz);
    let data = cacheService.get<Creative[]>('creatives', period);
    if (!data) {
      data = await mcpOrCache<Creative[]>('easytracker_list_ads', { period }, 'ads', period);
    }
    if (!data) {
      res.status(502).json({ success: false, error: 'Nenhum dado disponível para exportação' });
      return;
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
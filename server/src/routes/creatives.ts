import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import * as proxy from '../services/EasyTrackerProxy';
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
    const sortBy = (req.query.sortBy as string) || 'spend';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    // Direct pass-through from EasyTracker ads-manager/ads
    const proxyResult = await proxy.getCreatives(beginDate, endDate, {
      search, sortBy, sortOrder, page, pageSize,
    });

    const data: Creative[] = proxyResult.rows.map((r: any) => ({
      id: r.id,
      name: safeStr(r.name),
      status: (r.status as Creative['status']) || 'no_data',
      spend: r.spend || 0,
      cpa: r.cpa || 0,
      roas: r.roas || 0,
      impressions: r.impressions || 0,
      reach: r.reach || 0,
      frequency: r.frequency || 0,
      clicks: r.clicks || 0,
      clicks_all: r.clicks_all || 0,
      ctr: r.ctr || 0,
      cpc: r.cpc || 0,
      cpc_all: r.cpc_all || 0,
      cpm: r.cpm || 0,
      landing_views: r.landing_views || 0,
      cic: r.cic || 0,
      landing_clicks: r.landing_clicks || 0,
      cost_per_checkout: r.cost_per_checkout || 0,
      checkout_rate: r.checkout_rate || 0,
      pixel_purchase: r.pixel_purchase || 0,
      revenue: r.revenue || 0,
      sales: r.sales || 0,
      play_rate: r.play_rate || 0,
      hook_rate: r.hook_rate || 0,
      body_rate: r.body_rate || 0,
      completion_rate: r.completion_rate || 0,
      video_plays: r.video_plays || 0,
      video_views: r.video_views || 0,
      video_25: r.video_25 || 0,
      video_50: r.video_50 || 0,
      video_75: r.video_75 || 0,
      video_100: r.video_100 || 0,
      landing_rate: r.landing_rate || 0,
      avg_watch_time: r.avg_watch_time || 0,
      start_date: r.start_date || '',
      updated_time: r.updated_time || '',
      last_updated: r.last_updated || r.updated_time || '',
    }));

    const total = proxyResult.total;

    // Footer totals
    const footer = {
      spend: data.reduce((s, c) => s + c.spend, 0),
      cpa: data.filter(c => c.cpa > 0).reduce((s, c) => s + c.cpa, 0) / (data.filter(c => c.cpa > 0).length || 1),
      roas: data.reduce((s, c) => s + c.roas, 0) / (data.length || 1),
      impressions: data.reduce((s, c) => s + (c.impressions || 0), 0),
      clicks: data.reduce((s, c) => s + (c.clicks || 0), 0),
      ctr: data.reduce((s, c) => s + (c.ctr || 0), 0) / (data.length || 1),
      cpm: data.reduce((s, c) => s + (c.cpm || 0), 0) / (data.length || 1),
      pixel_purchase: data.reduce((s, c) => s + (c.pixel_purchase || 0), 0),
      revenue: data.reduce((s, c) => s + (c.revenue || 0), 0),
      play_rate: data.reduce((s, c) => s + (c.play_rate || 0), 0) / (data.length || 1),
      body_rate: data.reduce((s, c) => s + (c.body_rate || 0), 0) / (data.length || 1),
      completion_rate: data.reduce((s, c) => s + (c.completion_rate || 0), 0) / (data.length || 1),
    };

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      success: true,
      data,
      meta: { page, pageSize, total, totalPages },
      footer,
      source: 'proxy',
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

    const proxyResult = await proxy.getCreatives(beginDate, endDate, { sortBy: 'spend', sortOrder: 'desc', page: 1, pageSize: 10000 });
    const data = proxyResult.rows;

    const headers = ['Name', 'Status', 'Spent', 'CPA', 'ROAS', 'Impressions', 'Reach', 'Freq.', 'Clicks', 'Clicks (All)', 'CTR', 'CPC', 'CPC (All)', 'CPM', 'Landing Views', 'Cost per Landing', 'Checkouts', 'Cost per Checkout', 'Checkout Rate', 'Pixel Purchase', 'Purchase Value', 'Conv. Rate', 'Play Rate', 'Hook Rate', 'Body Rate', 'Completion Rate', 'Video Plays', 'Video 25%', 'Video 50%', 'Video 75%', 'Video 100%', 'Landing Rate', 'Avg Watch Time', 'Last Updated'];
    const rows = data.map((c: any) => [c.name, c.status, c.spend, c.cpa, c.roas, c.impressions, c.reach, c.frequency, c.clicks, c.clicks_all, c.ctr, c.cpc, c.cpc_all, c.cpm, c.landing_views, c.cic, c.landing_clicks, c.cost_per_checkout, c.checkout_rate, c.pixel_purchase, c.revenue, c.sales, c.play_rate, c.hook_rate, c.body_rate, c.completion_rate, c.video_plays, c.video_25, c.video_50, c.video_75, c.video_100, c.landing_rate, c.avg_watch_time, c.last_updated]);
    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=creatives-report.csv');
    res.send(csvContent);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao exportar: ' + err.message });
  }
});

export default router;
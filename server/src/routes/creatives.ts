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
      creative: safeStr(r.creative || r.name),
      spend: r.spend || 0,
      impressions: r.impressions || 0,
      clicks: r.clicks || 0,
      cpc: r.cpc || 0,
      cpm: r.cpm || 0,
      conversions: r.conversions || r.pixel_purchase || 0,
      cpa: r.cpa || 0,
      checkouts: r.checkouts || r.landing_clicks || 0,
      cost_per_checkout: r.cost_per_checkout || 0,
      profit: r.profit || 0,
      revenue: r.revenue || 0,
      landing_views: r.landing_views || 0,
      cic: r.cic || 0,
      ctr: r.ctr || 0,
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
      pixel_purchase: r.pixel_purchase || 0,
      roas: r.roas || 0,
      avg_watch_time: r.avg_watch_time || 0,
      landing_rate: r.landing_rate || 0,
      checkout_rate: r.checkout_rate || 0,
      quality_ranking: safeStr(r.quality_ranking || ''),
      creative_conversion_rate: r.creative_conversion_rate || 0,
      last_updated: r.last_updated || '',
    }));

    const total = proxyResult.total;

    // Footer totals / averages
    const withValue = (arr: Creative[], key: keyof Creative) => arr.filter(c => (c[key] as number) > 0);
    const avg = (arr: Creative[], key: keyof Creative) =>
      withValue(arr, key).reduce((s, c) => s + ((c[key] as number) || 0), 0) / (withValue(arr, key).length || 1);

    const footer = {
      spend: data.reduce((s, c) => s + c.spend, 0),
      impressions: data.reduce((s, c) => s + (c.impressions || 0), 0),
      clicks: data.reduce((s, c) => s + (c.clicks || 0), 0),
      conversions: data.reduce((s, c) => s + (c.conversions || 0), 0),
      cpa: avg(data, 'cpa'),
      checkouts: data.reduce((s, c) => s + (c.checkouts || 0), 0),
      cost_per_checkout: avg(data, 'cost_per_checkout'),
      profit: data.reduce((s, c) => s + (c.profit || 0), 0),
      revenue: data.reduce((s, c) => s + (c.revenue || 0), 0),
      landing_views: data.reduce((s, c) => s + (c.landing_views || 0), 0),
      cic: avg(data, 'cic'),
      ctr: avg(data, 'ctr'),
      play_rate: avg(data, 'play_rate'),
      hook_rate: avg(data, 'hook_rate'),
      body_rate: avg(data, 'body_rate'),
      completion_rate: avg(data, 'completion_rate'),
      video_plays: data.reduce((s, c) => s + (c.video_plays || 0), 0),
      video_25: data.reduce((s, c) => s + (c.video_25 || 0), 0),
      video_50: data.reduce((s, c) => s + (c.video_50 || 0), 0),
      video_75: data.reduce((s, c) => s + (c.video_75 || 0), 0),
      video_100: data.reduce((s, c) => s + (c.video_100 || 0), 0),
      pixel_purchase: data.reduce((s, c) => s + (c.pixel_purchase || 0), 0),
      roas: avg(data, 'roas'),
      avg_watch_time: avg(data, 'avg_watch_time'),
      landing_rate: avg(data, 'landing_rate'),
      checkout_rate: avg(data, 'checkout_rate'),
      creative_conversion_rate: avg(data, 'creative_conversion_rate'),
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

    const headers = ['Status','AD','Creative','Spent','Impressions','Clicks','CPC','CPM','Conversions','CPA','Init. Checkout','Cost/Checkout','Profit','Revenue','Landing Page Views','Cost/Landing View','CTR','Play Rate','Hook Rate','Body Rate','Completion Rate','Video Plays','Video 25%','Video 50%','Video 75%','Video 100%','Pixel Purchases','ROAS','Avg Watch Time','Landing Rate','Checkout Rate','Quality Ranking','Creative Conv. Rate','Updated At'];
    const rows = data.map((c: any) => [c.status, c.name, c.creative, c.spend, c.impressions, c.clicks, c.cpc, c.cpm, c.conversions, c.cpa, c.checkouts, c.cost_per_checkout, c.profit, c.revenue, c.landing_views, c.cic, c.ctr, c.play_rate, c.hook_rate, c.body_rate, c.completion_rate, c.video_plays, c.video_25, c.video_50, c.video_75, c.video_100, c.pixel_purchase, c.roas, c.avg_watch_time, c.landing_rate, c.checkout_rate, c.quality_ranking, c.creative_conversion_rate, c.last_updated]);
    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=creatives-report.csv');
    res.send(csvContent);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Erro ao exportar: ' + err.message });
  }
});

export default router;
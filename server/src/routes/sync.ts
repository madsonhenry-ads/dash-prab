import { Router, Request, Response } from 'express';
import { cacheService } from '../services/CacheService';

const router = Router();

// POST /api/sync — receives data from local sync script and populates cache
router.post('/', (req: Request, res: Response) => {
  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret) {
    res.status(500).json({ success: false, error: 'SYNC_SECRET não configurado no servidor' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${syncSecret}`) {
    res.status(401).json({ success: false, error: 'SYNC_SECRET inválido' });
    return;
  }

  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ success: false, error: 'Body deve conter { data: { ... } }' });
    return;
  }

  const suffix = `${data.period || 'today'}:${data.account || 'all'}`;
  const now = Date.now();

  // Dashboard KPIs
  if (data.kpis) cacheService.set('kpis', data.kpis, suffix);
  if (data.funnel) cacheService.set('funnel', data.funnel, suffix);
  if (data.salesByHour) cacheService.set('salesByHour', data.salesByHour, suffix);
  if (data.salesByDay) cacheService.set('salesByDay', data.salesByDay, suffix);
  if (data.salesByCountry) cacheService.set('salesByCountry', data.salesByCountry, suffix);
  if (data.salesByPayment) cacheService.set('salesByPayment', data.salesByPayment, suffix);
  if (data.topCampaigns) cacheService.set('topCampaigns', data.topCampaigns, suffix);

  // Campaigns report
  if (data.campaigns) cacheService.set('campaigns', data.campaigns, suffix);
  if (data.adSets) cacheService.set('adSets', data.adSets, suffix);
  if (data.ads) cacheService.set('ads', data.ads, suffix);

  // Creatives
  if (data.creatives) cacheService.set('creatives', data.creatives, suffix);

  // Filters
  if (data.adAccounts) cacheService.set('adAccounts', data.adAccounts);
  if (data.products) cacheService.set('products', data.products);
  if (data.trafficChannels) cacheService.set('trafficChannels', data.trafficChannels);

  res.json({
    success: true,
    data: {
      syncedAt: now,
      keys: Object.keys(data).filter(k => k !== 'period' && k !== 'account'),
    },
  });
});

export default router;
import { Router, Request, Response } from 'express';
import { cacheService } from '../services/CacheService';
import { syncAll } from '../services/SyncService';
import { authMiddleware, AuthRequest } from '../middleware/auth';

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

  // Helper to save under standard cache key
  const save = (key: string, value: any, suffix?: string) => {
    if (value !== undefined && value !== null) cacheService.set(key as any, value, suffix);
  };

  // Save simple keys (period-specific)
  const periodSuffix = data.period ? `${data.period}:${data.account || 'all'}` : undefined;

  // Dashboard KPIs (simple keys)
  save('kpis', data.kpis, periodSuffix);
  save('funnel', data.funnel, periodSuffix);
  save('salesByHour', data.salesByHour, periodSuffix);
  save('salesByDay', data.salesByDay, periodSuffix);
  save('salesByCountry', data.salesByCountry, periodSuffix);
  save('salesByPayment', data.salesByPayment, periodSuffix);
  save('topCampaigns', data.topCampaigns, periodSuffix);

  // Campaigns report (simple keys)
  save('campaigns', data.campaigns, periodSuffix);
  save('adSets', data.adSets, periodSuffix);
  if (data.ads) cacheService.set('ads', data.ads, periodSuffix);
  if (data.creatives) cacheService.set('creatives', data.creatives, periodSuffix);

  // Filters (no period suffix — global)
  save('adAccounts', data.adAccounts);
  save('products', data.products);
  save('trafficChannels', data.trafficChannels);

  // Also save period-suffixed keys (e.g. kpis_last_7, campaigns_last_30)
  const periods = ['today', 'yesterday', 'last_7', 'last_30'];
  for (const period of periods) {
    const suffix = `${period}:${data.account || 'all'}`;
    save('kpis', data[`kpis_${period}`], suffix);
    save('funnel', data[`funnel_${period}`], suffix);
    save('salesByHour', data[`salesByHour_${period}`], suffix);
    save('salesByDay', data[`salesByDay_${period}`], suffix);
    save('salesByCountry', data[`salesByCountry_${period}`], suffix);
    save('salesByPayment', data[`salesByPayment_${period}`], suffix);
    save('topCampaigns', data[`topCampaigns_${period}`], suffix);
    save('campaigns', data[`campaigns_${period}`], suffix);
    save('adSets', data[`adSets_${period}`], suffix);
    save('ads', data[`ads_${period}`], suffix);
    save('creatives', data[`creatives_${period}`], suffix);
  }

  res.json({
    success: true,
    data: {
      syncedAt: Date.now(),
      keys: Object.keys(data).filter(k => k !== 'period' && k !== 'account'),
    },
  });
});

// POST /api/sync/run — trigger sync from EasyTracker API → PostgreSQL + cache
router.post('/run', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await syncAll();
    res.json({ success: result.success, data: result });
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Sync failed: ' + err.message });
  }
});

// GET /api/sync/status — get last sync info
router.get('/status', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const postgresImport = await import('../services/PostgresService');
    const lastSync = await postgresImport.postgresService.queryOne<{ finished_at: string; status: string; total_leads: number; total_purchases: number }>(
      `SELECT finished_at, status, total_leads, total_purchases FROM sync_log ORDER BY finished_at DESC LIMIT 1`
    );
    res.json({
      success: true,
      data: {
        postgresConnected: postgresImport.postgresService.isConnected(),
        lastSync: lastSync || null,
      },
    });
  } catch {
    res.json({ success: true, data: { postgresConnected: false, lastSync: null } });
  }
});

export default router;
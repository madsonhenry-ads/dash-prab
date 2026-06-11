import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import * as proxy from '../services/EasyTrackerProxy';
import { fromCacheOrMCP } from '../services/SyncHelper';
import { postgresService } from '../services/PostgresService';
import * as db from '../services/DbQueries';

const router = Router();

router.get('/ad-accounts', async (_req: AuthRequest, res: any) => {
  try {
    return res.json({ success: true, data: [
      { id: 'et_1', name: 'All Accounts', platform: 'EasyTracker' },
    ]});
  } catch (err: any) {
    res.status(503).json({ success: false, error: err.message });
  }
});

router.get('/products', async (_req: AuthRequest, res: any) => {
  try {
    const data = await proxy.getProducts('2026-01-01', new Date().toISOString().split('T')[0]);
    return res.json({ success: true, data });
  } catch {
    try {
      if (postgresService.isConnected()) {
        const data = await db.getProducts();
        return res.json({ success: true, data });
      }
    } catch {}
    const data = await fromCacheOrMCP<any[]>('products', undefined, 'easytracker_list_offers', {});
    res.json({ success: true, data });
  }
});

router.get('/traffic-channels', async (_req: AuthRequest, res: any) => {
  try {
    const data = await proxy.getTrafficChannels();
    return res.json({ success: true, data });
  } catch {
    try {
      if (postgresService.isConnected()) {
        const data = await db.getTrafficChannels();
        return res.json({ success: true, data });
      }
    } catch {}
    const data = await fromCacheOrMCP<any[]>('trafficChannels', undefined, 'easytracker_list_traffic_channels', {});
    res.json({ success: true, data });
  }
});

export default router;
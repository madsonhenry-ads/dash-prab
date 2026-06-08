import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { cacheService } from '../services/CacheService';
import { fromCacheOrMCP } from '../services/SyncHelper';

const router = Router();

router.get('/ad-accounts', async (_req: AuthRequest, res: any) => {
  try {
    const data = await fromCacheOrMCP<any[]>('adAccounts', undefined, 'easytracker_list_ad_accounts', {});
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(503).json({ success: false, error: err.message });
  }
});

router.get('/products', async (_req: AuthRequest, res: any) => {
  try {
    const data = await fromCacheOrMCP<any[]>('products', undefined, 'easytracker_list_offers', {});
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(503).json({ success: false, error: err.message });
  }
});

router.get('/traffic-channels', async (_req: AuthRequest, res: any) => {
  try {
    const data = await fromCacheOrMCP<any[]>('trafficChannels', undefined, 'easytracker_list_traffic_channels', {});
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(503).json({ success: false, error: err.message });
  }
});

export default router;
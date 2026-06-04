import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { mcpService } from '../services/McpService';
import { cacheService } from '../services/CacheService';

const router = Router();

router.get('/ad-accounts', async (_req: AuthRequest, res: any) => {
  try {
    let data = cacheService.get('adAccounts');
    if (!data) {
      data = await mcpService.callTool('easytracker_list_ad_accounts');
      cacheService.set('adAccounts', data);
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

router.get('/products', async (_req: AuthRequest, res: any) => {
  try {
    let data = cacheService.get('products');
    if (!data) {
      data = await mcpService.callTool('easytracker_list_offers');
      cacheService.set('products', data);
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

router.get('/traffic-channels', async (_req: AuthRequest, res: any) => {
  try {
    let data = cacheService.get('trafficChannels');
    if (!data) {
      data = await mcpService.callTool('easytracker_list_traffic_channels');
      cacheService.set('trafficChannels', data);
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

export default router;
import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import * as proxy from '../services/EasyTrackerProxy';
import { fromCacheOrMCP } from '../services/SyncHelper';
import { postgresService } from '../services/PostgresService';
import * as db from '../services/DbQueries';

const router = Router();

function safeStr(v: any, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

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
    // Ensure all items have properly mapped {id, name, price} shape
    const safe = ((data as any[]) || []).map((o: any) => ({
      id: String(o.id || o.offer_id || ''),
      name: safeStr(o.name) || `Product ${o.id || ''}`,
      price: parseFloat(o.avg_ticket || o.price || 0),
    }));
    res.json({ success: true, data: safe });
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
    // Ensure safe {id, name, platform} shape
    const safe = ((data as any[]) || []).map((t: any) => ({
      id: String(t.id || t.traffic_channel_id?.value || ''),
      name: safeStr(t.name) || 'Unknown',
      platform: safeStr(t.platform || t.name) || '',
    }));
    res.json({ success: true, data: safe });
  }
});

export default router;
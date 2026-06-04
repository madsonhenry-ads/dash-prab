import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { cacheService } from '../services/CacheService';

const router = Router();

router.post('/invalidate', (req: AuthRequest, res: any) => {
  const { key } = req.body;
  cacheService.invalidate(key || undefined);
  const status = cacheService.getStatus();
  res.json({ success: true, data: { message: 'Cache invalidado', status } });
});

router.get('/status', (_req: AuthRequest, res: any) => {
  const status = cacheService.getStatus();
  res.json({ success: true, data: status });
});

export default router;
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const validPassword = process.env.DASHBOARD_PASSWORD || 'admin123';

  if (!password || password !== validPassword) {
    res.status(401).json({ success: false, error: 'Senha incorreta' });
    return;
  }

  const secret = process.env.JWT_SECRET || 'trafficboard-secret-dev';
  const token = jwt.sign({ userId: 'admin', role: 'viewer' }, secret, { expiresIn: '8h' });

  res.json({ success: true, data: { token, expiresIn: 28800 } });
});

router.post('/check', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.json({ success: true, data: { valid: false } });
    return;
  }

  const secret = process.env.JWT_SECRET || 'trafficboard-secret-dev';
  try {
    jwt.verify(authHeader.split(' ')[1], secret);
    res.json({ success: true, data: { valid: true } });
  } catch {
    res.json({ success: true, data: { valid: false } });
  }
});

export default router;
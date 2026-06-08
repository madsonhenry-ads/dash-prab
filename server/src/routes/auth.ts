import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  generatePKCE,
  getAuthorizationUrl,
  storePKCE,
  consumePKCE,
  exchangeCodeForToken,
  getAccessToken,
  isAuthenticated,
} from '../services/EasyTrackerAuth';

const router = Router();

// Dashboard password login
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

// --- EasyTracker OAuth 2.1 with PKCE ---

// GET /api/auth/easytracker/login — redirects to EasyTracker authorization page
router.get('/easytracker/login', (req: Request, res: Response) => {
  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = jwt.sign({ userId: 'admin' }, process.env.JWT_SECRET || 'trafficboard-secret-dev', { expiresIn: '10m' });

  storePKCE(state, codeVerifier);

  const authUrl = getAuthorizationUrl(state, codeChallenge);
  res.redirect(authUrl);
});

// GET /api/auth/easytracker/callback — EasyTracker redirects here after authorization
router.get('/easytracker/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      res.redirect(`/?error=${oauthError}`);
      return;
    }

    if (!code || !state) {
      res.redirect('/?error=missing_params');
      return;
    }

    const pkce = consumePKCE(state as string);
    if (!pkce) {
      res.redirect('/?error=invalid_state');
      return;
    }

    const token = await exchangeCodeForToken(code as string, pkce.codeVerifier);
    console.log('[Auth] EasyTracker OAuth successful!');

    // Redirect to the dashboard frontend
    res.redirect('/');
  } catch (err: any) {
    console.error('[Auth] OAuth callback error:', err.message);
    res.redirect(`/?error=oauth_failed&message=${encodeURIComponent(err.message)}`);
  }
});

// GET /api/auth/easytracker/status — check EasyTracker auth status
router.get('/easytracker/status', (_req: Request, res: Response) => {
  const authenticated = isAuthenticated();
  const hasEnvToken = !!process.env.EASYTRACKER_ACCESS_TOKEN;

  res.json({
    success: true,
    data: {
      authenticated,
      configured: hasEnvToken || authenticated,
      mode: process.env.MCP_MOCK === 'true' ? 'mock' : 'real',
    },
  });
});

export default router;
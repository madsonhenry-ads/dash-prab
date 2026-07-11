/**
 * EasyTrackerAutoLogin — automatic token refresh via email/password login.
 *
 * Instead of relying on a manually-set EASYTRACKER_ACCESS_TOKEN env var
 * that expires, this service logs in with email/password and caches
 * the resulting JWT in memory. The token is refreshed automatically
 * when it expires or when a 401 is encountered.
 *
 * Required env vars:
 *   EASYTRACKER_EMAIL    — account email
 *   EASYTRACKER_PASSWORD — account password
 *
 * Token validity: ~50 days (Max-Age=4320000 from Set-Cookie)
 * Auto-refresh: 7 days before expiry (safety margin)
 */

const LOGIN_URL = 'https://api.easytracker.digital/api/auth/action/login';

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;

/**
 * Decode JWT exp claim (seconds) to epoch ms.
 */
function getTokenExpiry(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 0;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Login to EasyTracker and return a fresh JWT.
 * Throws if credentials are missing or login fails.
 */
export async function loginToEasyTracker(): Promise<string> {
  const email = process.env.EASYTRACKER_EMAIL;
  const password = process.env.EASYTRACKER_PASSWORD;

  if (!email || !password) {
    throw new Error('EASYTRACKER_EMAIL/EASYTRACKER_PASSWORD not configured');
  }

  const resp = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-id': '111127',
      Origin: 'https://app.easytracker.digital',
      Accept: 'application/json',
      'User-Agent': 'TrafficBoard/1.0',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`EasyTracker login failed (${resp.status}): ${text}`);
  }

  // Token comes in Set-Cookie: tracker_token=eyJ...
  const setCookie = resp.headers.get('set-cookie') || '';
  const match = setCookie.match(/tracker_token=([^;]+)/);
  if (!match) {
    throw new Error('EasyTracker login succeeded but no tracker_token in Set-Cookie');
  }

  const token = match[1];
  const expiresAt = getTokenExpiry(token);

  cachedToken = { token, expiresAt };
  console.log(`[AutoLogin] Token acquired, expires: ${expiresAt ? new Date(expiresAt).toISOString() : 'unknown'}`);

  return token;
}

/**
 * Get a valid access token, logging in if needed.
 * Auto-refreshes 7 days before expiry (safety margin for 50-day tokens).
 */
export async function getValidAccessToken(): Promise<string> {
  const SAFETY_MARGIN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  if (cachedToken && cachedToken.expiresAt) {
    if (Date.now() < cachedToken.expiresAt - SAFETY_MARGIN_MS) {
      return cachedToken.token;
    }
    console.log('[AutoLogin] Token nearing expiry, refreshing...');
  }

  return loginToEasyTracker();
}

/**
 * Force a fresh login (e.g., after a 401).
 */
export async function forceRefresh(): Promise<string> {
  cachedToken = null;
  return loginToEasyTracker();
}

/**
 * Check if auto-login is configured (email/password set).
 */
export function isAutoLoginConfigured(): boolean {
  return !!(process.env.EASYTRACKER_EMAIL && process.env.EASYTRACKER_PASSWORD);
}

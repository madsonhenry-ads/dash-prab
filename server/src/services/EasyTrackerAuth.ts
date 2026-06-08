import crypto from 'crypto';

const CLIENT_ID = process.env.EASYTRACKER_CLIENT_ID || 'e145f0b5-0bbc-44b8-ac1b-9125f38abc29';
const AUTH_URL = 'https://api.easytracker.digital/api/oauth/mcp/authorize';
const TOKEN_URL = 'https://api.easytracker.digital/api/oauth/mcp/token';
const REDIRECT_URI = process.env.EASYTRACKER_REDIRECT_URI
  || (process.env.RAILWAY_PUBLIC_URL
    ? `${process.env.RAILWAY_PUBLIC_URL}/api/auth/easytracker/callback`
    : 'http://localhost:3001/api/auth/easytracker/callback');

// In-memory token store (persisted to file in production)
interface TokenStore {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}
let tokenStore: TokenStore | null = null;

// PKCE store — maps state -> codeVerifier
const pkceStore = new Map<string, { codeVerifier: string; redirectTo?: string }>();

function base64URLEncode(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function generatePKCE() {
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = base64URLEncode(hash);
  return { codeVerifier, codeChallenge };
}

export function getAuthorizationUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: REDIRECT_URI,
    state,
    scope: 'tracker:read reports:read ads_manager:read',
    resource: process.env.EASYTRACKER_MCP_URL || 'https://api.easytracker.digital/api/mcp/v1',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function storePKCE(state: string, codeVerifier: string, redirectTo?: string) {
  pkceStore.set(state, { codeVerifier, redirectTo });
  // Auto-clean after 10 minutes
  setTimeout(() => pkceStore.delete(state), 600000);
}

export function consumePKCE(state: string): { codeVerifier: string; redirectTo?: string } | null {
  const entry = pkceStore.get(state);
  if (!entry) return null;
  pkceStore.delete(state);
  return entry;
}

export async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenStore> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
  });

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const store: TokenStore = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };

  tokenStore = store;

  // Also write to .env in the server directory for persistence
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../../.env');
    let envContent = '';
    try { envContent = fs.readFileSync(envPath, 'utf-8'); } catch {}

    const setEnv = (key: string, val: string) => {
      const re = new RegExp(`^${key}=.*$`, 'm');
      if (re.test(envContent)) {
        envContent = envContent.replace(re, `${key}=${val}`);
      } else {
        envContent += `\n${key}=${val}`;
      }
    };

    setEnv('EASYTRACKER_ACCESS_TOKEN', data.access_token);
    if (data.refresh_token) setEnv('EASYTRACKER_REFRESH_TOKEN', data.refresh_token);

    fs.writeFileSync(envPath, envContent, 'utf-8');
    console.log('[EasyTrackerAuth] Tokens saved to .env');
  } catch (err) {
    console.warn('[EasyTrackerAuth] Could not persist tokens:', err);
  }

  return store;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!tokenStore?.refreshToken) return null;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenStore.refreshToken,
    client_id: CLIENT_ID,
  });

  try {
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    tokenStore.accessToken = data.access_token;
    if (data.refresh_token) tokenStore.refreshToken = data.refresh_token;
    if (data.expires_in) tokenStore.expiresAt = Date.now() + data.expires_in * 1000;

    return data.access_token;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  // Check env first (for Railway)
  const envToken = process.env.EASYTRACKER_ACCESS_TOKEN;
  if (envToken) return envToken;

  // Then check in-memory store
  if (tokenStore?.accessToken) {
    // Auto-refresh if expiring in 5 min
    if (tokenStore.expiresAt && Date.now() > tokenStore.expiresAt - 300000) {
      refreshAccessToken().catch(() => {});
    }
    return tokenStore.accessToken;
  }

  return null;
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
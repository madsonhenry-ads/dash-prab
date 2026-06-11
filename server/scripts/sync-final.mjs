/**
 * Sync EasyTracker -> Railway (full OAuth flow)
 *
 * Implementa OAuthClientProvider completo para o MCP SDK.
 * O SDK faz registro dinâmico + PKCE + abre o navegador.
 *
 * Uso: node scripts/sync-final.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { randomBytes } from 'crypto';
import { createServer } from 'http';
import { open } from 'fs';

const MCP_URL = 'https://api.easytracker.digital/api/mcp/v1';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dash-prab-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || '73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310';

class SimpleAuthProvider {
  constructor() {
    this._tokens = undefined;
    this._clientInfo = undefined;
    this._codeVerifier = undefined;
  }

  get redirectUrl() {
    return `http://localhost:42069/callback`;
  }

  get clientMetadata() {
    return {
      client_name: 'trafficboard-sync',
      redirect_uris: [this.redirectUrl],
    };
  }

  clientInformation() {
    return this._clientInfo;
  }

  saveClientInformation(info) {
    this._clientInfo = info;
    console.log(`[auth] Client registered: ${info.client_id}`);
  }

  tokens() {
    return this._tokens;
  }

  saveTokens(tokens) {
    this._tokens = tokens;
    console.log('[auth] Tokens saved');
  }

  redirectToAuthorization(url) {
    console.log('\n=== AUTHORIZE ===');
    console.log('Abra este link no navegador:');
    console.log(url.toString());
    console.log('=================\n');
  }

  saveCodeVerifier(verifier) {
    this._codeVerifier = verifier;
  }

  codeVerifier() {
    return this._codeVerifier;
  }
}

async function callMCP(client, name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  return r;
}

async function main() {
  console.log('Conectando ao EasyTracker via MCP SDK...\n');

  const authProvider = new SimpleAuthProvider();
  const client = new Client(
    { name: 'trafficboard-sync', version: '1.0.0' },
    { capabilities: {} }
  );
  const transport = new StreamableHTTPClientTransport(
    new URL(MCP_URL),
    { authProvider }
  );

  await client.connect(transport);
  console.log('Conectado ao EasyTracker!\n');

  const data = { period: 'today', account: 'all' };

  // 1. Dashboard report
  console.log('Buscando dashboard...');
  try {
    const r = await callMCP(client, 'easytracker_get_dashboard_report', { period: 'today' });
    if (r.content?.[0]?.text) {
      const p = JSON.parse(r.content[0].text);
      data.kpis = p.kpis || p;
      data.funnel = p.funnel;
      data.salesByHour = p.salesByHour;
      data.salesByDay = p.salesByDay;
      data.salesByCountry = p.salesByCountry;
      data.salesByPayment = p.salesByPayment;
      console.log('  Dashboard OK');
    }
  } catch (e) { console.log(`  Dashboard falhou: ${e.message}`); }

  // 2. Campaigns
  console.log('Buscando campanhas...');
  try {
    const r = await callMCP(client, 'easytracker_list_campaigns', {});
    if (r.content?.[0]?.text) {
      const campaigns = JSON.parse(r.content[0].text);
      data.campaigns = campaigns;
      console.log(`  ${campaigns.length} campanhas`);
    }
  } catch (e) { console.log(`  Campanhas falhou: ${e.message}`); }

  // 3. Ad Sets
  console.log('Buscando ad sets...');
  try {
    const r = await callMCP(client, 'easytracker_list_ad_sets', {});
    if (r.content?.[0]?.text) {
      const adsets = JSON.parse(r.content[0].text);
      data.adSets = adsets;
      console.log(`  ${adsets.length} ad sets`);
    }
  } catch (e) { console.log(`  Ad sets falhou: ${e.message}`); }

  // 4. Ads / Creatives
  console.log('Buscando criativos...');
  try {
    const r = await callMCP(client, 'easytracker_list_ads', { period: 'today' });
    if (r.content?.[0]?.text) {
      const ads = JSON.parse(r.content[0].text);
      data.ads = ads;
      data.creatives = ads;
      console.log(`  ${ads.length} criativos`);
    }
  } catch (e) { console.log(`  Criativos falhou: ${e.message}`); }

  // 5. Ad Accounts
  console.log('Buscando contas...');
  try {
    const r = await callMCP(client, 'easytracker_list_ad_accounts', {});
    if (r.content?.[0]?.text) {
      const accounts = JSON.parse(r.content[0].text);
      data.adAccounts = accounts;
      console.log(`  ${accounts.length} contas`);
    }
  } catch (e) { console.log(`  Contas falhou: ${e.message}`); }

  // 6. Products/Offers
  console.log('Buscando produtos...');
  try {
    const r = await callMCP(client, 'easytracker_list_offers', {});
    if (r.content?.[0]?.text) {
      const products = JSON.parse(r.content[0].text);
      data.products = products;
      console.log(`  ${products.length} produtos`);
    }
  } catch (e) { console.log(`  Produtos falhou: ${e.message}`); }

  // 7. Traffic Channels
  console.log('Buscando canais...');
  try {
    const r = await callMCP(client, 'easytracker_list_traffic_channels', {});
    if (r.content?.[0]?.text) {
      const channels = JSON.parse(r.content[0].text);
      data.trafficChannels = channels;
      console.log(`  ${channels.length} canais`);
    }
  } catch (e) { console.log(`  Canais falhou: ${e.message}`); }

  // Sync to Railway
  console.log('\nEnviando para Railway...');
  const resp = await fetch(`${RAILWAY_URL}/api/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SYNC_SECRET}`,
    },
    body: JSON.stringify({ data }),
  });

  if (!resp.ok) {
    console.error(`Sync falhou: ${await resp.text()}`);
    process.exit(1);
  }

  const result = await resp.json();
  console.log('Sync concluido com sucesso!');
  console.log(`Dados enviados: ${result.data.keys.join(', ')}`);
  console.log(`Sync em: ${new Date(result.data.syncedAt).toLocaleString('pt-BR')}`);

  await client.close();
}

main().catch(err => {
  console.error(`\nErro: ${err.message}`);
  process.exit(1);
});
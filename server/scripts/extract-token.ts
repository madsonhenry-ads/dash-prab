/**
 * Extrai o token de acesso do EasyTracker usando o MCP SDK.
 * Executa o fluxo OAuth localmente e printa o token.
 *
 * Run: npx tsx scripts/extract-token.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = 'https://api.easytracker.digital/api/mcp/v1';

async function main() {
  const client = new Client(
    { name: 'trafficboard-token-extractor', version: '1.0.0' },
    { capabilities: {} }
  );

  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: {
      headers: {
        'User-Agent': 'trafficboard/1.0'
      }
    }
  });

  // Monkey-patch the auth provider to intercept token storage
  const ap = transport as any;
  const origConnect = ap._connect || ap.connect;

  // Listen for OAuth tokens at the auth provider level
  if (ap.authProvider) {
    const origSetTokens = ap.authProvider.setTokens;
    ap.authProvider.setTokens = function(tokens: any) {
      console.log('=== TOKENS RECEBIDOS ===');
      console.log(`EASYTRACKER_ACCESS_TOKEN="${tokens.accessToken}"`);
      if (tokens.refreshToken) {
        console.log(`EASYTRACKER_REFRESH_TOKEN="${tokens.refreshToken}"`);
      }
      console.log('========================');

      if (origSetTokens) {
        return origSetTokens.call(this, tokens);
      }
    };
  }

  console.log('🔌 Conectando ao EasyTracker MCP...');
  console.log('   O navegador vai abrir para autorização.');
  console.log('   Após autorizar, os tokens aparecerão abaixo.\n');

  await client.connect(transport);

  console.log('\n✅ Conectado! Testando acesso...\n');

  const tools = await client.listTools();
  console.log(`📦 ${tools.tools.length} tools disponíveis`);

  await client.close();
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
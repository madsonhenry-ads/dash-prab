import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.env.EASYTRACKER_MCP_URL || 'https://api.easytracker.digital/api/mcp/v1';

async function main() {
  const client = new Client({ name: 'token-getter', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(url));

  console.log('🔌 Conectando ao EasyTracker MCP...');
  console.log('   O navegador vai abrir para autorização. Faça login e autorize.\n');

  // Intercept token storage before connection
  const origSet = transport.authProvider?.setTokens;
  if (transport.authProvider) {
    transport.authProvider.setTokens = function(tokens: any) {
      console.log('\n✅ Tokens recebidos!');
      console.log('\nCopie para o Railway:\n');
      console.log(`EASYTRACKER_ACCESS_TOKEN="${tokens.accessToken}"`);
      if (tokens.refreshToken) {
        console.log(`EASYTRACKER_REFRESH_TOKEN="${tokens.refreshToken}"`);
      }
      if (tokens.expiresAt) {
        const min = Math.round((tokens.expiresAt - Date.now()) / 60000);
        console.log(`\n⏰ Expira em ${min} minutos`);
      }
      return origSet?.call(transport.authProvider, tokens);
    };
  }

  await client.connect(transport);
  console.log('✅ Conexão MCP estabelecida com sucesso!');

  const tools = await client.listTools();
  console.log(`📦 ${tools.tools.length} tools disponíveis`);
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
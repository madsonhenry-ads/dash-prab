// Run: npx tsx scripts/mcp-auth.ts
// Uses the MCP SDK OAuth flow to get a token

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = 'https://api.easytracker.digital/api/mcp/v1';

async function main() {
  const client = new Client({ name: 'token-getter', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(url));

  console.log('🔌 Conectando ao EasyTracker MCP...');
  console.log('   Se o navegador abrir para autorização, faça login e autorize.\n');

  await client.connect(transport);

  console.log('✅ Conectado!');

  // Now get token - the transport stores auth info
  // Try to list tools to confirm auth
  const tools = await client.listTools();
  console.log(`📦 Tools disponíveis: ${tools.tools.length}`);

  // Try to get token from internal state
  // The SDK stores it in the transport
  const authToken = (transport as any).authProvider?.tokens?.accessToken;
  const refreshToken = (transport as any).authProvider?.tokens?.refreshToken;

  if (authToken) {
    console.log('\n✅ Token de acesso obtido!');
    console.log('\nCopie para o Railway:\n');
    console.log(`EASYTRACKER_ACCESS_TOKEN="${authToken}"`);
    if (refreshToken) {
      console.log(`EASYTRACKER_REFRESH_TOKEN="${refreshToken}"`);
    }
  } else {
    console.log('\n⚠️ Não foi possível extrair o token diretamente.');
    console.log('Verifique se a autenticação foi concluída com sucesso.');
  }

  await client.close();
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { cacheService } from './CacheService';
import { getAccessToken, refreshAccessToken, isAuthenticated } from './EasyTrackerAuth';
import type { McpTool } from '../types';

class McpRealClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport | null = null;
  private toolsCache: McpTool[] = [];
  private connected = false;

  constructor() {
    this.client = new Client({
      name: 'trafficboard-server',
      version: '1.0.0',
    }, {
      capabilities: {},
    });
  }

  async connect(): Promise<void> {
    const url = process.env.EASYTRACKER_MCP_URL || 'https://api.easytracker.digital/api/mcp/v1';

    // Check if cached
    const cached = cacheService.get<McpTool[]>('tools');
    if (cached) {
      this.toolsCache = cached;
      this.connected = true;
      return;
    }

    const token = getAccessToken();
    if (!token) {
      throw new Error('EasyTracker não autenticado. Acesse /api/auth/easytracker/login para autorizar.');
    }

    try {
      this.transport = new StreamableHTTPClientTransport(new URL(url), {
        requestInit: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      await this.client.connect(this.transport);

      const result = await this.client.listTools();
      this.toolsCache = result.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));

      cacheService.set('tools', this.toolsCache);
      this.connected = true;
    } catch (err) {
      this.connected = false;
      throw err;
    }
  }

  async callTool(name: string, args?: Record<string, any>): Promise<any> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args,
      });

      // Parse content from MCP response
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find(c => c.type === 'text');
        if (textContent?.text) {
          try {
            return JSON.parse(textContent.text);
          } catch {
            return textContent.text;
          }
        }
      }
      return result;
    } catch (err: any) {
      // If unauthorized, try refreshing the token and reconnecting
      if (err.message?.includes('401') || err.message?.includes('unauthorized') || err.message?.includes('invalid_token')) {
        console.log('[MCP] Token expired, attempting refresh...');
        const newToken = await refreshAccessToken();
        if (newToken) {
          this.connected = false;
          await this.connect();
          // Retry the call
          const result = await this.client.callTool({ name, arguments: args });
          if (result.content && Array.isArray(result.content)) {
            const textContent = result.content.find(c => c.type === 'text');
            if (textContent?.text) {
              try { return JSON.parse(textContent.text); } catch { return textContent.text; }
            }
          }
          return result;
        }
      }
      throw err;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getTools(): McpTool[] {
    return this.toolsCache;
  }
}

export { McpRealClient };
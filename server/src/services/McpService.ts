import { McpRealClient } from './McpClient';
import { McpMockService } from './McpMockService';
import type { McpTool } from '../types';

type McpServiceInstance = McpRealClient | McpMockService;

class McpService {
  private service: McpServiceInstance;

  constructor() {
    if (process.env.MCP_MOCK === 'true') {
      console.log('[MCP] Using MOCK service');
      this.service = new McpMockService();
    } else {
      console.log('[MCP] Using REAL MCP client');
      this.service = new McpRealClient();
    }
  }

  async connect(): Promise<void> {
    try {
      await this.service.connect();
      console.log('[MCP] Connected successfully');
    } catch (err) {
      console.error('[MCP] Connection failed:', err);
      throw err;
    }
  }

  async callTool(name: string, args?: Record<string, any>): Promise<any> {
    try {
      return await this.service.callTool(name, args);
    } catch (err: any) {
      console.error(`[MCP] Tool call failed: ${name}`, err.message);
      throw err;
    }
  }

  isConnected(): boolean {
    return this.service.isConnected();
  }

  getTools(): McpTool[] {
    return this.service.getTools();
  }
}

export const mcpService = new McpService();
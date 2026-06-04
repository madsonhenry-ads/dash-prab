import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { mcpService } from '../services/McpService';

const router = Router();

router.get('/status', (_req: AuthRequest, res: any) => {
  const connected = mcpService.isConnected();
  const tools = mcpService.getTools();
  res.json({
    success: true,
    data: {
      connected,
      toolCount: tools.length,
      tools: tools.map(t => t.name),
      mode: process.env.MCP_MOCK === 'true' ? 'mock' : 'real',
    },
  });
});

export default router;
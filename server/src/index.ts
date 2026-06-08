import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { mcpService } from './services/McpService';
import { isAuthenticated } from './services/EasyTrackerAuth';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import campaignsRoutes from './routes/utm';
import creativesRoutes from './routes/creatives';
import filtersRoutes from './routes/filters';
import mcpRoutes from './routes/mcp';
import cacheRoutes from './routes/cache';
import syncRoutes from './routes/sync';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// Health check (public)
app.get('/api/health', (_req, res) => {
  const isMock = process.env.MCP_MOCK === 'true';
  res.json({
    success: true,
    data: {
      status: 'ok',
      version: '1.0.0',
      mcpConnected: isMock || mcpService.isConnected(),
      mcpMode: isMock ? 'mock' : 'real',
      easytrackerAuth: isMock || isAuthenticated(),
      uptime: process.uptime(),
    },
  });
});

// Protected routes
app.use('/api/sync', syncRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/campaigns-report', authMiddleware, campaignsRoutes);
app.use('/api/creatives', authMiddleware, creativesRoutes);
app.use('/api/filters', authMiddleware, filtersRoutes);
app.use('/api/mcp', authMiddleware, mcpRoutes);
app.use('/api/cache', authMiddleware, cacheRoutes);

// Serve static files
const path = require('path');
const fs = require('fs');
const distPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(distPath)) {
  console.log('[Server] Serving static files from', distPath);
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('[Server] Static files not found at', distPath);
}

// Error handler
app.use(errorHandler);

// Start
async function start() {
  try {
    // Connect to MCP (non-blocking)
    mcpService.connect().catch(err => {
      console.warn('[Server] MCP connection failed, will retry on demand:', err.message);
    });

    app.listen(PORT, () => {
      console.log(`[Server] TrafficBoard running on port ${PORT}`);
      console.log(`[Server] MCP mode: ${process.env.MCP_MOCK === 'true' ? 'MOCK' : 'REAL'}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();

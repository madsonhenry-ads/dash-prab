import { mcpService } from './McpService';
import { cacheService } from './CacheService';

/**
 * Tenta chamar MCP primeiro. Se não estiver conectado ou falhar,
 * usa o cache. Se não houver cache, lança erro.
 */
export async function mcpOrCache<T>(
  name: string,
  args: Record<string, any>,
  cacheKey: string,
  suffix?: string
): Promise<T> {
  const cached = cacheService.get<T>(cacheKey as any, suffix);

  if (mcpService.isConnected()) {
    try {
      const result = await mcpService.callTool(name, args);
      return result as T;
    } catch (err) {
      console.warn(`[SyncHelper] MCP call failed for ${name}, using cache:`, (err as Error).message);
      if (cached) return cached;
      throw err;
    }
  }

  if (cached) return cached;
  throw new Error('MCP não conectado. Execute o sync local primeiro ou configure MCP_MOCK=true.');
}

/**
 * Helper que tenta cache primeiro, senão MCP, senão erro.
 */
export async function fromCacheOrMCP<T>(
  cacheKey: string,
  suffix: string | undefined,
  mcpName: string,
  mcpArgs: Record<string, any>
): Promise<T> {
  const cached = cacheService.get<T>(cacheKey as any, suffix);
  if (cached) return cached;

  return mcpOrCache<T>(mcpName, mcpArgs, cacheKey, suffix);
}
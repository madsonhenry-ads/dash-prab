import { mcpService } from './McpService';
import { cacheService } from './CacheService';

/**
 * Tenta cache primeiro, depois MCP. Se nada funcionar,
 * retorna undefined em vez de lançar erro.
 * As rotas que chamam isso devem tratar undefined como "sem dados".
 */
export async function mcpOrCache<T>(
  name: string,
  args: Record<string, any>,
  cacheKey: string,
  suffix?: string
): Promise<T | undefined> {
  const cached = cacheService.get<T>(cacheKey as any, suffix);
  if (cached) return cached;

  if (mcpService.isConnected()) {
    try {
      const result = await mcpService.callTool(name, args);
      return result as T;
    } catch (err) {
      console.warn(`[SyncHelper] MCP call failed for ${name}:`, (err as Error).message);
    }
  }

  return undefined;
}

/**
 * Helper que tenta cache primeiro, senão MCP, senão erro.
 */
export async function fromCacheOrMCP<T>(
  cacheKey: string,
  suffix: string | undefined,
  mcpName: string,
  mcpArgs: Record<string, any>
): Promise<T | undefined> {
  const cached = cacheService.get<T>(cacheKey as any, suffix);
  if (cached) return cached;

  return mcpOrCache<T>(mcpName, mcpArgs, cacheKey, suffix);
}
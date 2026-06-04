import NodeCache from 'node-cache';

type CacheKey = 'tools' | 'kpis' | 'funnel' | 'salesByHour' | 'salesByDay' | 'salesByCountry' | 'salesByPayment' | 'creatives' | 'adAccounts' | 'products' | 'campaigns' | 'adSets' | 'ads' | 'trafficChannels';

const TTL: Record<CacheKey, number> = {
  tools: 86400,
  kpis: 300,
  funnel: 300,
  salesByHour: 300,
  salesByDay: 300,
  salesByCountry: 300,
  salesByPayment: 300,
  creatives: 300,
  adAccounts: 1800,
  products: 1800,
  campaigns: 300,
  adSets: 300,
  ads: 300,
  trafficChannels: 1800,
};

class CacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({ checkperiod: 120 });
  }

  get<T>(key: CacheKey, suffix?: string): T | undefined {
    const fullKey = suffix ? `${key}:${suffix}` : key;
    return this.cache.get<T>(fullKey);
  }

  set<T>(key: CacheKey, value: T, suffix?: string): void {
    const fullKey = suffix ? `${key}:${suffix}` : key;
    const ttl = TTL[key] || 300;
    this.cache.set(fullKey, value, ttl);
  }

  invalidate(key?: CacheKey): void {
    if (key) {
      const keys = this.cache.keys().filter(k => k.startsWith(key));
      keys.forEach(k => this.cache.del(k));
    } else {
      this.cache.flushAll();
    }
  }

  getStatus(): { keys: number; hits: number; misses: number } {
    const stats = this.cache.getStats();
    return {
      keys: this.cache.keys().length,
      hits: stats.hits,
      misses: stats.misses,
    };
  }
}

export const cacheService = new CacheService();
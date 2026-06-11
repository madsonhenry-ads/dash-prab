import { Pool, PoolClient } from 'pg';

class PostgresService {
  private pool: Pool | null = null;
  private connected = false;

  /**
   * Initialize connection pool.
   * In Railway, DATABASE_URL is injected automatically and railway.internal resolves.
   * For local dev, enable Public Network on the Railway Postgres dashboard,
   * or set DATABASE_URL in server/.env with the public connection string.
   */
  connect(): void {
    // Use DATABASE_URL_PUBLIC for local dev (requires Public Network enabled on Railway Postgres),
    // fallback to DATABASE_URL for Railway internal
    const databaseUrl = process.env.DATABASE_URL_PUBLIC || process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.log('[Postgres] No DATABASE_URL configured — skipping');
      return;
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: databaseUrl.includes('railway.internal') ? false : { rejectUnauthorized: false },
    });

    this.pool.on('error', (err) => {
      console.error('[Postgres] Pool error:', err.message);
      this.connected = false;
    });

    // Test connection
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    if (!this.pool) return;
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.connected = true;
      console.log('[Postgres] Connected successfully');
    } catch (err: any) {
      this.connected = false;
      console.warn('[Postgres] Connection failed:', err.message);
      console.warn('[Postgres] For local dev, enable Public Network in Railway Postgres settings');
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool || !this.connected) {
      throw new Error('PostgreSQL não conectado');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows as T[];
    } catch (err: any) {
      console.error('[Postgres] Query error:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Like query() but returns the first row or null.
   */
  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): { connected: boolean; poolSize?: number } {
    if (!this.pool) return { connected: false };
    return {
      connected: this.connected,
      poolSize: this.pool.totalCount,
    };
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      console.log('[Postgres] Disconnected');
    }
  }
}

export const postgresService = new PostgresService();
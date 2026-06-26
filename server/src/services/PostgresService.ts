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
      ssl: databaseUrl.includes('railway.internal') || databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
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

  async ensureSchema(): Promise<void> {
    if (!this.pool || !this.connected) return;
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS tools_expenses (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          value DECIMAL(12,2) NOT NULL,
          date DATE NOT NULL,
          type VARCHAR(20) NOT NULL CHECK (type IN ('occasional', 'recurring')),
          recurring_day INTEGER CHECK (recurring_day BETWEEN 1 AND 31),
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      console.log('[Postgres] Schema ensured (tools_expenses)');
    } catch (err: any) {
      console.warn('[Postgres] Schema init failed:', err.message);
    }
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id UUID PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT DEFAULT '',
          status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
          priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
          assignee VARCHAR(100) DEFAULT '',
          due_date DATE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      console.log('[Postgres] Schema ensured (tasks)');
    } catch (err: any) {
      console.warn('[Postgres] Schema init failed (tasks):', err.message);
    }
    try {
      // v1-v2: ensure all creatives columns exist (both legacy and ads-manager)
      const migrationColumns = [
        // v1 columns (may be missing on older schemas)
        'ADD COLUMN IF NOT EXISTS spend_usd NUMERIC(12,2) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS profit_usd NUMERIC(12,2) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS roas NUMERIC(8,3) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS cpa NUMERIC(10,2) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS hook_rate NUMERIC(6,3) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS lead_to_purchase_cvr NUMERIC(6,3) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS landing_clicks INT DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS landing_views INT DEFAULT 0',
        // v2: ads-manager rich media columns
        'ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'no_data\'',
        'ADD COLUMN IF NOT EXISTS impressions INT DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS reach INT DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS frequency NUMERIC(8,3) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS clicks_all INT DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS cpc_all NUMERIC(10,4) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS cpm NUMERIC(10,4) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS cpc NUMERIC(10,4) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS avg_ticket NUMERIC(10,2) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS bounce_rate NUMERIC(6,3) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS video_plays INT DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS video_views INT DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS video_25 INT DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS video_50 INT DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS video_75 INT DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS video_100 INT DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS avg_watch_time NUMERIC(8,2) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS pixel_purchase INT DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS play_rate NUMERIC(6,3) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS body_rate NUMERIC(6,3) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS completion_rate NUMERIC(6,3) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS landing_rate NUMERIC(6,3) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS checkout_rate NUMERIC(6,3) DEFAULT 0',
        'ADD COLUMN IF NOT EXISTS cost_per_checkout NUMERIC(10,2) DEFAULT 0',
      ];
      for (const col of migrationColumns) {
        await this.pool.query(`ALTER TABLE creatives ${col}`);
      }
      // Indexes for common queries
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_creatives_status ON creatives(status)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_creatives_updated_at ON creatives(updated_at)`);
      console.log('[Postgres] Schema ensured (creatives v2 columns)');
    } catch (err: any) {
      console.warn('[Postgres] Schema init failed (creatives v2):', err.message);
    }
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
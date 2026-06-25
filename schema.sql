-- EasyTracker Dashboard - PostgreSQL Schema
-- Cria todas as tabelas para o dashboard de controle de criativos

-- 1. CREATIVES (Performance por criativo)
CREATE TABLE IF NOT EXISTS creatives (
    id SERIAL PRIMARY KEY,
    creative VARCHAR(100) NOT NULL,
    purchases INT DEFAULT 0,
    revenue_usd NUMERIC(12,2) DEFAULT 0,
    revenue_brl NUMERIC(12,2) DEFAULT 0,
    spend_usd NUMERIC(12,2) DEFAULT 0,
    profit_usd NUMERIC(12,2) DEFAULT 0,
    roas NUMERIC(8,3) DEFAULT 0,
    cpa NUMERIC(10,2) DEFAULT 0,
    ics INT DEFAULT 0,
    clicks INT DEFAULT 0,
    conversion_rate NUMERIC(6,3) DEFAULT 0,
    ic_to_purchase_rate NUMERIC(6,3) DEFAULT 0,
    hook_rate NUMERIC(6,3) DEFAULT 0,
    lead_to_purchase_cvr NUMERIC(6,3) DEFAULT 0,
    campaigns TEXT[] DEFAULT '{}',
    products TEXT[] DEFAULT '{}',
    countries TEXT[] DEFAULT '{}',
    last_sale_date TIMESTAMP,
    first_seen TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    landing_clicks INT DEFAULT 0,
    landing_views INT DEFAULT 0,
    UNIQUE(creative)
);

-- Migration: add missing columns if table already exists
DO $$ BEGIN
  ALTER TABLE creatives ADD COLUMN IF NOT EXISTS spend_usd NUMERIC(12,2) DEFAULT 0;
  ALTER TABLE creatives ADD COLUMN IF NOT EXISTS profit_usd NUMERIC(12,2) DEFAULT 0;
  ALTER TABLE creatives ADD COLUMN IF NOT EXISTS roas NUMERIC(8,3) DEFAULT 0;
  ALTER TABLE creatives ADD COLUMN IF NOT EXISTS cpa NUMERIC(10,2) DEFAULT 0;
  ALTER TABLE creatives ADD COLUMN IF NOT EXISTS hook_rate NUMERIC(6,3) DEFAULT 0;
  ALTER TABLE creatives ADD COLUMN IF NOT EXISTS lead_to_purchase_cvr NUMERIC(6,3) DEFAULT 0;
  ALTER TABLE creatives ADD COLUMN IF NOT EXISTS landing_clicks INT DEFAULT 0;
  ALTER TABLE creatives ADD COLUMN IF NOT EXISTS landing_views INT DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. CLICKS (Leads individuais)
CREATE TABLE IF NOT EXISTS clicks (
    lead_id INT PRIMARY KEY,
    creative VARCHAR(100),
    sub4 VARCHAR(100),
    sub5 VARCHAR(100),
    sub7 VARCHAR(100),
    country VARCHAR(100),
    country_code VARCHAR(10),
    device_type VARCHAR(50),
    device_model VARCHAR(100),
    browser VARCHAR(100),
    landing VARCHAR(200),
    offer_name VARCHAR(200),
    landing_id INT,
    offer_id INT,
    campaign_id INT,
    traffic_channel VARCHAR(200),
    is_ic BOOLEAN DEFAULT FALSE,
    clicked_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT NOW()
);

-- 3. PURCHASES (Postbacks confirmados)
CREATE TABLE IF NOT EXISTS purchases (
    purchase_id INT PRIMARY KEY,
    lead_id INT,
    creative VARCHAR(100),
    campaign VARCHAR(200),
    product VARCHAR(200),
    currency VARCHAR(10),
    value_usd NUMERIC(12,2) DEFAULT 0,
    value_brl NUMERIC(12,2) DEFAULT 0,
    value_gbp NUMERIC(12,2) DEFAULT 0,
    value_eur NUMERIC(12,2) DEFAULT 0,
    value_cad NUMERIC(12,2) DEFAULT 0,
    sub4 VARCHAR(100),
    sub5 VARCHAR(100),
    sub7 VARCHAR(100),
    country VARCHAR(100),
    country_code VARCHAR(10),
    device_type VARCHAR(50),
    device_model VARCHAR(100),
    browser VARCHAR(100),
    landing VARCHAR(200),
    offer_name VARCHAR(200),
    traffic_channel VARCHAR(200),
    purchased_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (lead_id) REFERENCES clicks(lead_id)
);

-- 4. INITIATE CHECKOUTS (ICs sem purchase)
CREATE TABLE IF NOT EXISTS initiate_checkouts (
    lead_id INT PRIMARY KEY,
    creative VARCHAR(100),
    offer VARCHAR(200),
    campaign VARCHAR(200),
    country VARCHAR(100),
    device VARCHAR(50),
    sub4 VARCHAR(100),
    sub5 VARCHAR(100),
    sub7 VARCHAR(100),
    ic_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (lead_id) REFERENCES clicks(lead_id)
);

-- 5. DAILY METRICS
CREATE TABLE IF NOT EXISTS daily_metrics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    clicks INT DEFAULT 0,
    ics INT DEFAULT 0,
    purchases INT DEFAULT 0,
    revenue_usd NUMERIC(12,2) DEFAULT 0,
    revenue_brl NUMERIC(12,2) DEFAULT 0,
    spent_usd NUMERIC(12,2) DEFAULT 0,
    profit_usd NUMERIC(12,2) DEFAULT 0,
    roas NUMERIC(8,3) DEFAULT 0,
    cpa NUMERIC(10,2) DEFAULT 0,
    cpl NUMERIC(10,4) DEFAULT 0,
    unique_creatives INT DEFAULT 0,
    conversion_rate NUMERIC(6,3) DEFAULT 0,
    UNIQUE(date)
);

-- 6. CAMPAIGNS
CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id INT PRIMARY KEY,
    name VARCHAR(200),
    domain VARCHAR(300),
    traffic_channel VARCHAR(200),
    clicks INT DEFAULT 0,
    landing_clicks INT DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    total_revenue NUMERIC(12,2) DEFAULT 0,
    total_purchase INT DEFAULT 0,
    purchase_leads INT DEFAULT 0,
    roas NUMERIC(8,3) DEFAULT 0,
    roi NUMERIC(10,3) DEFAULT 0,
    cpa NUMERIC(10,2) DEFAULT 0,
    cpl NUMERIC(10,4) DEFAULT 0,
    cpc NUMERIC(10,4) DEFAULT 0,
    gross_profit NUMERIC(12,2) DEFAULT 0,
    avg_ticket NUMERIC(10,2) DEFAULT 0,
    funnel_conversion NUMERIC(6,3) DEFAULT 0,
    bounce_rate NUMERIC(6,3) DEFAULT 0,
    synced_at TIMESTAMP DEFAULT NOW()
);

-- 7. OFFERS
CREATE TABLE IF NOT EXISTS offers (
    offer_id INT PRIMARY KEY,
    name VARCHAR(200),
    checkout VARCHAR(200),
    product VARCHAR(200),
    clicks INT DEFAULT 0,
    landing_clicks INT DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    total_revenue NUMERIC(12,2) DEFAULT 0,
    total_purchase INT DEFAULT 0,
    roas NUMERIC(8,3) DEFAULT 0,
    roi NUMERIC(10,3) DEFAULT 0,
    cpa NUMERIC(10,2) DEFAULT 0,
    cpc NUMERIC(10,4) DEFAULT 0,
    gross_profit NUMERIC(12,2) DEFAULT 0,
    avg_ticket NUMERIC(10,2) DEFAULT 0,
    funnel_conversion NUMERIC(6,3) DEFAULT 0,
    epc NUMERIC(10,4) DEFAULT 0,
    purchase_count_api INT DEFAULT 0,
    purchase_value_api NUMERIC(12,2) DEFAULT 0,
    synced_at TIMESTAMP DEFAULT NOW()
);

-- 8. LANDINGS
CREATE TABLE IF NOT EXISTS landings (
    landing_id INT PRIMARY KEY,
    name VARCHAR(200),
    url TEXT,
    clicks INT DEFAULT 0,
    landing_views INT DEFAULT 0,
    landing_clicks INT DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    total_revenue NUMERIC(12,2) DEFAULT 0,
    total_purchase INT DEFAULT 0,
    roas NUMERIC(8,3) DEFAULT 0,
    roi NUMERIC(10,3) DEFAULT 0,
    cpa NUMERIC(10,2) DEFAULT 0,
    cpc NUMERIC(10,4) DEFAULT 0,
    gross_profit NUMERIC(12,2) DEFAULT 0,
    funnel_conversion NUMERIC(6,3) DEFAULT 0,
    bounce_rate NUMERIC(6,3) DEFAULT 0,
    purchase_count_api INT DEFAULT 0,
    purchase_value_api NUMERIC(12,2) DEFAULT 0,
    synced_at TIMESTAMP DEFAULT NOW()
);

-- 9. TRAFFIC CHANNELS
CREATE TABLE IF NOT EXISTS traffic_channels (
    channel_id INT PRIMARY KEY,
    name VARCHAR(200),
    clicks INT DEFAULT 0,
    landing_views INT DEFAULT 0,
    landing_clicks INT DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    total_revenue NUMERIC(12,2) DEFAULT 0,
    total_purchase INT DEFAULT 0,
    roas NUMERIC(8,3) DEFAULT 0,
    roi NUMERIC(10,3) DEFAULT 0,
    cpa NUMERIC(10,2) DEFAULT 0,
    cpc NUMERIC(10,4) DEFAULT 0,
    gross_profit NUMERIC(12,2) DEFAULT 0,
    funnel_conversion NUMERIC(6,3) DEFAULT 0,
    bounce_rate NUMERIC(6,3) DEFAULT 0,
    purchase_count_api INT DEFAULT 0,
    purchase_value_api NUMERIC(12,2) DEFAULT 0,
    synced_at TIMESTAMP DEFAULT NOW()
);

-- 10. COUNTRIES
CREATE TABLE IF NOT EXISTS country_stats (
    id SERIAL PRIMARY KEY,
    country VARCHAR(100) NOT NULL,
    purchases INT DEFAULT 0,
    revenue_usd NUMERIC(12,2) DEFAULT 0,
    clicks INT DEFAULT 0,
    ics INT DEFAULT 0,
    conversion_rate NUMERIC(6,3) DEFAULT 0,
    synced_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(country)
);

-- 11. DEVICES
CREATE TABLE IF NOT EXISTS device_stats (
    id SERIAL PRIMARY KEY,
    device VARCHAR(50) NOT NULL,
    purchases INT DEFAULT 0,
    revenue_usd NUMERIC(12,2) DEFAULT 0,
    clicks INT DEFAULT 0,
    synced_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(device)
);

-- 12. SYNC LOG (para saber quando foi a ultima sync)
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    started_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'running',
    total_leads INT DEFAULT 0,
    total_purchases INT DEFAULT 0,
    total_ics INT DEFAULT 0,
    error_message TEXT
);

-- 13. TOOLS EXPENSES (Cash-book ledger for paid tools)
CREATE TABLE IF NOT EXISTS tools_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    value DECIMAL(12,2) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('occasional', 'recurring')),
    recurring_day INTEGER CHECK (recurring_day BETWEEN 1 AND 31),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. TASKS (Kanban board tasks)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    assignee VARCHAR(100) DEFAULT '',
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDICES para performance
CREATE INDEX IF NOT EXISTS idx_clicks_creative ON clicks(creative);
CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_clicks_country ON clicks(country);
CREATE INDEX IF NOT EXISTS idx_clicks_device ON clicks(device_type);
CREATE INDEX IF NOT EXISTS idx_purchases_creative ON purchases(creative);
CREATE INDEX IF NOT EXISTS idx_purchases_purchased_at ON purchases(purchased_at);
CREATE INDEX IF NOT EXISTS idx_creatives_last_sale ON creatives(last_sale_date);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status);
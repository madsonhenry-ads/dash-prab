"""
EasyTracker -> PostgreSQL Sync
Le o JSON gerado pelo fetch_dashboard.py e insere/atualiza no banco
Railway: usar DATABASE_URL da env var ou configurar manualmente
"""
import json
import os
import sys
from datetime import datetime

# --- CONFIG ---
JSON_FILE = r"C:\Dash-Prab\easytracker_dashboard.json"
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:senha@localhost:5432/easytracker"
)

# --- DB CONNECTION ---
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("[!] psycopg2 nao instalado. Instale com: pip install psycopg2-binary")
    sys.exit(1)

def get_conn():
    return psycopg2.connect(DATABASE_URL)

def load_json():
    if not os.path.exists(JSON_FILE):
        print(f"[!] JSON nao encontrado: {JSON_FILE}")
        print("[!] Execute fetch_dashboard.py primeiro")
        sys.exit(1)
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# ============================================================
# SYNC FUNCTIONS
# ============================================================

def sync_creatives(cur, data):
    creatives = data.get("creatives", [])
    if not creatives:
        return 0
    sql = """
        INSERT INTO creatives
            (creative, purchases, revenue_usd, revenue_brl, ics, clicks,
             conversion_rate, ic_to_purchase_rate, campaigns, products, countries, updated_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, NOW())
        ON CONFLICT (creative) DO UPDATE SET
            purchases = EXCLUDED.purchases,
            revenue_usd = EXCLUDED.revenue_usd,
            revenue_brl = EXCLUDED.revenue_brl,
            ics = EXCLUDED.ics,
            clicks = EXCLUDED.clicks,
            conversion_rate = EXCLUDED.conversion_rate,
            ic_to_purchase_rate = EXCLUDED.ic_to_purchase_rate,
            campaigns = EXCLUDED.campaigns,
            products = EXCLUDED.products,
            countries = EXCLUDED.countries,
            updated_at = NOW()
    """
    count = 0
    for c in creatives:
        if not isinstance(c, dict):
            continue
        cur.execute(sql, (
            c.get("creative", "N/A"),
            c.get("purchases", 0),
            c.get("revenue_usd", 0),
            c.get("revenue_brl", 0),
            c.get("ics", 0),
            c.get("clicks", 0),
            c.get("conversion_rate", 0),
            c.get("ic_to_purchase_rate", 0),
            c.get("campaigns", []),
            c.get("products", []),
            c.get("countries", []),
        ))
        count += 1
    return count

def sync_purchases(cur, data):
    purchases = data.get("purchases", [])
    if not purchases:
        return 0
    sql = """
        INSERT INTO purchases
            (purchase_id, lead_id, creative, campaign, product, currency,
             value_usd, value_brl, value_gbp, value_eur, value_cad,
             sub4, sub5, sub7, country, country_code, device_type,
             device_model, browser, landing, offer_name, traffic_channel, purchased_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (purchase_id) DO UPDATE SET
            creative = EXCLUDED.creative,
            value_usd = EXCLUDED.value_usd,
            value_brl = EXCLUDED.value_brl
    """
    count = 0
    for p in purchases:
        if not isinstance(p, dict):
            continue
        purchased_at = p.get("date")
        if purchased_at:
            purchased_at = purchased_at[:19].replace("T", " ")
        cur.execute(sql, (
            p.get("purchase_id"),
            p.get("lead_id"),
            p.get("creative", "N/A"),
            p.get("campaign"),
            p.get("product"),
            p.get("currency"),
            p.get("value_usd", 0),
            p.get("value_brl", 0),
            p.get("value_gbp", 0),
            p.get("value_eur", 0),
            p.get("value_cad", 0),
            p.get("sub4"),
            p.get("sub5"),
            p.get("sub7"),
            p.get("country"),
            p.get("country_code"),
            p.get("device_type"),
            p.get("device_model"),
            p.get("browser"),
            p.get("landing"),
            p.get("offer_name"),
            p.get("traffic_channel"),
            purchased_at,
        ))
        count += 1
    return count

def sync_daily(cur, data):
    daily = data.get("daily", [])
    if not daily:
        return 0
    sql = """
        INSERT INTO daily_metrics
            (date, clicks, ics, purchases, revenue_usd, revenue_brl,
             unique_creatives, conversion_rate)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (date) DO UPDATE SET
            clicks = EXCLUDED.clicks,
            ics = EXCLUDED.ics,
            purchases = EXCLUDED.purchases,
            revenue_usd = EXCLUDED.revenue_usd,
            revenue_brl = EXCLUDED.revenue_brl,
            unique_creatives = EXCLUDED.unique_creatives,
            conversion_rate = EXCLUDED.conversion_rate
    """
    count = 0
    for d in daily:
        if not isinstance(d, dict):
            continue
        cur.execute(sql, (
            d.get("date"),
            d.get("clicks", 0),
            0,  # ics precisamos calcular separadamente
            d.get("purchases", 0),
            d.get("revenue_usd", 0),
            d.get("revenue_brl", 0),
            d.get("unique_creatives", 0),
            0,
        ))
        count += 1
    return count

def sync_campaigns(cur, data):
    campaigns = data.get("campaigns", [])
    if not campaigns:
        return 0
    sql = """
        INSERT INTO campaigns
            (campaign_id, name, domain, traffic_channel, clicks, landing_clicks,
             total_spent, total_revenue, total_purchase, purchase_leads,
             roas, roi, cpa, cpl, cpc, gross_profit, avg_ticket,
             funnel_conversion, bounce_rate)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (campaign_id) DO UPDATE SET
            name = EXCLUDED.name, total_spent = EXCLUDED.total_spent,
            total_revenue = EXCLUDED.total_revenue, total_purchase = EXCLUDED.total_purchase
    """
    count = 0
    for c in campaigns:
        if not isinstance(c, dict) or not c.get("id"):
            continue
        cur.execute(sql, (
            c["id"], c.get("name"), c.get("domain"), c.get("traffic_channel"),
            c.get("clicks", 0), c.get("landing_clicks", 0),
            c.get("total_spent", 0), c.get("total_revenue", 0),
            c.get("total_purchase", 0), c.get("purchase_leads", 0),
            c.get("roas", 0), c.get("roi", 0), c.get("cpa", 0),
            c.get("cpl", 0), c.get("cpc", 0), c.get("gross_profit", 0),
            c.get("avg_ticket", 0), c.get("funnel_conversion", 0),
            c.get("bounce_rate", 0),
        ))
        count += 1
    return count

def sync_offers(cur, data):
    offers = data.get("offers", [])
    if not offers:
        return 0
    sql = """
        INSERT INTO offers
            (offer_id, name, checkout, product, clicks, landing_clicks,
             total_spent, total_revenue, total_purchase, roas, roi, cpa, cpc,
             gross_profit, avg_ticket, funnel_conversion, epc,
             purchase_count_api, purchase_value_api)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (offer_id) DO UPDATE SET
            total_spent = EXCLUDED.total_spent, total_revenue = EXCLUDED.total_revenue,
            total_purchase = EXCLUDED.total_purchase
    """
    count = 0
    for o in offers:
        if not isinstance(o, dict) or not o.get("id"):
            continue
        cur.execute(sql, (
            o["id"], o.get("name"), o.get("checkout"), o.get("product"),
            o.get("clicks", 0), o.get("landing_clicks", 0),
            o.get("total_spent", 0), o.get("total_revenue", 0),
            o.get("total_purchase", 0), o.get("roas", 0), o.get("roi", 0),
            o.get("cpa", 0), o.get("cpc", 0), o.get("gross_profit", 0),
            o.get("avg_ticket", 0), o.get("funnel_conversion", 0),
            o.get("epc", 0), o.get("purchase_count_api", 0),
            o.get("purchase_value_api", 0),
        ))
        count += 1
    return count

def sync_countries(cur, data):
    countries = data.get("countries", [])
    if not countries:
        return 0
    sql = """
        INSERT INTO country_stats (country, purchases, revenue_usd, clicks, ics, conversion_rate)
        VALUES (%s,%s,%s,%s,%s,%s)
        ON CONFLICT (country) DO UPDATE SET
            purchases = EXCLUDED.purchases, revenue_usd = EXCLUDED.revenue_usd,
            clicks = EXCLUDED.clicks, ics = EXCLUDED.ics,
            conversion_rate = EXCLUDED.conversion_rate
    """
    count = 0
    for c in countries:
        if not isinstance(c, dict):
            continue
        cur.execute(sql, (
            c.get("country"), c.get("purchases", 0), c.get("revenue_usd", 0),
            c.get("clicks", 0), c.get("ics", 0), c.get("cvr", 0),
        ))
        count += 1
    return count

def sync_devices(cur, data):
    devices = data.get("devices", [])
    if not devices:
        return 0
    sql = """
        INSERT INTO device_stats (device, purchases, revenue_usd, clicks)
        VALUES (%s,%s,%s,%s)
        ON CONFLICT (device) DO UPDATE SET
            purchases = EXCLUDED.purchases, revenue_usd = EXCLUDED.revenue_usd,
            clicks = EXCLUDED.clicks
    """
    count = 0
    for d in devices:
        if not isinstance(d, dict):
            continue
        cur.execute(sql, (
            d.get("device"), d.get("purchases", 0),
            d.get("revenue_usd", 0), d.get("clicks", 0),
        ))
        count += 1
    return count

# ============================================================
# MAIN
# ============================================================

def main():
    print(f"[*] Carregando JSON: {JSON_FILE}")
    data = load_json()
    overview = data.get("overview", {})
    print(f"[*] Dados: {overview.get('total_purchases', 0)} purchases, "
          f"{overview.get('total_clicks', 0)} clicks, "
          f"{overview.get('unique_creatives', 0)} criativos")

    conn = get_conn()
    cur = conn.cursor()

    # Start sync log
    cur.execute("INSERT INTO sync_log (started_at, status) VALUES (NOW(), 'running')")
    sync_id = cur.lastrowid if hasattr(cur, 'lastrowid') else None
    conn.commit()

    try:
        print("\n[*] Sincronizando tabelas...")
        n = sync_creatives(cur, data)
        print(f"  [ok] creatives: {n} registros")
        n = sync_purchases(cur, data)
        print(f"  [ok] purchases: {n} registros")
        n = sync_daily(cur, data)
        print(f"  [ok] daily_metrics: {n} registros")
        n = sync_campaigns(cur, data)
        print(f"  [ok] campaigns: {n} registros")
        n = sync_offers(cur, data)
        print(f"  [ok] offers: {n} registros")
        n = sync_countries(cur, data)
        print(f"  [ok] country_stats: {n} registros")
        n = sync_devices(cur, data)
        print(f"  [ok] device_stats: {n} registros")

        # Update sync log success
        cur.execute("""
            UPDATE sync_log SET
                finished_at = NOW(), status = 'success',
                total_leads = %s, total_purchases = %s, total_ics = %s
            WHERE id = %s
        """, (overview.get('total_clicks', 0), overview.get('total_purchases', 0),
              overview.get('initiate_checkouts', 0), sync_id or 1))

        conn.commit()
        print(f"\n[+] Sincronizacao concluida com sucesso!")

    except Exception as e:
        conn.rollback()
        cur.execute("""
            UPDATE sync_log SET finished_at = NOW(), status = 'error', error_message = %s
            WHERE id = %s
        """, (str(e), sync_id or 1))
        conn.commit()
        print(f"\n[!] Erro na sincronizacao: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
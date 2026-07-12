"""
EasyTracker Dashboard Data Extractor v2
Gera JSON completo com dados reais de GASTO, revenue, ROAS por criativo
Usa os endpoints:
  - reports/campaigns/{id}?groupings[]=sub6 → metrics por criativo (com spend!)
  - ads-manager/accounts → video metrics hook/hold rate
  - leads, checkouts-postback, campaigns, offers → dados base
"""
import json
import urllib.request
import urllib.error
import sys
import os
from datetime import datetime, timedelta

TOKEN_FILE = r"C:\Dash-Prab\.et_token"
if not os.path.exists(TOKEN_FILE):
    print("Token nao encontrado. Rode o fluxo de autenticacao primeiro.")
    sys.exit(1)

TOKEN = open(TOKEN_FILE).read().strip()
BASE = "https://api.easytracker.digital/api"
HEADERS = {
    "Authorization": "Bearer " + TOKEN,
    "x-app-id": "111127",
    "Origin": "https://app.easytracker.digital",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://app.easytracker.digital/",
}

# Date range: last 10 days
end_date = datetime.now()
start_date = end_date - timedelta(days=10)
DATE_PARAMS = f"beginDate={start_date.strftime('%Y-%m-%d')}&endDate={end_date.strftime('%Y-%m-%d')}"

print(f"[*] Extracting data from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")

def api_get(endpoint, params=""):
    url = f"{BASE}/{endpoint}?{params}&{DATE_PARAMS}".replace("?&", "?")
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  [!] Error {endpoint}: {e}")
        return {"data": []}

def paginate(endpoint, params="", per_page=100):
    all_data = []
    page = 1
    while True:
        full_params = f"{params}&per_page={per_page}&page={page}"
        result = api_get(endpoint, full_params)
        data = result.get("data", [])
        if not data:
            break
        all_data.extend(data)
        meta = result.get("meta", {})
        if page >= meta.get("last_page", 1):
            break
        page += 1
        if page % 10 == 0:
            print(f"  ... page {page}")
    print(f"  [ok] {endpoint}: {len(all_data)} records ({page} pages)")
    return all_data

# ============================================================
# 1. FETCH ALL DATA
# ============================================================
print("\n[1] Fetching base data from EasyTracker API...")

postbacks = api_get("checkouts-postback", "per_page=200")
all_postbacks = postbacks.get("data", [])
purchases = [p for p in all_postbacks if p.get("type") == "Purchase"]
cancelled = [p for p in all_postbacks if p.get("type") == "cancelled"]
rejected_ps = [p for p in all_postbacks if p.get("type") == "rejected"]
print(f"  [ok] checkouts-postback: {len(all_postbacks)} total ({len(purchases)} purchases)")

all_leads = paginate("leads")
lead_map = {l["id"]: l for l in all_leads}

campaigns = api_get("campaigns").get("data", [])
print(f"  [ok] campaigns: {len(campaigns)}")

offers = api_get("offers").get("data", [])
print(f"  [ok] offers: {len(offers)}")

# ============================================================
# 2. NEW: REPORTS BY CAMPAIGN (spend per creative!)
# ============================================================
print("\n[2] Fetching per-creative spend from reports/campaigns...")

creative_report = {}  # sub6 -> metrics
for camp in campaigns:
    camp_id = camp.get("id")
    if not camp_id:
        continue
    try:
        result = api_get(f"reports/campaigns/{camp_id}", "groupings[]=sub6")
        items = result.get("data", [])
        for item in items:
            sub6 = item.get("sub6", "").strip()
            if not sub6:
                continue
            if sub6 not in creative_report:
                creative_report[sub6] = {
                    "spend": 0, "revenue": 0, "gross_profit": 0,
                    "roas": 0, "roi": 0, "cpa": 0, "cpc": 0,
                    "clicks": 0, "landing_views": 0, "landing_clicks": 0,
                    "purchases": 0, "bounce_rate": 0,
                    "lead_to_purchase_cvr": 0, "avg_ticket": 0,
                    "campaign_names": set(),
                }
            cr = creative_report[sub6]
            cr["spend"] += float(item.get("total_spent", 0))
            cr["revenue"] += float(item.get("total_revenue", 0))
            cr["gross_profit"] += float(item.get("gross_profit", 0))
            cr["roas"] = cr["revenue"] / cr["spend"] if cr["spend"] > 0 else 0
            cr["clicks"] += int(item.get("clicks", 0))
            cr["landing_views"] += int(item.get("landing_views", 0))
            cr["landing_clicks"] += int(item.get("landing_clicks", 0))
            cr["purchases"] += int(item.get("custom_purchase_count", 0))
            cr["bounce_rate"] = max(cr.get("bounce_rate", 0), float(item.get("bounce_rate", 0)))
            cr["avg_ticket"] = max(cr.get("avg_ticket", 0), float(item.get("avg_ticket", 0)))
            cr["cpc"] = cr["spend"] / cr["clicks"] if cr["clicks"] > 0 else 0
            cr["lead_to_purchase_cvr"] = max(cr.get("lead_to_purchase_cvr", 0),
                float(item.get("lead_to_purchase_conversion", 0)))
            # Get campaign name from the traffic_channel_settings meta
            meta = result.get("meta", {})
            tcs = meta.get("traffic_channel_settings", {})
            camp_name = tcs.get("name", "") or tcs.get("utm_campaign", "")
            if camp_name:
                cr["campaign_names"].add(camp_name)
    except Exception as e:
        print(f"  [!] Skipping campaign {camp_id}: {e}")

print(f"  [ok] Creative report data: {len(creative_report)} creatives with spend data")

# ============================================================
# 3. NEW: ADS MANAGER ACCOUNTS (video metrics)
# ============================================================
print("\n[3] Fetching ads-manager accounts (Facebook metrics)...")

ad_accounts_data = {}
try:
    accounts_result = api_get("ads-manager/accounts", "provider=facebook&skipTimezone=1")
    accounts = accounts_result.get("data", [])
    for acct in accounts:
        acct_id = acct.get("id", "?")
        ad_accounts_data[acct_id] = {
            "name": acct.get("name", "?"),
            "spend": float(acct.get("spend", 0)),
            "impressions": int(acct.get("impressions", 0)),
            "clicks": int(acct.get("clicks", 0)),
            "cpc": float(acct.get("cpc", 0)),
            "cpm": float(acct.get("cpm", 0)),
            "ctr": float(acct.get("ctr", 0)),
            "reach": int(acct.get("reach", 0)),
            "frequency": float(acct.get("frequency", 0)),
            "video_plays": acct.get("actions", {}).get("video_view", 0) if isinstance(acct.get("actions"), dict) else 0,
            "hook_rate": 0,  # video_p25 / impressions
            "hold_rate": 0,  # video_p75 / impressions
        }
        # Video metrics for hook/hold rate
        if isinstance(acct.get("video_play_actions"), dict):
            video_views = int(acct["video_play_actions"].get("video_view", 0))
            p25 = acct.get("video_p25_watched_actions", {})
            p50 = acct.get("video_p50_watched_actions", {})
            p75 = acct.get("video_p75_watched_actions", {})
            impressions = ad_accounts_data[acct_id]["impressions"]
            ad_accounts_data[acct_id]["video_views"] = video_views
            if video_views > 0:
                ad_accounts_data[acct_id]["hook_rate"] = round(int(p25.get("video_view", 0)) / video_views * 100, 1) if isinstance(p25, dict) else 0
                ad_accounts_data[acct_id]["hold_rate"] = round(int(p75.get("video_view", 0)) / video_views * 100, 1) if isinstance(p75, dict) else 0
    print(f"  [ok] Ad accounts: {len(accounts)}")
except Exception as e:
    print(f"  [!] Error fetching ad accounts: {e}")

# ============================================================
# 4. JOIN PURCHASES WITH LEADS
# ============================================================
print("\n[4] Joining purchases with leads...")

purchases_with_creative = []
for p in purchases:
    lead_id = p.get("lead_id")
    lead = lead_map.get(lead_id, {})
    creative_name = lead.get("sub6", "N/A")
    # Use report data if available
    rep = creative_report.get(creative_name, {})
    purchases_with_creative.append({
        "purchase_id": p.get("id"),
        "lead_id": lead_id,
        "date": p.get("created_at", "")[:19],
        "campaign": p.get("campaign_name", "?"),
        "product": p.get("product_name", "?"),
        "currency": p.get("currency", "?"),
        "value_usd": float(p.get("sum_usd", 0)),
        "value_brl": float(p.get("sum_brl", 0)),
        "value_gbp": float(p.get("sum_gbp", 0)),
        "value_eur": float(p.get("sum_eur", 0)),
        "value_cad": float(p.get("sum_cad", 0)),
        "creative": creative_name,
        "sub4": lead.get("sub4", ""),
        "sub5": lead.get("sub5", ""),
        "sub7": lead.get("sub7", ""),
        "country": lead.get("country", "?"),
        "country_code": lead.get("country_code", "?"),
        "device_type": lead.get("device_type", "?"),
        "device_model": lead.get("device_model", "?"),
        "browser": lead.get("browser_name", "?"),
        "landing": lead.get("landing", "?"),
        "offer_name": lead.get("offer", "?"),
        "traffic_channel": lead.get("funnel", {}).get("campaign", {}).get("traffic_channel", {}).get("name", "?"),
    })

# ============================================================
# 5. ICs WITH CREATIVE
# ============================================================
ics = [l for l in all_leads if l.get("offer_id") is not None]
purchase_lead_ids = set(p.get("lead_id") for p in purchases)
ics_without_purchase = [l for l in ics if l["id"] not in purchase_lead_ids]

# ============================================================
# 6. CREATIVE PERFORMANCE (merged with report data!)
# ============================================================
print("\n[5] Calculating per-creative performance...")

creative_stats = {}
# Init from report data (has spend!)
for sub6, rep in creative_report.items():
    creative_stats[sub6] = {
        "creative": sub6,
        "purchases": rep["purchases"],
        "revenue_usd": round(rep["revenue"], 2),
        "spend_usd": round(rep["spend"], 2),
        "gross_profit": round(rep["gross_profit"], 2),
        "roas": round(rep["roas"], 2),
        "cpa": round(rep["spend"] / rep["purchases"], 2) if rep["purchases"] > 0 else 0,
        "cpc": round(rep["cpc"], 4),
        "clicks": rep["clicks"],
        "landing_views": rep["landing_views"],
        "landing_clicks": rep["landing_clicks"],
        "bounce_rate": round(rep["bounce_rate"], 1),
        "avg_ticket": round(rep["avg_ticket"], 2),
        "lead_to_purchase_cvr": round(rep["lead_to_purchase_cvr"], 2),
        "ics": 0,
        "campaigns": list(rep["campaign_names"]) if rep["campaign_names"] else [],
        "products": [],
        "countries": [],
    }

# Also count ICs from leads
for l in ics:
    c = l.get("sub6", "N/A")
    if c not in creative_stats:
        creative_stats[c] = {
            "creative": c, "purchases": 0, "revenue_usd": 0, "spend_usd": 0,
            "gross_profit": 0, "roas": 0, "cpa": 0, "cpc": 0,
            "clicks": 0, "landing_views": 0, "landing_clicks": 0,
            "bounce_rate": 0, "avg_ticket": 0, "lead_to_purchase_cvr": 0,
            "ics": 0, "campaigns": [], "products": [], "countries": [],
        }
    creative_stats[c]["ics"] += 1

# Fill clicks/leads from leads data (complementary to report data)
for l in all_leads:
    c = l.get("sub6", "N/A")
    if c not in creative_stats:
        creative_stats[c] = {
            "creative": c, "purchases": 0, "revenue_usd": 0, "spend_usd": 0,
            "gross_profit": 0, "roas": 0, "cpa": 0, "cpc": 0,
            "clicks": 0, "landing_views": 0, "landing_clicks": 0,
            "bounce_rate": 0, "avg_ticket": 0, "lead_to_purchase_cvr": 0,
            "ics": 0, "campaigns": [], "products": [], "countries": [],
        }
    # Only add clicks if report didn't have them
    if creative_stats[c]["clicks"] == 0:
        creative_stats[c]["clicks"] += 1
    # Collect metadata
    camp_name = l.get("funnel", {}).get("campaign", {}).get("name")
    if camp_name and camp_name not in creative_stats[c]["campaigns"]:
        creative_stats[c]["campaigns"].append(camp_name)
    prod = l.get("offer")
    if prod and prod not in creative_stats[c]["products"] and isinstance(creative_stats[c]["products"], list):
        creative_stats[c]["products"].append(prod)
    country = l.get("country")
    if country and country not in creative_stats[c]["countries"] and isinstance(creative_stats[c]["countries"], list):
        creative_stats[c]["countries"].append(country)

# Also add revenue from purchases to ensure it's there
for pc in purchases_with_creative:
    c = pc["creative"]
    if c in creative_stats and creative_stats[c]["revenue_usd"] == 0:
        creative_stats[c]["revenue_usd"] = pc["value_usd"]
        creative_stats[c]["purchases"] = creative_stats[c].get("purchases", 0) + 1

# Add conversion metrics
for c, stats in creative_stats.items():
    stats["conversion_rate"] = round(stats["purchases"] / stats["clicks"] * 100, 2) if stats["clicks"] > 0 else 0
    stats["ic_to_purchase_rate"] = round(stats["purchases"] / stats["ics"] * 100, 2) if stats["ics"] > 0 else 0
    stats["profit_usd"] = round(stats["revenue_usd"] - stats["spend_usd"], 2)
    stats["roas"] = round(stats["revenue_usd"] / stats["spend_usd"], 2) if stats["spend_usd"] > 0 else 0

creatives_ranked = sorted(creative_stats.values(), key=lambda x: (-x["purchases"], -x["revenue_usd"]))
winning = [c for c in creatives_ranked if c["purchases"] > 0]
idle = [c for c in creatives_ranked if c["purchases"] == 0 and c["clicks"] > 0]

print(f"\n  Creatives with sales: {len(winning)}")
print(f"  Idle creatives (clicks but no sale): {len(idle)}")
total_report_spend = sum(c["spend_usd"] for c in creatives_ranked)
print(f"  Total spend from reports: ${total_report_spend:.2f}")

# ============================================================
# 7. COUNTRY, DEVICE, DAILY METRICS
# ============================================================
print("\n[6] Country, device, daily metrics...")

country_stats = {}
for pc in purchases_with_creative:
    country = pc["country"]
    if country not in country_stats:
        country_stats[country] = {"purchases": 0, "revenue_usd": 0}
    country_stats[country]["purchases"] += 1
    country_stats[country]["revenue_usd"] += pc["value_usd"]
for l in all_leads:
    country = l.get("country", "?")
    if country not in country_stats:
        country_stats[country] = {"purchases": 0, "revenue_usd": 0, "clicks": 0, "ics": 0}
    country_stats[country]["clicks"] = country_stats[country].get("clicks", 0) + 1
    if l.get("offer_id"):
        country_stats[country]["ics"] = country_stats[country].get("ics", 0) + 1
countries_ranked = sorted(country_stats.items(), key=lambda x: -x[1]["revenue_usd"])

device_stats = {}
for pc in purchases_with_creative:
    d = pc["device_type"]
    if d not in device_stats:
        device_stats[d] = {"purchases": 0, "revenue_usd": 0}
    device_stats[d]["purchases"] += 1
    device_stats[d]["revenue_usd"] += pc["value_usd"]
for l in all_leads:
    d = l.get("device_type", "?")
    if d not in device_stats:
        device_stats[d] = {"purchases": 0, "revenue_usd": 0, "clicks": 0}
    device_stats[d]["clicks"] = device_stats[d].get("clicks", 0) + 1

daily_sales = {}
for pc in purchases_with_creative:
    day = pc["date"][:10]
    if day not in daily_sales:
        daily_sales[day] = {"purchases": 0, "revenue_usd": 0, "revenue_brl": 0, "creatives": set()}
    daily_sales[day]["purchases"] += 1
    daily_sales[day]["revenue_usd"] += pc["value_usd"]
    daily_sales[day]["revenue_brl"] += pc["value_brl"]
    daily_sales[day]["creatives"].add(pc["creative"])
for d in daily_sales:
    daily_sales[d]["unique_creatives"] = len(daily_sales[d]["creatives"])
    del daily_sales[d]["creatives"]

daily_clicks = {}
for l in all_leads:
    day = l["created_at"][:10]
    daily_clicks[day] = daily_clicks.get(day, 0) + 1

# ============================================================
# 8. OVERVIEW
# ============================================================
print("[7] Consolidating overview...")

total_revenue_usd = sum(c["revenue_usd"] for c in creatives_ranked)
total_spend_usd = sum(c["spend_usd"] for c in creatives_ranked)
total_purchases = sum(c["purchases"] for c in creatives_ranked)
total_creatives = len(creative_stats)
winning_count = len(winning)
total_clicks = sum(c["clicks"] for c in creatives_ranked)
total_ics = sum(c["ics"] for c in creatives_ranked)

overview = {
    "period": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
    "total_clicks": total_clicks,
    "initiate_checkouts": total_ics,
    "total_purchases": total_purchases,
    "total_revenue_usd": round(total_revenue_usd, 2),
    "total_spent_ads": round(total_spend_usd, 2),
    "profit_usd": round(total_revenue_usd - total_spend_usd, 2),
    "roas": round(total_revenue_usd / total_spend_usd, 2) if total_spend_usd > 0 else 0,
    "cpa": round(total_spend_usd / total_purchases, 2) if total_purchases > 0 else 0,
    "cpl": round(total_spend_usd / total_clicks, 4) if total_clicks > 0 else 0,
    "conversion_rate": round(total_purchases / total_clicks * 100, 2) if total_clicks > 0 else 0,
    "ic_to_purchase_rate": round(total_purchases / total_ics * 100, 2) if total_ics > 0 else 0,
    "unique_creatives": total_creatives,
    "winning_creatives": winning_count,
    "avg_ticket": round(total_revenue_usd / total_purchases, 2) if total_purchases > 0 else 0,
    "products": list(set(p["product"] for p in purchases_with_creative)),
}

# ============================================================
# 9. OUTPUT
# ============================================================
output = {
    "generated_at": datetime.now().isoformat(),
    "overview": overview,

    "campaigns": [{
        "id": c.get("id"),
        "name": c.get("name"),
        "clicks": int(c.get("clicks", 0)),
        "landing_clicks": int(c.get("landing_clicks", 0)),
        "total_spent": float(c.get("total_spent", 0)),
        "total_revenue": float(c.get("total_revenue", 0)),
        "total_purchase": int(c.get("total_purchase", 0)),
        "purchase_leads": int(c.get("purchase_leads", 0)),
        "roas": float(c.get("roas", 0)),
        "roi": float(c.get("roi", 0)),
        "cpa": float(c.get("cpa", 0)),
        "cpl": float(c.get("cpl", 0)),
        "cpc": float(c.get("cpc", 0)),
        "gross_profit": float(c.get("gross_profit", 0)),
        "avg_ticket": float(c.get("avg_ticket", 0)),
        "funnel_conversion": float(c.get("funnel_conversion", 0)),
        "bounce_rate": float(c.get("bounce_rate", 0)),
        "domain": c.get("domain", {}).get("url") if isinstance(c.get("domain"), dict) else c.get("domain"),
        "traffic_channel": c.get("traffic_channel", {}).get("name") if isinstance(c.get("traffic_channel"), dict) else c.get("traffic_channel"),
    } for c in campaigns if isinstance(c, dict)],

    # CREATIVE CONTROL — agora com spend, profit, roas reais!
    "creatives": creatives_ranked,
    "creatives_idle": idle,
    "creatives_winning": winning,

    "purchases": purchases_with_creative,

    "initiate_checkouts": [{
        "lead_id": l["id"],
        "date": l["created_at"][:19],
        "creative": l.get("sub6", "N/A"),
        "offer": l.get("offer", "?"),
        "campaign": l.get("funnel", {}).get("campaign", {}).get("name", "?"),
        "country": l.get("country", "?"),
        "device": l.get("device_type", "?"),
        "sub4": l.get("sub4", ""),
        "sub5": l.get("sub5", ""),
        "sub7": l.get("sub7", ""),
    } for l in ics_without_purchase],

    "offers": [{
        "id": o.get("id"),
        "name": o.get("name"),
        "checkout": o.get("checkout_settings", {}).get("name") if isinstance(o.get("checkout_settings"), dict) else o.get("Checkout"),
        "clicks": int(o.get("clicks", 0)),
        "landing_clicks": int(o.get("landing_clicks", 0)),
        "total_spent": float(o.get("total_spent", 0)),
        "total_revenue": float(o.get("total_revenue", 0)),
        "total_purchase": int(o.get("total_purchase", 0)),
        "roas": float(o.get("roas", 0)),
        "roi": float(o.get("roi", 0)),
        "cpa": float(o.get("cpa", 0)),
        "cpc": float(o.get("cpc", 0)),
        "gross_profit": float(o.get("gross_profit", 0)),
        "avg_ticket": float(o.get("avg_ticket", 0)),
        "funnel_conversion": float(o.get("funnel_conversion", 0)),
        "epc": float(o.get("epc", 0)),
        "product": o.get("name"),
        "purchase_count_api": int(o.get("Purchase", 0)),
        "purchase_value_api": float(o.get("Purchase $", 0)),
    } for o in offers if isinstance(o, dict)],

    "countries": [{
        "country": name,
        "purchases": data["purchases"],
        "revenue_usd": round(data["revenue_usd"], 2),
        "clicks": data.get("clicks", 0),
        "ics": data.get("ics", 0),
        "cvr": round(data["purchases"] / data.get("clicks", 1) * 100, 2) if data.get("clicks", 0) > 0 else 0,
    } for name, data in countries_ranked],

    "devices": [{
        "device": name,
        "purchases": data["purchases"],
        "revenue_usd": round(data["revenue_usd"], 2),
        "clicks": data.get("clicks", 0),
    } for name, data in sorted(device_stats.items(), key=lambda x: -x[1]["revenue_usd"])],

    "daily": [{
        "date": day,
        "purchases": data["purchases"],
        "revenue_usd": data["revenue_usd"],
        "revenue_brl": data["revenue_brl"],
        "clicks": daily_clicks.get(day, 0),
        "unique_creatives": data["unique_creatives"],
    } for day, data in sorted(daily_sales.items())],

    # Ad accounts with Facebook metrics
    "ad_accounts": [{
        "id": acct_id,
        "name": data["name"],
        "spend": data["spend"],
        "impressions": data["impressions"],
        "clicks": data["clicks"],
        "cpc": data["cpc"],
        "cpm": data["cpm"],
        "ctr": data["ctr"],
        "reach": data["reach"],
        "frequency": data["frequency"],
        "video_plays": data.get("video_plays", 0),
        "video_views": data.get("video_views", 0),
        "hook_rate": data.get("hook_rate", 0),
        "hold_rate": data.get("hold_rate", 0),
    } for acct_id, data in ad_accounts_data.items()],

    "cancelled_rejected": [{
        "lead_id": p.get("lead_id"),
        "date": p.get("created_at", "")[:19],
        "type": p.get("type"),
        "product": p.get("product_name", "?"),
        "campaign": p.get("campaign_name", "?"),
        "value_usd": float(p.get("sum_usd", 0)),
    } for p in cancelled + rejected_ps],

    "company_revenue": (api_get("company-revenue").get("data") or [{}])[0],
}

# ============================================================
# 10. SAVE
# ============================================================
outfile = r"C:\Dash-Prab\easytracker_dashboard.json"
with open(outfile, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False, default=str)

file_size = os.path.getsize(outfile)
print(f"\n[+] Dashboard saved to: {outfile}")
print(f"[+] Size: {file_size / 1024:.1f} KB")
print(f"[+] Creatives: {total_creatives} | With sales: {winning_count} | Idle: {len(idle)}")
print(f"[+] Sales: {total_purchases} | ICs: {total_ics} | Clicks: {total_clicks}")
print(f"[+] Revenue: ${total_revenue_usd:.2f} | Spend: ${total_spend_usd:.2f} | Profit: ${total_revenue_usd - total_spend_usd:.2f}")
print(f"[+] ROAS: {overview['roas']}x | CPA: ${overview['cpa']} | Conversion: {overview['conversion_rate']}%")
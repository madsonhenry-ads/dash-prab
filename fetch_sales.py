"""EasyTracker - Pull all sales with creative data from last 10 days"""
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta
import sys

TOKEN_FILE = r"C:\Dash-Prab\.et_token"
BASE = "https://api.easytracker.digital/api/leads"
HEADERS = {
    "Authorization": "Bearer " + open(TOKEN_FILE).read().strip(),
    "x-app-id": "111127",
    "Origin": "https://app.easytracker.digital",
    "Accept": "application/json"
}

today = datetime.now()
start = (today - timedelta(days=10)).strftime("%Y-%m-%d")
end = today.strftime("%Y-%m-%d")

print(f"Buscando vendas de {start} ate {end}...")
print()

all_sales = []
page = 1
total_found = 0

while True:
    url = f"{BASE}?per_page=100&page={page}&from_date={start}&to_date={end}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Erro HTTP {e.code} na pagina {page}: {body[:200]}")
        break
    except Exception as e:
        print(f"Erro pagina {page}: {e}")
        break

    leads = data['data']
    meta = data.get('meta', {})

    # Filter sales
    page_sales = [l for l in leads if l.get('offer_id')]
    all_sales.extend(page_sales)
    total_found += len(page_sales)

    print(f"Pagina {page}/{meta.get('last_page','?')} | Leads: {len(leads)} | Vendas pagina: {len(page_sales)} | Total: {total_found}")

    if page >= meta.get('last_page', 1):
        break
    page += 1

print()
print(f"=== RESULTADO === Total de vendas: {total_found}")
print()

# Group by creative (sub6)
by_creative = {}
for s in all_sales:
    c = s.get('sub6', 'N/A')
    offer = s.get('offer', '?')
    if c not in by_creative:
        by_creative[c] = {'count': 0, 'offers': {}, 'revenue': 0}
    by_creative[c]['count'] += 1
    by_creative[c]['offers'][offer] = by_creative[c]['offers'].get(offer, 0) + 1

print("=== VENDAS POR CRIATIVO ===")
for creative, data in sorted(by_creative.items(), key=lambda x: -x[1]['count']):
    print(f"\n{creative}: {data['count']} vendas")
    for offer, n in data['offers'].items():
        print(f"  -> {offer}: {n}")

# By date
by_day = {}
for s in all_sales:
    d = s['created_at'][:10]
    by_day[d] = by_day.get(d, 0) + 1

print()
print("=== VENDAS POR DIA ===")
for d in sorted(by_day):
    print(f"{d}: {by_day[d]} vendas")

# By country
by_country = {}
for s in all_sales:
    country = s.get('country', '?')
    by_country[country] = by_country.get(country, 0) + 1

print()
print("=== VENDAS POR PAIS ===")
for c, n in sorted(by_country.items(), key=lambda x: -x[1]):
    print(f"{c}: {n} vendas")

# By device
by_device = {}
for s in all_sales:
    d = s.get('device_type', '?')
    by_device[d] = by_device.get(d, 0) + 1

print()
print("=== VENDAS POR DEVICE ===")
for d, n in sorted(by_device.items(), key=lambda x: -x[1]):
    print(f"{d}: {n} vendas")

# Save full data
out = {
    'total': total_found,
    'by_creative': {k: v['count'] for k, v in sorted(by_creative.items(), key=lambda x: -x[1]['count'])},
    'by_day': by_day,
    'by_country': by_country,
    'by_device': by_device,
    'sales': [{
        'id': s['id'],
        'date': s['created_at'],
        'creative': s.get('sub6'),
        'offer': s.get('offer'),
        'country': s.get('country'),
        'device': s.get('device_type'),
        'sub4': s.get('sub4'),
        'sub5': s.get('sub5'),
        'sub7': s.get('sub7'),
    } for s in all_sales]
}

outfile = r"C:\Dash-Prab\easytracker_sales.json"
with open(outfile, 'w') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f"\nDados salvos em: {outfile}")

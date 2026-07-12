import json

with open('/tmp/leads.json', 'r', encoding='utf-8') as f:
    j = json.load(f)

leads = j.get('data', [])
sales = [l for l in leads if l.get('offer_id') is not None]

print('Total leads:', len(leads), '| Sales:', len(sales))
print()

by = {}
for s in sales:
    c = s.get('sub6', 'N/A')
    by[c] = by.get(c, 0) + 1

print('=== VENDAS POR CRIATIVO (sub6) ===')
for c, n in sorted(by.items(), key=lambda x: -x[1]):
    print(c, ':', n, 'vendas')

print()
by_day = {}
for s in sales:
    d = s['created_at'][:10]
    by_day[d] = by_day.get(d, 0) + 1

print('=== VENDAS POR DIA ===')
for d in sorted(by_day):
    print(d, ':', by_day[d], 'vendas')

# Sample
print()
print('=== SAMPLE ===')
for s in sales[:2]:
    print(json.dumps({
        'id': s['id'],
        'date': s['created_at'],
        'creative': s.get('sub6'),
        'offer': s.get('offer'),
        'country': s.get('country'),
        'sub4': s.get('sub4'),
        'sub5': s.get('sub5'),
        'sub7': s.get('sub7')
    }, indent=2))

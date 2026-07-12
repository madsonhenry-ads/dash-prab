const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/leads.json', 'utf8'));
const leads = j.data || [];
const sales = leads.filter(l => l.offer_id !== null);

console.log('Total leads: ' + leads.length + ' | Sales: ' + sales.length);
console.log('');

// By creative (sub6)
const byCreative = {};
sales.forEach(s => {
  const creative = s.sub6 || 'N/A';
  byCreative[creative] = (byCreative[creative] || 0) + 1;
});

console.log('=== SALES BY CREATIVE (sub6) - last 10 days ===');
Object.keys(byCreative)
  .sort((a, b) => byCreative[b] - byCreative[a])
  .forEach(c => console.log(c + ': ' + byCreative[c] + ' sales'));

// By day
const byDay = {};
sales.forEach(s => {
  const day = s.created_at.substring(0, 10);
  byDay[day] = (byDay[day] || 0) + 1;
});

console.log('');
console.log('=== SALES BY DAY ===');
Object.keys(byDay).sort().forEach(d => console.log(d + ': ' + byDay[d] + ' sales'));

// Sample
console.log('');
console.log('=== SAMPLE ===');
sales.slice(0, 2).forEach(s => {
  console.log(JSON.stringify({
    id: s.id,
    date: s.created_at,
    creative: s.sub6,
    offer: s.offer,
    country: s.country,
    sub4: s.sub4,
    sub5: s.sub5,
    sub7: s.sub7
  }, null, 2));
});

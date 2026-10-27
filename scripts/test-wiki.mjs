async function queryWiki(query) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&prop=imageinfo&iiprop=url|size|extmetadata&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'VacatinaTravelOS/1.0 (info@vacatina.com)' } });
  const data = await res.json();
  const pages = data?.query?.pages || {};
  const results = [];
  for (const p of Object.values(pages)) {
    if (p.imageinfo && p.imageinfo[0] && p.imageinfo[0].url) {
      results.push({
        title: p.title,
        url: p.imageinfo[0].url,
        width: p.imageinfo[0].width,
        height: p.imageinfo[0].height
      });
    }
  }
  return results;
}

const queries = [
  'Eurostar train e320 high speed railway',
  'Cruise ship Mediterranean Sea Santorini',
  'Cruise ship Singapore Marina Bay',
  'Luxury cruise ship Maldives Indian Ocean',
  'Mercedes Benz executive saloon chauffeur airport',
  'Sri Lanka coastal road car drive',
  'Toyota Commuter passenger van airport Bangkok',
  'Thailand passport visa travel document',
  'Singapore passport biometric travel document'
];

for (const q of queries) {
  const res = await queryWiki(q);
  console.log(`\nQuery: "${q}" -> Found ${res.length} images:`);
  res.slice(0, 2).forEach(r => console.log(`  - [${r.width}x${r.height}] ${r.title}\n    ${r.url}`));
}

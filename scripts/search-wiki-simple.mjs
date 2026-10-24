async function queryWiki(query) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&prop=imageinfo&iiprop=url|size&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'VacatinaTravelOS/1.0 (info@vacatina.com)' } });
  const data = await res.json();
  const pages = data?.query?.pages || {};
  const results = [];
  for (const p of Object.values(pages)) {
    if (p.imageinfo && p.imageinfo[0] && p.imageinfo[0].url) {
      const u = p.imageinfo[0].url.toLowerCase();
      if ((u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.png') || u.endsWith('.webp')) && !u.endsWith('.pdf')) {
        results.push({
          title: p.title,
          url: p.imageinfo[0].url,
          width: p.imageinfo[0].width,
          height: p.imageinfo[0].height
        });
      }
    }
  }
  return results;
}

const queries = [
  'Mercedes-Benz London',
  'Heathrow Airport car',
  'Sri Lanka highway',
  'Cruise ship Port Victoria Seychelles',
  'Cruise ship Malé',
  'Passport Thailand',
  'Passport Singapore'
];

for (const q of queries) {
  const res = await queryWiki(q);
  console.log(`\nQuery: "${q}" -> Found ${res.length} images:`);
  res.slice(0, 3).forEach(r => console.log(`  - [${r.width}x${r.height}] ${r.title}\n    ${r.url}`));
}

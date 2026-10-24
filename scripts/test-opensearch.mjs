async function searchWikiFile(term) {
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srnamespace=6&format=json`, {
    headers: { 'User-Agent': 'VacatinaTravelOS/1.0 (info@vacatina.com)' }
  });
  const data = await res.json();
  const searchResults = data?.query?.search || [];
  const urls = [];
  for (const item of searchResults.slice(0, 5)) {
    const fileRes = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(item.title)}&prop=imageinfo&iiprop=url|size&format=json`, {
      headers: { 'User-Agent': 'VacatinaTravelOS/1.0 (info@vacatina.com)' }
    });
    const fileData = await fileRes.json();
    const p = Object.values(fileData?.query?.pages || {})[0];
    if (p?.imageinfo?.[0]?.url) {
      const u = p.imageinfo[0].url;
      if (u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.png')) {
        urls.push({ title: item.title, url: u, width: p.imageinfo[0].width, height: p.imageinfo[0].height });
      }
    }
  }
  return urls;
}

const terms = [
  'Heathrow Airport car',
  'Mercedes-Benz London',
  'Southern Expressway Sri Lanka',
  'Cruise ship Maldives',
  'Passport Thailand',
  'Passport Singapore'
];

for (const t of terms) {
  const found = await searchWikiFile(t);
  console.log(`\nTerm: "${t}" -> Found ${found.length}:`);
  found.slice(0, 2).forEach(f => console.log(`  - ${f.title}: ${f.url}`));
}

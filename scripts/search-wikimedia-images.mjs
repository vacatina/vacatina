import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

async function searchCommons(query, limit = 5) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|size|mime|extmetadata`;
  const res = await fetch(url, { headers: { 'User-Agent': 'VacatinaPhotoResearchBot/1.0 (travel-research)' } });
  const data = await res.json();
  if (!data.query || !data.query.pages) return [];
  const pages = Object.values(data.query.pages);
  return pages
    .filter(p => p.imageinfo && p.imageinfo[0] && p.imageinfo[0].mime === 'image/jpeg')
    .map(p => ({
      title: p.title,
      url: p.imageinfo[0].url,
      width: p.imageinfo[0].width,
      height: p.imageinfo[0].height,
      description: p.imageinfo[0].extmetadata?.ImageDescription?.value?.replace(/<[^>]+>/g, '') || ''
    }));
}

const queries = [
  'Dubai skyline Burj Khalifa sunset',
  'Maldives aerial atoll lagoon',
  'Bangkok skyline Chao Phraya sunset',
  'London skyline River Thames golden hour',
  'Museum of the Future Dubai exterior',
  'Palace of Westminster Big Ben bridge',
  'Wat Arun Temple Bangkok daytime',
  'Marina Bay Sands Singapore dusk waterfront',
  'Maldives overwater bungalows resort',
  'Dubai Marina promenade twilight',
  'Phang Nga Bay longtail boat limestone',
  'Burj Khalifa observation deck view',
  'Grand Palace Bangkok stupa',
  'Tower Bridge London river perspective',
  'Dubai airport executive sedan curb',
  'Dubai Cruise Terminal cruise ship'
];

for (const q of queries) {
  console.log(`\n=== QUERY: ${q} ===`);
  const results = await searchCommons(q, 3);
  results.forEach((r, i) => {
    console.log(`  [${i+1}] ${r.title} (${r.width}x${r.height}) -> ${r.url}`);
  });
}

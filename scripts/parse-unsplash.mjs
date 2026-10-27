async function parseUnsplashHtml(topic) {
  const url = `https://unsplash.com/s/photos/${topic}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html'
    }
  });
  if (!res.ok) {
    console.error(`Status: ${res.status}`);
    return [];
  }
  const text = await res.text();
  const regex = /https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9_-]+\?[^"'\s>]+/g;
  const matches = text.match(regex) || [];
  // Deduplicate base photo IDs
  const seen = new Set();
  const photos = [];
  for (const m of matches) {
    const baseId = m.split('?')[0];
    if (!seen.has(baseId)) {
      seen.add(baseId);
      photos.push(`${baseId}?auto=format&fit=crop&w=1200&q=80`);
    }
  }
  return photos;
}

const topics = [
  'chauffeur-airport',
  'road-trip-car',
  'passport-travel',
  'cruise-ship-ocean'
];

for (const t of topics) {
  const list = await parseUnsplashHtml(t);
  console.log(`\nTopic "${t}" -> Found ${list.length} direct images:`);
  list.slice(0, 3).forEach((img, i) => console.log(`  ${i + 1}. ${img}`));
}

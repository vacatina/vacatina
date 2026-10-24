async function searchUnsplashNapi(query) {
  const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=3`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json'
    }
  });
  if (!res.ok) {
    console.error(`Error ${res.status}: ${res.statusText}`);
    return [];
  }
  const data = await res.json();
  return (data.results || []).map(r => ({
    id: r.id,
    alt: r.alt_description || r.description || query,
    rawUrl: r.urls?.raw,
    regularUrl: r.urls?.regular,
    photographer: r.user?.name,
    profile: r.user?.links?.html
  }));
}

const queries = [
  'black executive car airport chauffeur',
  'Sri Lanka coastal road drive car',
  'Thailand passport travel document table',
  'Singapore passport biometric document',
  'luxury cruise ship tropical island ocean'
];

for (const q of queries) {
  const results = await searchUnsplashNapi(q);
  console.log(`\nQuery: "${q}" -> Found ${results.length} photos:`);
  results.forEach(r => {
    console.log(`  - [${r.id}] ${r.alt} (by ${r.photographer})`);
    console.log(`    URL: ${r.regularUrl}`);
  });
}

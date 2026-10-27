import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');

// Match all article tags in index.html
const artRegex = /<article[\s\S]*?<\/article>/g;
let artMatch;
const inventory = [];

while ((artMatch = artRegex.exec(html)) !== null) {
  const artHtml = artMatch[0];
  const h3 = artHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  const title = h3 ? h3[1].replace(/<[^>]+>/g, '').trim() : 'Unknown';
  
  // Find preceding section or category
  const beforeArticle = html.slice(0, artMatch.index);
  const sectionMatch = beforeArticle.match(/<section[^>]*?(?:id="([^"]+)"|aria-label="([^"]+)")/g);
  const lastSection = sectionMatch ? sectionMatch[sectionMatch.length - 1] : 'Unknown';
  
  const categoryMatch = artHtml.match(/uppercase tracking-wider[^>]*>([\s\S]*?)<\/div>/i);
  const category = categoryMatch ? categoryMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  const imgMatch = artHtml.match(/<img\s+([^>]*?)>/i);
  let src = '';
  let alt = '';
  if (imgMatch) {
    const srcM = imgMatch[1].match(/src="([^"]+)"/i);
    const altM = imgMatch[1].match(/alt="([^"]+)"/i);
    if (srcM) src = srcM[1];
    if (altM) alt = altM[1];
  }
  inventory.push({
    title,
    category,
    lastSection,
    alt,
    src
  });
}

console.log(`Total article cards found: ${inventory.length}`);

// Print table of cards
inventory.forEach((c, i) => {
  console.log(`${String(i + 1).padStart(2, '0')}. [${c.title}] | Alt: "${c.alt.slice(0, 40)}..." | Src: ${c.src.slice(0, 45)}...`);
});

// Check duplicates
const srcMap = new Map();
inventory.forEach((item, idx) => {
  if (!srcMap.has(item.src)) srcMap.set(item.src, []);
  srcMap.get(item.src).push({ idx: idx + 1, title: item.title, category: item.category });
});

console.log('\n--- DUPLICATE IMAGE ANALYSIS (EXACT SAME SRC) ---');
let dupCount = 0;
for (const [src, usages] of srcMap.entries()) {
  if (usages.length > 1) {
    dupCount++;
    console.log(`\nDuplicate #${dupCount} (${usages.length} cards share this exact URL):`);
    console.log(`URL: ${src.slice(0, 70)}...`);
    usages.forEach(u => console.log(`  - Card #${u.idx}: "${u.title}" (${u.category})`));
  }
}
console.log(`\nTotal duplicate groups: ${dupCount}`);


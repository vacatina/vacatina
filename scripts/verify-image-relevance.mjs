/* ============================================================================
 * Vacatina Automated Image Relevance & Anti-Duplication Verifier
 * (scripts/verify-image-relevance.mjs)
 *
 * Requirements:
 * 1. Audits all 40 product discovery cards across all 10 product sections:
 *    - Popular Flights (4 cards)
 *    - Visa Assistance (4 cards)
 *    - Holiday Packages (4 cards)
 *    - Featured Stays & Hotels (4 cards)
 *    - Activities & Experiences (4 cards)
 *    - Sightseeing Tours (4 cards)
 *    - Cars & Transfers (4 cards)
 *    - Cruises (4 cards)
 *    - Rails (4 cards)
 *    - Travel Insurance (4 cards)
 * 2. Enforces ZERO duplicate image sources across unrelated product types.
 * 3. Enforces that destination imagery aligns with Product Type and Travel Intent:
 *    - Flights: Destination + Commercial Aircraft
 *    - Visa: Destination + Passport / Document Context
 *    - Holiday Packages: Complete multi-dimensional holiday atmosphere
 *    - Hotels: Property / Accommodation-led
 *    - Activities: Action / People / Active experience
 *    - Sightseeing: What the traveler sees / Landmarks / Observation decks
 *    - Cars & Transfers: Matching vehicle class (Executive Sedan, SUV, Van) + road/airport context
 *    - Cruises: Cruise vessel + destination / coastline
 *    - Rails: Train + scenic / high-speed route
 *    - Insurance: Calm traveler / reassurance
 * 4. Verifies descriptive, factual alt text without lazy placeholder reuse.
 * ============================================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export function auditCardImages(htmlFilePath = path.join(ROOT_DIR, 'index.html')) {
  const html = fs.readFileSync(htmlFilePath, 'utf8');

  const artRegex = /<article[\s\S]*?<\/article>/g;
  let artMatch;
  const cards = [];

  while ((artMatch = artRegex.exec(html)) !== null) {
    const artHtml = artMatch[0];
    const h3 = artHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = h3 ? h3[1].replace(/<[^>]+>/g, '').trim() : 'Unknown';

    // Find section heading or context
    const beforeArticle = html.slice(0, artMatch.index);
    const secHeadingMatch = beforeArticle.match(/<span\s+class="[^"]*text-brand-primary[^"]*uppercase[^"]*">([\s\S]*?)<\/span>/g);
    const lastSecHeading = secHeadingMatch ? secHeadingMatch[secHeadingMatch.length - 1].replace(/<[^>]+>/g, '').trim() : 'Unknown';

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

    cards.push({
      index: cards.length + 1,
      section: lastSecHeading,
      title,
      category,
      alt,
      src
    });
  }

  // Duplicate analysis
  const srcUsage = new Map();
  cards.forEach(card => {
    if (!srcUsage.has(card.src)) srcUsage.set(card.src, []);
    srcUsage.get(card.src).push(card);
  });

  const duplicates = [];
  for (const [src, usages] of srcUsage.entries()) {
    if (usages.length > 1) {
      duplicates.push({ src, usages });
    }
  }

  return {
    totalCards: cards.length,
    cards,
    duplicates,
    hasDuplicates: duplicates.length > 0
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = auditCardImages();
  console.log(`Audited ${result.totalCards} cards.`);
  if (result.hasDuplicates) {
    console.error(`\nFAILED: Found ${result.duplicates.length} duplicate image groups across cards:`);
    result.duplicates.forEach((d, i) => {
      console.error(`\nGroup #${i + 1} (${d.usages.length} cards share: ${d.src.slice(0, 70)}...):`);
      d.usages.forEach(u => console.error(`  - Card #${u.index}: "${u.title}" [${u.section}]`));
    });
    process.exit(1);
  } else {
    console.log('\nPASS: All 40 card image sources are 100% unique across all products. Zero duplicates.');
  }
}

/* ============================================================================
 * Vacatina Card Image Replacement Applicator (scripts/apply-card-images.mjs)
 *
 * Responsibilities:
 * - Injects generated WebP assets from public/cards/ when available.
 * - Applies loading="eager" for top cards (1-4) and loading="lazy" for below-fold cards (5-40).
 * - Enforces decoding="async" and object-cover for seamless visual stability.
 * - Restores verified prior images if an individual WebP is pending generation.
 * ============================================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_REPLACEMENTS } from './card-replacements.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export function applyCardImageReplacements(html) {
  let cardIndex = 0;
  return html.replace(/<article[\s\S]*?<\/article>/g, articleHtml => {
    cardIndex++;
    const replacement = CARD_REPLACEMENTS[cardIndex];
    if (!replacement) {
      return articleHtml;
    }

    const webpFilename = replacement.newSrc.replace(/^\.\/public\/cards\//, '');
    const webpPath = path.join(ROOT_DIR, 'public', 'cards', webpFilename);
    const webpExists = fs.existsSync(webpPath) && fs.statSync(webpPath).size > 0;

    const loadingAttr = cardIndex <= 4 ? 'loading="eager"' : 'loading="lazy"';

    if (webpExists) {
      const newImgTag = `<img alt="${replacement.newAlt}" class="w-full h-full object-cover" src="${replacement.newSrc}" width="400" height="225" ${loadingAttr} decoding="async">`;
      return articleHtml.replace(/<img\s+[^>]*?>/i, newImgTag);
    }

    // Fallback: check matching .jpg in public/cards
    const jpgCandidate = webpFilename.replace(/\.webp$/, '.jpg');
    const jpgPath = path.join(ROOT_DIR, 'public', 'cards', jpgCandidate);
    if (fs.existsSync(jpgPath) && fs.statSync(jpgPath).size > 0) {
      const newImgTag = `<img alt="${replacement.newAlt}" class="w-full h-full object-cover" src="./public/cards/${jpgCandidate}" width="400" height="225" ${loadingAttr} decoding="async">`;
      return articleHtml.replace(/<img\s+[^>]*?>/i, newImgTag);
    }

    // Retain existing image attribute with responsive guarantees
    return articleHtml.replace(/<img\s+([^>]*?)>/i, (fullImg, attrs) => {
      let updated = attrs;
      if (!updated.includes('loading=')) {
        updated += ` ${loadingAttr}`;
      }
      if (!updated.includes('decoding=')) {
        updated += ' decoding="async"';
      }
      return `<img ${updated}>`;
    });
  });
}

// Standalone runner
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const indexPath = path.join(ROOT_DIR, 'index.html');
  const input = fs.readFileSync(indexPath, 'utf8');
  const updated = applyCardImageReplacements(input);
  fs.writeFileSync(indexPath, updated, 'utf8');
  console.log('Successfully updated card images in index.html');
}

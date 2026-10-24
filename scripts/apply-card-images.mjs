import fs from 'node:fs';
import path from 'node:path';
import { CARD_REPLACEMENTS } from './card-replacements.mjs';

export function applyCardImageReplacements(html) {
  let cardIndex = 0;
  return html.replace(/<article[\s\S]*?<\/article>/g, articleHtml => {
    cardIndex++;
    const replacement = CARD_REPLACEMENTS[cardIndex];
    if (!replacement) {
      // Kept card: retain its image, ensure loading="lazy" decoding="async" and explicit width/height
      return articleHtml.replace(/<img\s+([^>]*?)>/i, (fullImg, attrs) => {
        if (!attrs.includes('loading=')) {
          return `<img ${attrs} loading="lazy" decoding="async" width="400" height="225">`;
        }
        return fullImg;
      });
    }

    const loadingAttr = cardIndex <= 4 ? 'loading="eager"' : 'loading="lazy"';
    const newImgTag = `<img alt="${replacement.newAlt}" class="w-full h-full object-cover" src="${replacement.newSrc}" width="400" height="225" ${loadingAttr} decoding="async">`;

    return articleHtml.replace(/<img\s+[^>]*?>/i, newImgTag);
  });
}

// Test on current index.html
if (process.argv[1] && process.argv[1].endsWith('apply-card-images.mjs')) {
  const input = fs.readFileSync('index.html', 'utf8');
  const updated = applyCardImageReplacements(input);
  fs.writeFileSync('index.html', updated, 'utf8');
  console.log('Successfully updated card images in index.html');
}

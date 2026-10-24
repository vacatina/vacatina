import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CARDS_DIR = path.join(ROOT_DIR, 'public', 'cards');
fs.mkdirSync(CARDS_DIR, { recursive: true });

import { auditCardImages } from './verify-image-relevance.mjs';

const audit = auditCardImages();
const keptMap = {
  11: 'package-bali.jpg',
  13: 'hotel-maldives-lagoon.jpg',
  14: 'hotel-dubai-skyline.jpg',
  15: 'hotel-srilanka-cliffside.jpg',
  16: 'hotel-bali-forest.jpg',
  17: 'activity-maldives-snorkelling.jpg',
  18: 'activity-dubai-safari.jpg',
  19: 'activity-srilanka-leopard.jpg',
  20: 'activity-bali-culinary.jpg',
  34: 'rail-japan-shinkansen.jpg',
  35: 'rail-srilanka-kandy-ella.jpg',
  36: 'rail-swiss-alps.jpg',
  37: 'insurance-medical.jpg',
  38: 'insurance-single-trip.jpg',
  39: 'insurance-family.jpg',
  40: 'insurance-annual.jpg'
};

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      },
      res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
          return;
        }
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
      }
    );
    req.on('error', reject);
  });
}

async function run() {
  console.log('Downloading 16 verified kept card images to public/cards/...');
  for (const [idxStr, filename] of Object.entries(keptMap)) {
    const idx = parseInt(idxStr, 10);
    const card = audit.cards.find(c => c.index === idx);
    if (!card || !card.src.startsWith('http')) {
      console.warn(`Card #${idx} not found or invalid URL`);
      continue;
    }
    const dest = path.join(CARDS_DIR, filename);
    await downloadFile(card.src, dest);
    const stat = fs.statSync(dest);
    console.log(`Saved Card #${idx} ("${card.title}") -> ${filename} (${Math.round(stat.size / 1024)} KB)`);
  }
  console.log('All 16 kept card images downloaded successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

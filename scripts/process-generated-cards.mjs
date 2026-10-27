import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const TARGET_WIDTH = 1600;
const TARGET_HEIGHT = 960; // 5:3 aspect ratio

const CARDS_DIR = path.resolve('public', 'cards');
const RAW_DIR = path.join(CARDS_DIR, 'raw');

if (!fs.existsSync(CARDS_DIR)) fs.mkdirSync(CARDS_DIR, { recursive: true });
if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });

export async function processCard(inputPath, targetFilename) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const outputPath = path.join(CARDS_DIR, targetFilename);
  const rawPath = path.join(RAW_DIR, targetFilename.replace('.webp', '-raw' + path.extname(inputPath)));

  // Copy raw file
  fs.copyFileSync(inputPath, rawPath);

  // Resize and convert to 1600x960 WebP 5:3
  await sharp(inputPath)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: 'cover',
      position: 'centre'
    })
    .webp({
      quality: 85,
      effort: 6,
      chromaSubsampling: '4:2:0'
    })
    .toFile(outputPath);

  const stats = fs.statSync(outputPath);
  console.log(`✔ Processed ${targetFilename} (${Math.round(stats.size / 1024)} KB, ${TARGET_WIDTH}x${TARGET_HEIGHT})`);
  return stats.size;
}

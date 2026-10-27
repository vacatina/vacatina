import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const siteDir = path.join(ROOT_DIR, 'dist-site');

const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');

const regex = /(?:src|href)="(\.[^"]+)"/g;
let m;
let total = 0;
let missing = 0;

while ((m = regex.exec(html)) !== null) {
  total++;
  const relPath = m[1];
  const fullPath = path.resolve(siteDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error('MISSING ASSET:', relPath, '->', fullPath);
    missing++;
  }
}

console.log(`[dist-site audit] Total local asset references: ${total}`);
console.log(`[dist-site audit] Missing assets: ${missing}`);

if (missing > 0) {
  process.exit(1);
} else {
  console.log('[dist-site audit] PASS: 100% of local asset references exist in dist-site/');
}

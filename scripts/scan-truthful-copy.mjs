import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

const targetWords = [
  'compliance verified',
  'live desk',
  'instant',
  'lowest price',
  'lowest rate',
  'guaranteed',
  'certified',
  'official',
  'real-time',
  'secure'
];

console.log('--- SCANNING INDEX.HTML FOR TARGET WORDS ---');
for (const word of targetWords) {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  let m;
  const matches = [];
  while ((m = regex.exec(html)) !== null) {
    const start = Math.max(0, m.index - 50);
    const end = Math.min(html.length, m.index + 50);
    matches.push(html.slice(start, end).replace(/\n/g, ' '));
  }
  console.log(`Word: "${word}" -> ${matches.length} matches`);
  matches.forEach((snippet, i) => {
    console.log(`  [${i+1}] ...${snippet.trim()}...`);
  });
}

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CARDS_DIR = path.join(ROOT_DIR, 'public', 'cards');

async function getWikiFileUrl(title) {
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size&format=json`;
  const res = await fetch(apiUrl, { headers: { 'User-Agent': 'VacatinaTravelOS/1.0 (info@vacatina.com)' } });
  const data = await res.json();
  const page = Object.values(data?.query?.pages || {})[0];
  return page?.imageinfo?.[0]?.url || null;
}

async function downloadWiki(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          'User-Agent': 'VacatinaTravelPlatform/1.0 (info@vacatina.com; https://vacatina.com)'
        }
      },
      res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadWiki(res.headers.location, destPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Status ${res.statusCode} for ${url}`));
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    ).on('error', reject);
  });
}

const fileMap = [
  {
    target: 'cruise-indianocean.jpg',
    wikiTitle: 'File:Port Victoria Seychelles.jpg'
  },
  {
    target: 'visa-thailand.jpg',
    wikiTitle: 'File:Second Version Thai Biometric Passport.jpg'
  },
  {
    target: 'visa-singapore.jpg',
    wikiTitle: 'File:2018 singapore passport.jpg'
  },
  {
    target: 'car-srilanka.jpg',
    wikiTitle: 'File:Southern Expressway (E01) in Sri Lanka.jpg'
  },
  {
    target: 'transfer-london.jpg',
    wikiTitle: 'File:A TX4 Taxi at Heathrow Airport Terminal 5.jpg'
  }
];

for (const item of fileMap) {
  const fileUrl = await getWikiFileUrl(item.wikiTitle);
  console.log(`${item.wikiTitle} -> ${fileUrl}`);
  if (fileUrl) {
    const dest = path.join(CARDS_DIR, item.target);
    await downloadWiki(fileUrl, dest);
    console.log(`Saved: ${item.target} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
  }
}

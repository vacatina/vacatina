import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CARDS_DIR = path.join(ROOT_DIR, 'public', 'cards');
fs.mkdirSync(CARDS_DIR, { recursive: true });

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

const imagesToDownload = [
  {
    name: 'transfer-bangkok.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Toyota_Commuter_in_Suvarnabhumi_Airport_%281%29.jpg'
  },
  {
    name: 'rail-london-paris.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/dd/London-bound_Eurostar_train_passing_through_Ebbsfleet_International_-_geograph.org.uk_-_5851249.jpg'
  },
  {
    name: 'cruise-mediterranean.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Santorin_%28GR%29%2C_Fira%2C_Caldera_--_2017_--_2608.jpg'
  },
  {
    name: 'cruise-singapore.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Marina_bay_cruise_centre_singapore_two_ships.jpg'
  }
];

for (const item of imagesToDownload) {
  const dest = path.join(CARDS_DIR, item.name);
  try {
    await downloadWiki(item.url, dest);
    console.log(`Success: ${item.name} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
  } catch (err) {
    console.error(`Error downloading ${item.name}:`, err.message);
  }
}

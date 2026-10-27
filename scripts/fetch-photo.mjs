import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export async function fetchImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Vacatina/1.0',
          Accept: 'image/avif,image/webp,image/apng,image/jpeg,image/*,*/*;q=0.8'
        }
      },
      res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect with absolute URL resolution
          const redirectUrl = new URL(res.headers.location, url).toString();
          return fetchImage(redirectUrl, destPath).then(resolve).catch(reject);
        }
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

const testUrl = 'https://unsplash.com/photos/hN79lQpUa5Y/download?force=true&w=1200';
const dest = path.resolve('public/cards/cruise-mediterranean.jpg');

fetchImage(testUrl, dest)
  .then(() => console.log('Successfully downloaded cruise-mediterranean:', dest, fs.statSync(dest).size, 'bytes'))
  .catch(console.error);

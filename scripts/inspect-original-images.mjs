import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync('stitch_vacatina_master_ui_foundation/08_vacatina_complete_homepage_layer_1_structural_skeleton_review/code.html', 'utf8');
const artRegex = /<article[\s\S]*?<\/article>/g;
let m;
let i = 0;
const cards = [];

while ((m = artRegex.exec(html)) !== null) {
  i++;
  const h3 = m[0].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  const title = h3 ? h3[1].replace(/<[^>]+>/g, '').trim() : '';
  const img = m[0].match(/<img\s+([^>]*?)>/i);
  let src = '';
  let alt = '';
  if (img) {
    const sm = img[1].match(/src="([^"]+)"/i);
    const am = img[1].match(/alt="([^"]+)"/i);
    if (sm) src = sm[1];
    if (am) alt = am[1];
  }
  cards.push({ index: i, title, src, alt });
}

console.log(JSON.stringify(cards, null, 2));

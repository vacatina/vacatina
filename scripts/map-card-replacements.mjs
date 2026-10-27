import fs from 'node:fs';

const html = fs.readFileSync('stitch_vacatina_master_ui_foundation/08_vacatina_complete_homepage_layer_1_structural_skeleton_review/code.html', 'utf8');
const artRegex = /<article[\s\S]*?<\/article>/g;
let m;
const list = [];
while ((m = artRegex.exec(html)) !== null) {
  const h3 = m[0].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
  const imgTag = m[0].match(/<img[^>]+>/i)?.[0];
  const cat = m[0].match(/uppercase tracking-wider[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
  list.push({ idx: list.length + 1, cat, h3, imgTag });
}

console.log(JSON.stringify(list, null, 2));

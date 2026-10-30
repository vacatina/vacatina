import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const dir=path.resolve(process.argv[2]||'docs/flights-evidence/gap-qa');
const ids=[...new Set(fs.readdirSync(dir).map(f=>/^screen-(\d+)-390\.png$/.exec(f)?.[1]).filter(Boolean))].sort();
const pages=[];
for(let start=0;start<ids.length;start+=3){
  const subset=ids.slice(start,start+3),composite=[];
  for(let row=0;row<subset.length;row++)for(let col=0;col<3;col++){
    const width=[390,768,1440][col],id=subset[row],file=path.join(dir,`screen-${id}-${width}.png`);
    if(!fs.existsSync(file))continue;
    const label=Buffer.from(`<svg width="480" height="30"><rect width="480" height="30" fill="white"/><text x="8" y="21" font-size="17" fill="black">Flights ${id} — ${width}px (local fixture)</text></svg>`);
    composite.push({input:label,left:col*480,top:row*530});
    const thumb=await sharp(file).resize({width:480,height:500,fit:'contain',background:'white'}).png().toBuffer();
    composite.push({input:thumb,left:col*480,top:row*530+30});
  }
  const name=`contact-${String(start/3+1).padStart(2,'0')}.png`;
  await sharp({create:{width:1440,height:subset.length*530,channels:3,background:'white'}}).composite(composite).png().toFile(path.join(dir,name));
  pages.push({file:name,screens:subset,scope:'Macro layout review only; not full-size text, contrast, interaction or visual acceptance'});
}
fs.writeFileSync(path.join(dir,'contact-sheets.json'),JSON.stringify(pages,null,2));
console.log(JSON.stringify(pages));

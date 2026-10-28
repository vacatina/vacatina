import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const out='docs/phase18-evidence';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const protectedFiles={
  'screenshots/vacatina_360px_mobile.png':'9EAE7117379C6A58B7EBCB5C2416B7FDE1E94ED5A911853411E1001DBEA71B83',
  'screenshots/vacatina_footer_1440px.png':'204F32DF10EF52E9D46BFADDEE7FABFC17A53D7F7BA682A7380A0F71EA08FA6D',
  'screenshots/vacatina_holiday_package_modal.png':'583E08E8D37AE6C850DC554535AF2C8E38C2D2D8EC927865A787E8FB2D561B26',
  'screenshots/vacatina_screen04_8states_inspector.png':'724111435606760A5DC35537400425E2FB350AA729724BFF67E3408E73BBA2B2'
};
for(const [file,expected]of Object.entries(protectedFiles))if(hash(file)!==expected)throw new Error('Protected reference changed: '+file);
const main=git('rev-parse','main'),originMain=git('rev-parse','origin/main');
if(main!=='3d6c16a095796236aa021ef89eb84ae003375b4e'||originMain!=='05a4d9af2aa8d11334a9e69a2e298815f79df894')throw new Error('A protected main ref changed.');
const configHash=hash('opencode.json');
if(configHash!=='76944BCA1014BB38403D0C5229B7D7DB380B398A6FC44EDAEBF39EACA1C2201B'||git('ls-files','--','opencode.json'))throw new Error('Private OpenCode configuration changed or became tracked.');
const integrity={sourceCommit:git('rev-parse','HEAD'),main,originMain,protectedFiles,privateConfig:{unchanged:true,tracked:false},designUnchanged:!git('diff','8f72243','--','DESIGN.md'),checkedAt:new Date().toISOString()};
fs.writeFileSync(path.join(out,'integrity.json'),JSON.stringify(integrity,null,2)+'\n');

const images=[];
for(const name of fs.readdirSync(out).filter(n=>n.endsWith('.png')&&!n.startsWith('contact-sheet-')).sort()){
  const file=path.join(out,name),meta=await sharp(file).metadata();
  images.push({file:name,width:meta.width,height:meta.height,sha256:hash(file),scope:name.startsWith('public-')?'LOCAL_BUILT_PUBLIC_DEMO':'ISOLATED_LOCAL_FIXTURE_AUTH'});
}
const sheets=[];
for(let start=0;start<images.length;start+=16){
  const group=images.slice(start,start+16),width=1320,cellWidth=330,cellHeight=278;
  const composites=[];
  for(const [index,image]of group.entries()){
    const x=(index%4)*cellWidth,y=Math.floor(index/4)*cellHeight;
    const thumb=await sharp(path.join(out,image.file)).resize(314,240,{fit:'contain',background:'#eeeeee'}).png().toBuffer();
    const label=image.file.replace(/[&<>]/g,'_');
    const caption=Buffer.from(`<svg width="330" height="30"><rect width="330" height="30" fill="white"/><text x="8" y="18" font-size="10" font-family="sans-serif">${label}</text></svg>`);
    composites.push({input:caption,left:x,top:y},{input:thumb,left:x+8,top:y+30});
  }
  const file='contact-sheet-'+String(sheets.length+1).padStart(2,'0')+'.png';
  await sharp({create:{width,height:Math.ceil(group.length/4)*cellHeight,channels:3,background:'white'}}).composite(composites).png().toFile(path.join(out,file));
  sheets.push(file);
}
fs.writeFileSync(path.join(out,'visual-index.json'),JSON.stringify({images,sheets,reviewRecord:'See PHASE18_HOSTED_DEMO_ACCEPTANCE.md; generation is not visual approval.'},null,2)+'\n');
console.log(JSON.stringify({protectedReferences:'PASS',mainRefs:'UNCHANGED',privateConfig:'UNCHANGED_UNTRACKED',images:images.length,contactSheets:sheets.length,sourceCommit:integrity.sourceCommit}));

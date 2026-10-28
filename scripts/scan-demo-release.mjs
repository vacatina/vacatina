import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:64*1024*1024}).trim();
const rules=[/\bsk_(?:live|test)_[A-Za-z0-9]{24,}/,/\bduffel_(?:live|test)_[A-Za-z0-9_-]{24,}/,/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
function assertSafe(bytes,label){const text=bytes.toString('utf8');if(rules.some(rule=>rule.test(text)))throw new Error('Potential secret detected in '+label+' (value withheld)');}
if(process.argv.includes('--history')){
  const objects=[...new Set(git('rev-list','--objects','HEAD').split('\n').map(line=>line.split(' ')[0]))];
  const metadata=execFileSync('git',['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],{input:objects.join('\n')+'\n',encoding:'utf8',maxBuffer:16*1024*1024});
  const blobs=metadata.trim().split('\n').filter(line=>line.split(' ')[1]==='blob').map(line=>line.split(' ')[0]);
  for(let start=0;start<blobs.length;start+=24){
    const batch=execFileSync('git',['cat-file','--batch'],{input:blobs.slice(start,start+24).join('\n')+'\n',maxBuffer:256*1024*1024});
    let offset=0;while(offset<batch.length){const end=batch.indexOf(10,offset);const [id,,length]=batch.subarray(offset,end).toString('ascii').split(' ');const size=Number(length);offset=end+1;assertSafe(batch.subarray(offset,offset+size),'reachable Git blob '+id);offset+=size+1;}
  }
  for(const file of git('ls-files').split('\n'))if(/(?:^|\/)(?:\.env(?:\..*)?|opencode\.json)$/.test(file)&&file!=='.env.example')throw new Error('Private file tracked: '+file);
  console.log('Reachable release history and tracked private-file checks passed; no other refs scanned or published.');
}else{
  const root='.vercel/output';
  let count=0;const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else{assertSafe(fs.readFileSync(file),file);count++;}}};walk(root);
  const html=fs.readFileSync(path.join(root,'static/index.html'),'utf8');
  if(!html.includes('id="public-demo-notice"')||!html.includes('noindex, nofollow')||!html.includes('<base href="/">')||/<script[^>]+src="[^"]*clerk/i.test(html))throw new Error('Public demo HTML guard failed.');
  const bundle=fs.readFileSync(path.join(root,'static/dist/vacatina.bundle.js'),'utf8');
  if(bundle.includes('electric-snail-48.clerk.accounts.dev'))throw new Error('Historical identity configuration entered the public demo bundle.');
  const release=JSON.parse(fs.readFileSync(path.join(root,'static/demo-release.json'),'utf8'));
  if(release.mode!=='PUBLIC_DEMO'||release.backendQualified!==false||release.transactionsEnabled!==false||release.commit!==git('rev-parse','HEAD'))throw new Error('Incorrect demo release identity.');
  if(fs.readdirSync(path.join(root,'functions')).join(',')!=='demo-api.func')throw new Error('Unexpected hosted API function.');
  const config=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8'));
  if(config.routes[0].dest!=='/demo-api'||JSON.stringify(config).includes('31536000, immutable'))throw new Error('API routing / cache guard failed.');
  console.log(JSON.stringify({publishedFiles:count,secretScan:'PASS',demoConfiguration:'PASS',commit:release.commit}));
}

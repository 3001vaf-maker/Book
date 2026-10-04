import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const skip=new Set(['.git','node_modules']);
const runtimeRoots=new Set(['core','settings','journal','timetable','online-booking','chat','invite','ui','admin','server']);
function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(skip.has(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
const rel=(file)=>path.relative(root,file).replaceAll(path.sep,'/');
for(const file of walk(root)){
  const r=rel(file);
  const top=r.split('/')[0];
  if(!runtimeRoots.has(top)) continue;
  if(r.startsWith('server/prisma/migrations/')||r.startsWith('server/scripts/')) continue;
  if(!/\.(js|mjs|ts|css|html)$/.test(r)) continue;
  const base=path.basename(r).toLowerCase();
  if(/(?:^|[-_.])(legacy|bridge|compat|migration)(?:[-_.]|$)/.test(base)){
    failures.push(`${r}: runtime filename contains a forbidden transition marker`);
  }
  const source=fs.readFileSync(file,'utf8');
  if(/legacy|compat(?:ibility)?|\bmigration\b|\bbridge\b/i.test(source)
    || /migrationVerifiedAt|verifyMigration|\/migrate(?:\/|['"`])|readLegacy|legacyFormat/.test(source)){
    failures.push(`${r}: runtime transition bridge/terminology is forbidden`);
  }

  if(/\b(?:business|operational|documents|auxiliary)\??\.verified\b|payload\??\.verified\b/.test(source)){
    failures.push(`${r}: canonical state owner must not depend on retired verification flags`);
  }

  if(!r.startsWith('ui/') && (
    /addEventListener\(\s*['"](?:pointerdown|pointermove|pointerup|pointercancel|touchstart|touchmove|touchend)['"]/.test(source)
    || /\b(?:setPointerCapture|releasePointerCapture)\s*\(/.test(source)
    || (/\.css$/.test(r) && /touch-action\s*:/.test(source))
  )){
    failures.push(`${r}: gesture ownership is forbidden outside Shared UI`);
  }
}
for(const retired of [
  'business-migration.js','operational-migration.js','auxiliary-migration.js',
  'tenant-document-archive.js','core/legacy-browser-business.js','settings/profile/migration.js',
]){
  if(fs.existsSync(path.join(root,retired))) failures.push(`${retired}: retired runtime bridge must not exist`);
}
if(!fs.existsSync(path.join(root,'PROJECT_STATE.md'))) failures.push('PROJECT_STATE.md is required');
if(!fs.existsSync(path.join(root,'UI_ALPHABET.md'))) failures.push('UI_ALPHABET.md is required');
const branch=String(process.env.GITHUB_REF_NAME||'');
if(branch && branch!=='main' && branch!=='staging') failures.push(`branch ${branch}: only main/staging are allowed`);
if(failures.length){
  console.error('project contract check: FAILED');
  failures.forEach((item)=>console.error(`- ${item}`));
  process.exit(1);
}
console.log('project contract check: OK');

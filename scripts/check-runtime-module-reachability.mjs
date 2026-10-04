import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const runtimeRoots=['core','settings','journal','timetable','online-booking','chat','ui','admin','invite'];
const ignoredDirs=new Set(['.git','node_modules','_site','tests','scripts','server']);
const failures=[];

function walk(dir){
  const out=[];
  if(!fs.existsSync(dir)) return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
const rel=(file)=>path.relative(root,file).replaceAll(path.sep,'/');
const runtimeFiles=new Set([
  ...runtimeRoots.flatMap((dir)=>walk(path.join(root,dir))),
  path.join(root,'core.js'),
  path.join(root,'service-worker.js'),
].filter((file)=>file.endsWith('.js')&&fs.existsSync(file)).map(rel));

const entries=new Set(['service-worker.js']);
for(const file of walk(root).filter((file)=>file.endsWith('.html'))){
  if(rel(file).startsWith('tests/')) continue;
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)(?:\?[^"']*)?["'][^>]*>/gi)){
    const spec=String(match[1]||'').trim();
    if(!spec || /^(?:https?:|\/\/)/i.test(spec)) continue;
    const target=spec.startsWith('/')
      ? path.join(root,spec.replace(/^\/+/,'')) 
      : path.resolve(path.dirname(file),spec);
    if(fs.existsSync(target)) entries.add(rel(target));
  }
}

function imports(file){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const specs=[];
  for(const pattern of [
    /\bfrom\s*(['"])([^'"]+)\1/g,
    /\bimport\s*(['"])([^'"]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  ]){
    for(const match of source.matchAll(pattern)) specs.push(match[2]);
  }
  return specs.filter((s)=>s.startsWith('.')).map((s)=>{
    const clean=s.split(/[?#]/)[0];
    return rel(path.resolve(path.dirname(path.join(root,file)),clean));
  }).filter((target)=>runtimeFiles.has(target));
}

const reachable=new Set();
const queue=[...entries].filter((entry)=>runtimeFiles.has(entry));
while(queue.length){
  const file=queue.shift();
  if(reachable.has(file)) continue;
  reachable.add(file);
  for(const target of imports(file)) if(!reachable.has(target)) queue.push(target);
}

const orphan=[...runtimeFiles].filter((file)=>!reachable.has(file)).sort();
if(orphan.length){
  console.error('runtime module reachability check: FAILED');
  orphan.forEach((file)=>console.error(`- ${file}: runtime JS is unreachable from every real application entry`));
  process.exit(1);
}
console.log(`runtime module reachability check: OK (${reachable.size} modules)`);

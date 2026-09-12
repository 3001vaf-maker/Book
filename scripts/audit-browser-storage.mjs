import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXTENSIONS = new Set(['.js', '.mjs', '.html']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'server']);
const STORAGE_PATTERN = /\b(localStorage|sessionStorage|indexedDB|caches\b|CacheStorage|document\.cookie|window\.name)\b/;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const matches = [];
for (const file of walk(ROOT)) {
  const relative = path.relative(ROOT, file).replaceAll(path.sep, '/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (STORAGE_PATTERN.test(line)) matches.push(`${relative}:${index + 1}: ${line.trim()}`);
  });
}

console.log(`browser storage audit: ${matches.length} reference(s)`);
for (const match of matches) console.log(match);

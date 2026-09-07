import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const skipped = new Set(['.git', 'node_modules']);
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skipped.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (/\.(?:js|mjs)$/.test(name)) files.push(path);
  }
}

walk(root);

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(`Syntax check failed: ${relative(root, file)}\n`);
    process.stderr.write(result.stderr || result.stdout || '');
    process.exit(result.status || 1);
  }
}

console.log(`syntax check: OK (${files.length} files)`);

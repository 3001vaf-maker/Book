import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const skippedDirectories = new Set([
  '.git', '.github', 'node_modules', '_site', 'tests', 'docs', 'scripts',
]);
const allowedExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.html', '.css', '.json']);
const violations = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!allowedExtensions.has(extname(entry.name))) continue;
    const source = await readFile(full, 'utf8');
    source.split('\n').forEach((line, index) => {
      if (/мастер[а-яё]*/iu.test(line)) {
        violations.push(`${relative(root, full)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

await walk(root);

if (violations.length) {
  console.error('Profession-bound user terminology found in runtime code:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('neutral user terminology: OK');

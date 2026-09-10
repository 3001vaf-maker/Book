import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const runtimeRoots = ['main', 'settings', 'timetable', 'journal', 'ui', 'core', 'chat'];
const forbidden = /\b(?:window\.)?(?:alert|confirm)\s*\(/;
const errors = [];

function walk(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...walk(path));
    else if (/\.js$/.test(name)) result.push(path);
  }
  return result;
}

const files = [
  join(root, 'core.js'),
  ...runtimeRoots.flatMap((dir) => walk(join(root, dir))),
];

for (const file of files) {
  if (!forbidden.test(readFileSync(file, 'utf8'))) continue;
  errors.push(`${relative(root, file)}: native alert/confirm is forbidden; use shared Book modal UI`);
}

if (errors.length) {
  console.error('native dialog check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`native dialog check: OK (${files.length} runtime files)`);

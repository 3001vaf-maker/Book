import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const runtimeRoots = ['main', 'settings', 'timetable', 'journal', 'ui', 'core', 'chat', 'online-booking'];
const globalForbidden = /\b(?:window\.)?(?:alert|confirm)\s*\(/;
const endUserForbidden = /(?:\b(?:window\.)?(?:alert|confirm|prompt)\s*\(|\.\s*(?:reportValidity|setCustomValidity)\s*\()/;
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
  const fileName = relative(root, file);
  const source = readFileSync(file, 'utf8');
  const endUserSurface = fileName.startsWith('online-booking/') || fileName.startsWith('ui/');
  const forbidden = endUserSurface ? endUserForbidden : globalForbidden;
  if (!forbidden.test(source)) continue;
  errors.push(`${fileName}: native browser/system message UI is forbidden; use shared V2 UI`);
}

if (errors.length) {
  console.error('native dialog check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`native dialog check: OK (${files.length} runtime files)`);

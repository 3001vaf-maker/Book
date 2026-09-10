import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const files = [
  'journal/record.js',
  'journal/record-view.js',
];
const forbidden = /\b(?:window\.)?(?:alert|confirm)\s*\(/;
const errors = [];

for (const relative of files) {
  const source = readFileSync(join(root, relative), 'utf8');
  if (forbidden.test(source)) errors.push(`${relative}: native alert/confirm is forbidden; use shared Book modal UI`);
}

if (errors.length) {
  console.error('native dialog check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('native dialog check: OK');

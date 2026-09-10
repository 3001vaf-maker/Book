import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const files = [
  'journal/record.js',
  'journal/record-view.js',
];
const nativeDialog = /\b(?:window\.)?(?:alert|confirm)\s*\(\s*(['"])(.*?)\1\s*\)/g;
const known = new Set([
  'journal/record.js::Это время находится вне рабочего периода.',
  'journal/record.js::Это время уже занято.',
  'journal/record-view.js::Новая длительность не помещается в свободный интервал. Выберите другое время.',
  'journal/record-view.js::Не удалось сохранить изменения: проверьте рабочий день и свободное время.',
]);
const errors = [];

for (const relative of files) {
  const source = readFileSync(join(root, relative), 'utf8');
  for (const match of source.matchAll(nativeDialog)) {
    const key = `${relative}::${match[2]}`;
    if (!known.has(key)) errors.push(`${relative}: new native alert/confirm is forbidden; use shared Book modal UI`);
  }
}

if (errors.length) {
  console.error('native dialog check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('native dialog check: OK (4 known journal dialogs remain to migrate)');

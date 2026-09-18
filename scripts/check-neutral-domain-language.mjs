import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const roots = [
  'core',
  'main',
  'settings',
  'admin',
  'invite',
  'register',
  'online-booking',
  'journal',
  'timetable',
  'ui',
  'server/src',
];
const singleFiles = [
  'core.js',
  'index.html',
  'server/prisma/schema.prisma',
  'server/prisma/seed-owner.ts',
];

const allowedExtensions = new Set(['.js', '.mjs', '.ts', '.html', '.css', '.prisma']);
const banned = [
  { label: 'master', regex: /\bmaster\b/iu },
  { label: 'client', regex: /\bclient\b/iu },
  { label: 'salon', regex: /\bsalon\b/iu },
  { label: 'Book', regex: /\bbook\b/iu },
  { label: 'мастер', regex: /мастер/iu },
  { label: 'клиент', regex: /клиент/iu },
  { label: 'салон', regex: /салон/iu },
];

function filesIn(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => filesIn(join(path, name)));
}

function neutralizedLine(line) {
  return line
    .replaceAll('https://book.va-tools.ru', 'https://workspace.example')
    .replaceAll('https://client.va-tools.ru', 'https://public.example')
    .replaceAll("'book.va-tools.ru'", "'workspace.example'")
    .replaceAll("'client.va-tools.ru'", "'public.example'");
}

const files = [
  ...roots.flatMap((path) => filesIn(join(root, path))),
  ...singleFiles.map((path) => join(root, path)).filter(existsSync),
].filter((path) => allowedExtensions.has(extname(path)) || path.endsWith('.prisma'));

const failures = [];
for (const path of files) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const checked = neutralizedLine(line);
    for (const rule of banned) {
      if (!rule.regex.test(checked)) continue;
      failures.push(`${relative(root, path)}:${index + 1}: ${rule.label}: ${line.trim()}`);
    }
  });
}

if (failures.length) {
  console.error('Non-neutral domain language found:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('neutral domain language check: OK');

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const self = relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');

const protectedTerms = [
  ['Парик', 'махер'].join(''),
  ['Коло', 'рист'].join(''),
  ['Бар', 'бер'].join(''),
  ['Виза', 'жист'].join(''),
  ['Сти', 'лист'].join(''),
  ['Мани', 'кюр'].join(''),
  ['Педи', 'кюр'].join(''),
  ['Бро', 'вист'].join(''),
  ['Лэш', 'мейкер'].join(''),
  ['Косме', 'толог'].join(''),
  ['Масса', 'жист'].join(''),
  ['Наращивание ', 'волос'].join(''),
  ['Перманентный ', 'макияж'].join(''),
  ['Тре', 'нер'].join(''),
  ['Убор', 'щик'].join(''),
  ['Вр', 'ач'].join(''),
  ['Док', 'тор'].join(''),
  ['Уч', 'итель'].join(''),
  ['Препода', 'ватель'].join(''),
  ['Консуль', 'тант'].join(''),
  ['hair', 'dresser'].join(''),
  ['train', 'er'].join(''),
  ['clean', 'er'].join(''),
  ['doc', 'tor'].join(''),
  ['teach', 'er'].join(''),
  ['consult', 'ant'].join(''),
].map((value) => value.toLocaleLowerCase('ru-RU'));

const extensions = new Set(['.js', '.mjs', '.ts', '.prisma', '.html', '.json']);
const excludedPrefixes = [
  'node_modules/',
  '.git/',
  'server/prisma/migrations/',
  'docs/',
];

function extension(path) {
  const index = path.lastIndexOf('.');
  return index < 0 ? '' : path.slice(index);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    const rel = relative(root, full).replaceAll('\\', '/');
    if (excludedPrefixes.some((prefix) => rel === prefix.slice(0, -1) || rel.startsWith(prefix))) return [];
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full);
    if (!extensions.has(extension(rel)) || rel === self) return [];
    return [rel];
  });
}

function isProfessionDataLiteral(line, term) {
  const normalizedLine = line.toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
  return normalizedLine.includes(`profession: '${term}'`)
    || normalizedLine.includes(`profession: "${term}"`);
}

const literalViolations = [];
const structuralViolations = [];
for (const path of walk(root)) {
  const lines = readFileSync(resolve(root, path), 'utf8').split('\n');

  lines.forEach((line, index) => {
    const normalized = line.toLocaleLowerCase('ru-RU');

    for (const term of protectedTerms) {
      if (normalized.includes(term) && !isProfessionDataLiteral(line, term)) {
        literalViolations.push(`${path}:${index + 1}: ${line.trim()}`);
        break;
      }
    }

    if (/\b(title|heading|header|aria|route|path|screen|section)\b[^\n]*\bprofession(?:About)?\b/i.test(line)
      || /\bprofession(?:About)?\b[^\n]*\b(title|heading|header|aria|route|path|screen|section)\b/i.test(line)
      || /<h[1-6][^>]*>[^\n]*\bprofession(?:About)?\b/i.test(line)) {
      structuralViolations.push(`${path}:${index + 1}: ${line.trim()}`);
    }
  });
}

assert.deepEqual(
  literalViolations,
  [],
  `Profession labels escaped Profile.profession into system code/UI:\n${literalViolations.join('\n')}`,
);

assert.deepEqual(
  structuralViolations,
  [],
  `Profile.profession is being used to define system/UI structure:\n${structuralViolations.join('\n')}`,
);

console.log('Profile profession neutrality guard: OK');

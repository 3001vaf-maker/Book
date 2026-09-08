import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', '_site']);
const errors = [];

function walk(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) result.push(...walk(file));
    else if (/\.(?:js|mjs)$/.test(name)) result.push(file);
  }
  return result;
}

function rel(file) {
  return relative(root, file).replaceAll('\\', '/');
}

function report(file, specifier) {
  errors.push(`${rel(file)}: internal module specifier must be canonical: ${specifier}`);
}

const modulePatterns = [
  /\bfrom\s*(['"])([^'"]+)\1/g,
  /\bimport\s*(['"])([^'"]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
];

for (const file of walk(root)) {
  const source = readFileSync(file, 'utf8');
  for (const pattern of modulePatterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[2] || '';
      if (!specifier.startsWith('.') || !/\.(?:js|mjs)(?:[?#].*)?$/.test(specifier)) continue;
      if (/[?#]/.test(specifier)) report(file, specifier);
    }
  }
}

const indexFile = join(root, 'index.html');
const indexSource = readFileSync(indexFile, 'utf8');
for (const match of indexSource.matchAll(/\b(?:src|href)\s*=\s*(['"])([^'"]+)\1/g)) {
  const specifier = match[2] || '';
  if (/^(?:https?:|data:|\/\/)/.test(specifier)) continue;
  if (/\.(?:js|css)(?:[?#].*)?$/.test(specifier) && /[?#]/.test(specifier)) {
    errors.push(`index.html: source asset reference must be canonical: ${specifier}`);
  }
}

if (errors.length) {
  console.error('canonical import check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('canonical import check: OK');

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', '_site']);
const errors = [];
const domains = ['day', 'time', 'record', 'finance'];
const legacyFiles = [
  'core/day.js',
  'core/day-data.js',
  'core/day-read.js',
  'core/day-rules.js',
  'core/day-service.js',
  'core/day-workplaces.js',
  'core/time.js',
  'core/time-grid.js',
  'core/time-usage.js',
  'core/availability.js',
  'journal/record-data.js',
  'journal/record-read.js',
  'journal/record-service.js',
  'journal/record-events.js',
  'journal/record-state.js',
  'journal/record-finance.js',
  'core/dds.js',
  'core/financial-model.js',
];

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) files.push(...walk(file));
    else if (/\.(?:js|mjs)$/.test(name)) files.push(file);
  }
  return files;
}

function rel(file) {
  return relative(root, file).replaceAll('\\', '/');
}

function imports(source) {
  const result = [];
  const patterns = [
    /\bfrom\s*(['"])([^'"]+)\1/g,
    /\bimport\s*(['"])([^'"]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  ];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) result.push(match[2]);
  return result;
}

for (const domain of domains) {
  const index = join(root, 'core', domain, 'index.js');
  if (!existsSync(index)) errors.push(`core/${domain}/index.js: missing public domain contract`);
}

for (const path of legacyFiles) {
  if (existsSync(join(root, path))) errors.push(`${path}: legacy parallel owner must be deleted`);
}

for (const file of walk(root)) {
  const path = rel(file);
  const source = readFileSync(file, 'utf8');
  const ownerMatch = path.match(/^core\/(day|time|record|finance)\//);
  const owner = ownerMatch?.[1] || '';

  for (const specifier of imports(source)) {
    if (!specifier.startsWith('.')) continue;
    const resolved = rel(resolve(dirname(file), specifier));
    if (legacyFiles.includes(resolved)) {
      errors.push(`${path}: imports removed legacy domain owner ${resolved}`);
      continue;
    }
    const targetMatch = resolved.match(/^core\/(day|time|record|finance)\/(.+)$/);
    if (!targetMatch) continue;
    const targetDomain = targetMatch[1];
    const targetFile = targetMatch[2];
    if (owner === targetDomain) continue;
    if (targetFile !== 'index.js') {
      errors.push(`${path}: must import ${targetDomain} only through core/${targetDomain}/index.js (found ${resolved})`);
    }
  }
}

for (const domain of domains) {
  const base = join(root, 'core', domain);
  const dataPath = join(base, 'data.js');
  const rulesPath = join(base, 'rules.js');
  const readPath = join(base, 'read.js');
  const servicePath = join(base, 'service.js');
  const indexPath = join(base, 'index.js');

  if (existsSync(dataPath)) {
    const source = readFileSync(dataPath, 'utf8');
    if (/\b(?:document|window)\b|CustomEvent|\.\/rules\.js|\.\/service\.js|\.\.\/[^'"\n]+\/index\.js/.test(source)) {
      errors.push(`core/${domain}/data.js: persistence must not own UI, rules, service, or cross-domain orchestration`);
    }
  }
  if (existsSync(rulesPath)) {
    const source = readFileSync(rulesPath, 'utf8');
    if (/localStorage|sessionStorage|\b(?:document|window)\b|CustomEvent|\.\/data\.js|\.\/service\.js/.test(source)) {
      errors.push(`core/${domain}/rules.js: rules must stay pure`);
    }
  }
  if (existsSync(readPath)) {
    const source = readFileSync(readPath, 'utf8');
    if (/localStorage\.(?:setItem|removeItem|clear)|sessionStorage\.(?:setItem|removeItem|clear)|CustomEvent|\.\/service\.js/.test(source)) {
      errors.push(`core/${domain}/read.js: read model must not mutate domain state`);
    }
  }
  if (existsSync(servicePath)) {
    const source = readFileSync(servicePath, 'utf8');
    if (/\b(?:document\.querySelector|innerHTML|mountModal|render[A-Z]|modal\()/.test(source)) {
      errors.push(`core/${domain}/service.js: service must not render UI`);
    }
  }
  if (existsSync(indexPath)) {
    const source = readFileSync(indexPath, 'utf8');
    if (/localStorage|sessionStorage|\b(?:document|window)\b|CustomEvent/.test(source)) {
      errors.push(`core/${domain}/index.js: public facade must not invent storage or runtime behavior`);
    }
  }
}

if (errors.length) {
  console.error('domain architecture check: FAILED');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('domain architecture check: OK');

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', 'docs']);
const IMMUTABLE_PREFIXES = ['server/prisma/migrations/'];
const TEXT_EXTENSIONS = new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.html','.json','.prisma','.yml','.yaml']);

const allowedContent = [
  /PrismaClient/g,
  /client(?:X|Y|Width|Height|Left|Top)\b/g,
  /Booking\w*/g,
  /booking[-_\w]*/gi,
];

const forbiddenContent = [
  { label: 'profession-bound master', re: /\bMASTER\b|\bMaster(?!card)\w*|\bmaster(?:Invitation|Registration|Profile|Account|User|Id|ID|Key|Name|Token|Consent|Route|Card|Thread|Contact|Access|Role|State|Mode|Source|Event|Tag)\w*|\bmaster[-_](?!piece)\w*/g },
  { label: 'role-bound client', re: /\bClient(?:Contact|Profile|Card|Account|Runtime|Route|Thread|Link|Data|Metadata|State|View|Presentation|Create|Id|ID|Key|Name|Token|Consent|Source|Event)\w*|\bclient(?:Contact|Profile|Card|Account|Runtime|Route|Thread|Link|Data|Metadata|State|View|Presentation|Create|Id|ID|Key|Name|Token|Consent|Source|Event)\w*|\bclient[-_]\w*/g },
  { label: 'business-type salon', re: /\bSalon\w*|\bsalon[-_\w]*/g },
  { label: 'product-bound Book identifier', re: /\bBook(?!ing)\w+|\bbook(?!ing)(?:[A-Z_]\w*|[-_]\w+)/g },
];

const forbiddenPath = /(^|\/)(?:master|client|salon)(?:[-_\/]|$)|(?:^|\/)[^/]*\bbook(?!ing)[^/]*(?:\/|$)/i;

function collect(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(ROOT, absolute).replaceAll('\\', '/');
    if (IMMUTABLE_PREFIXES.some((prefix) => relative.startsWith(prefix))) continue;
    if (entry.isDirectory()) collect(absolute, acc);
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) acc.push({ absolute, relative });
  }
  return acc;
}

function maskAllowed(content) {
  let masked = content;
  for (const re of allowedContent) masked = masked.replace(re, (value) => ' '.repeat(value.length));
  return masked;
}

const failures = [];
for (const file of collect(ROOT)) {
  if (forbiddenPath.test(file.relative)) failures.push(`${file.relative}: forbidden role/product term in active path`);
  const original = fs.readFileSync(file.absolute, 'utf8');
  const content = maskAllowed(original);
  for (const rule of forbiddenContent) {
    const matches = [...content.matchAll(rule.re)];
    for (const match of matches) {
      const line = content.slice(0, match.index).split('\n').length;
      failures.push(`${file.relative}:${line}: ${rule.label}: ${match[0]}`);
    }
  }
}

if (failures.length) {
  console.error('Neutral domain language check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Neutral domain language check passed.');

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXTENSIONS = new Set(['.js', '.mjs', '.html']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'server', 'tests', 'scripts']);
const STORAGE_PATTERN = /\b(localStorage|sessionStorage|indexedDB|caches\b|CacheStorage|document\.cookie|window\.name)\b/;

const TECHNICAL_STORAGE_OWNERS = new Set([
  'core/auth.js',
  'core/account/index.js',
  'core/workplace-context.js',
  'core/people/view-state.js',
  'onboarding/onboarding.js',
]);

const ALLOWED = new Set([...TECHNICAL_STORAGE_OWNERS]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function source(file) {
  return fs.readFileSync(file, 'utf8');
}

const violations = [];
for (const file of walk(ROOT)) {
  const relative = path.relative(ROOT, file).replaceAll(path.sep, '/');
  const text = source(file);
  if (!STORAGE_PATTERN.test(text)) continue;
  if (!ALLOWED.has(relative)) violations.push(`${relative}: browser storage is forbidden outside technical/UI owners`);
}

if (fs.existsSync(path.join(ROOT, 'core/workspace-sync.js'))) {
  violations.push('core/workspace-sync.js: legacy browser database mirroring is forbidden');
}

const core = source(path.join(ROOT, 'core.js'));
if (/clearLegacyBusinessStorage|legacy-browser-business|workspace-sync/.test(core)) {
  violations.push('core.js: runtime cleanup/mirroring bridges are forbidden');
}

if (violations.length) {
  console.error('browser storage ownership check failed:');
  violations.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`browser storage ownership check: OK (${TECHNICAL_STORAGE_OWNERS.size} technical/UI owners; business storage forbidden)`);

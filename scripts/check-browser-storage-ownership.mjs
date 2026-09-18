import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXTENSIONS = new Set(['.js', '.mjs', '.html']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'server', 'tests', 'scripts']);
const STORAGE_PATTERN = /\b(localStorage|sessionStorage|indexedDB|caches\b|CacheStorage|document\.cookie|window\.name)\b/;

const TECHNICAL_STORAGE_OWNERS = new Set([
  'core/auth.js',
  'core/booking-account/index.js',
  'core/workplace-context.js',
  'main/clients/view-state.js',
  'onboarding/onboarding.js',
]);

const CLEANUP_OWNER = 'core/legacy-browser-business.js';
const ALLOWED = new Set([...TECHNICAL_STORAGE_OWNERS, CLEANUP_OWNER]);

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
const auxiliaryCheck = core.indexOf('if (!auxiliaryMigration.verified)');
const cleanupCall = core.indexOf('clearLegacyBusinessStorage();');
const workspaceRender = core.indexOf('ensureServerBookingSync();');
if (cleanupCall < 0) violations.push('core.js: verified server startup must purge stale legacy business storage');
if (!(auxiliaryCheck >= 0 && cleanupCall > auxiliaryCheck && workspaceRender > cleanupCall)) {
  violations.push('core.js: stale legacy business storage may only be purged after every server domain is verified and before workspace runtime starts');
}

const cleanup = source(path.join(ROOT, CLEANUP_OWNER));
for (const requiredTechnicalKey of [
  'book.booking-account.token.',
  'book.booking-account.email.',
  'book.people.sort',
  'book.onboarding.',
  'book:workplace-context',
]) {
  if (!cleanup.includes(requiredTechnicalKey)) {
    violations.push(`${CLEANUP_OWNER}: technical/session/UI preservation rule is missing: ${requiredTechnicalKey}`);
  }
}
if (/book\.(?:workplaces|records)|book\.journalBreaks/.test(cleanup)) {
  violations.push(`${CLEANUP_OWNER}: cleanup must stay entity-agnostic and must not duplicate canonical business storage keys`);
}

if (violations.length) {
  console.error('browser storage ownership check failed:');
  violations.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`browser storage ownership check: OK (${TECHNICAL_STORAGE_OWNERS.size} technical/UI owners; business storage forbidden)`);

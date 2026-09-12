import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXTENSIONS = new Set(['.js', '.mjs', '.html']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'server', 'tests', 'scripts']);
const STORAGE_PATTERN = /\b(localStorage|sessionStorage|indexedDB|caches\b|CacheStorage|document\.cookie|window\.name)\b/;
const STORAGE_WRITE_PATTERN = /\blocalStorage\.(?:setItem|removeItem|clear)\s*\(/;

const TECHNICAL_STORAGE_OWNERS = new Set([
  'core/auth.js',
  'core/booking-account/index.js',
  'core/workplace-context.js',
  'main/clients/view-state.js',
  'onboarding/onboarding.js',
]);

const LEGACY_MIGRATION_OWNERS = new Set([
  'core/booking-settings/index.js',
  'core/day/data.js',
  'core/finance/data.js',
  'core/record/data.js',
  'core/uei.js',
  'journal/break-data.js',
  'main/clients/data.js',
  'settings/documents/consents.js',
  'settings/documents/data.js',
  'settings/documents/history.js',
  'settings/profile/data.js',
  'settings/profile/workplaces/data.js',
  'settings/service/procedures/data.js',
  'settings/service/products/data.js',
  'settings/tags/data.js',
  'settings/wallets/data.js',
]);

const READ_ONLY_LEGACY_MIGRATION_OWNERS = new Set(LEGACY_MIGRATION_OWNERS);

const CLEANUP_OWNER = 'core/legacy-browser-business.js';
const ALLOWED = new Set([...TECHNICAL_STORAGE_OWNERS, ...LEGACY_MIGRATION_OWNERS, CLEANUP_OWNER]);

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
  if (!ALLOWED.has(relative)) violations.push(`${relative}: browser storage has no approved owner role`);
}

for (const relative of READ_ONLY_LEGACY_MIGRATION_OWNERS) {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) {
    violations.push(`${relative}: read-only legacy migration owner is missing`);
    continue;
  }
  if (STORAGE_WRITE_PATTERN.test(source(file))) {
    violations.push(`${relative}: legacy migration may read browser business data but may not write it`);
  }
}

if (fs.existsSync(path.join(ROOT, 'core/workspace-sync.js'))) {
  violations.push('core/workspace-sync.js: legacy browser database mirroring is forbidden');
}

const core = source(path.join(ROOT, 'core.js'));
const auxiliaryCheck = core.indexOf('if (!auxiliaryMigration.verified)');
const cleanupCall = core.indexOf('clearLegacyBusinessStorage();');
const workspaceRender = core.indexOf('ensureServerBookingSync();');
if (cleanupCall < 0) violations.push('core.js: verified server startup must purge legacy business storage');
if (!(auxiliaryCheck >= 0 && cleanupCall > auxiliaryCheck && workspaceRender > cleanupCall)) {
  violations.push('core.js: legacy business storage may only be purged after every server migration is verified and before workspace runtime starts');
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

console.log(`browser storage ownership check: OK (${TECHNICAL_STORAGE_OWNERS.size} technical owners, ${LEGACY_MIGRATION_OWNERS.size} legacy migration owners, all legacy owners read-only)`);

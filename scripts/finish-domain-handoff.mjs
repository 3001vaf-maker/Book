import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const legacyTargets = new Map([
  ['core/day.js', 'core/day/index.js'],
  ['core/day-data.js', 'core/day/index.js'],
  ['core/day-read.js', 'core/day/index.js'],
  ['core/day-rules.js', 'core/day/index.js'],
  ['core/day-service.js', 'core/day/index.js'],
  ['core/day-workplaces.js', 'core/day/index.js'],
  ['core/time.js', 'core/time/index.js'],
  ['core/time-grid.js', 'core/time/index.js'],
  ['core/time-usage.js', 'core/time/index.js'],
  ['core/availability.js', 'core/time/index.js'],
  ['journal/record-data.js', 'core/record/index.js'],
  ['journal/record-read.js', 'core/record/index.js'],
  ['journal/record-service.js', 'core/record/index.js'],
  ['journal/record-events.js', 'core/record/index.js'],
  ['journal/record-state.js', 'core/record/index.js'],
  ['journal/record-finance.js', 'core/record/index.js'],
  ['core/dds.js', 'core/finance/index.js'],
  ['core/financial-model.js', 'core/finance/index.js'],
]);

const ignored = new Set(['.git', 'node_modules', '_site', 'server']);

function repoPath(file) {
  return relative(root, file).replaceAll('\\', '/');
}

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

function canonicalSpecifier(file, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const target = repoPath(resolve(dirname(file), specifier));
  const canonical = legacyTargets.get(target);
  if (!canonical) return specifier;
  let next = relative(dirname(file), join(root, canonical)).replaceAll('\\', '/');
  if (!next.startsWith('.')) next = `./${next}`;
  return next;
}

function rewriteImports(file) {
  let source = readFileSync(file, 'utf8');
  const pattern = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])([^'"]+)(['"])/g;
  source = source.replace(pattern, (match, prefix, quote, specifier, closing) => {
    if (quote !== closing) return match;
    const next = canonicalSpecifier(file, specifier);
    return `${prefix}${quote}${next}${closing}`;
  });
  writeFileSync(file, source);
}

for (const file of walk(root)) {
  const path = repoPath(file);
  if (path === 'scripts/finish-domain-handoff.mjs') continue;
  rewriteImports(file);
}

function edit(path, transform) {
  const file = join(root, path);
  if (!existsSync(file)) return;
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) writeFileSync(file, after);
}

// Lifecycle test verifies persistence shape without importing a private Record atom.
edit('tests/record-lifecycle.test.mjs', (source) => source
  .replace(/import \{ getRecordRow \} from ['"]\.\.\/core\/record\/index\.js['"];\n/, '')
  .replace('const stored = getRecordRow(record.id);', "const stored = JSON.parse(localStorage.getItem('book.records') || '[]').find((item) => item?.id === record.id);"));

// Source-inspection tests point at canonical internal atoms only when they intentionally inspect implementation.
edit('tests/payment-refund.test.mjs', (source) => source.replace("new URL('../core/dds.js', import.meta.url)", "new URL('../core/finance/service.js', import.meta.url)"));
edit('tests/time-ui-ownership.test.mjs', (source) => source.replace("new URL('../core/time-usage.js', import.meta.url)", "new URL('../core/time/usage.js', import.meta.url)"));

// Record ownership checker follows the canonical owner folder.
edit('scripts/check-record-ownership.mjs', (source) => source
  .replaceAll('journal/record-data.js', 'core/record/data.js')
  .replaceAll('journal/record-read.js', 'core/record/read.js')
  .replaceAll('journal/record-service.js', 'core/record/service.js')
  .replaceAll('journal/record-events.js', 'core/record/events.js')
  .replaceAll('journal/record-state.js', 'core/record/state.js'));

// Time/UI checker inspects canonical atoms, while manifestations must consume the public Time facade.
edit('scripts/check-time-ui-ownership.mjs', (source) => source
  .replace("read('core/time-usage.js')", "read('core/time/usage.js')")
  .replace("read('core/time-grid.js')", "read('core/time/grid.js')")
  .replace("read('core/availability.js')", "read('core/time/availability.js')")
  .replaceAll("from ['\"]\\.\\.\\/core\\/availability\\.js['\"]", "from ['\"]\\.\\.\\/core\\/time\\/index\\.js['\"]")
  .replaceAll("from ['\"]\\.\\.\\/core\\/(?:day|time-usage|time-grid)\\.js['\"]", "from ['\"]\\.\\.\\/core\\/(?:day|time)\\/(?!index\\.js)[^'\"]+['\"]"));

// Calendar/workplace checker inspects the new owner atoms directly.
edit('scripts/check-calendar-workplace-architecture.mjs', (source) => source
  .replace("read('core/day-workplaces.js')", "read('core/day/workplaces.js')")
  .replace("read('core/time-grid.js')", "read('core/time/grid.js')")
  .replace("read('core/availability.js')", "read('core/time/availability.js')")
  .replace("read('journal/record-data.js')", "read('core/record/data.js')")
  .replace("read('journal/record-service.js')", "read('core/record/service.js')")
  .replace("read('core/time-usage.js')", "read('core/time/usage.js')"));

// Reference checker keeps the same product/UI rules, but points storage ownership at canonical Core.
edit('scripts/check-reference-architecture.mjs', (source) => source
  .replace("const journalDataOwners = new Set(['journal/record-data.js', 'journal/break-data.js']);", "const journalDataOwners = new Set(['journal/break-data.js']);")
  .replace("['book.records', 'journal/record-data.js']", "['book.records', 'core/record/data.js']")
  .replace("const dayOwner = join(root, 'core/day.js');", "const dayOwner = join(root, 'core/day/data.js');")
  .replace('legacy Record compatibility bridge is forbidden; journal/record-data.js is the canonical Record owner', 'legacy Record compatibility bridge is forbidden; core/record/ is the canonical Record owner'));

// Finance checker is upgraded from the two legacy owners to the canonical finance atom model.
edit('scripts/check-finance-architecture.mjs', (source) => {
  let next = source
    .replaceAll("'core/dds.js'", "'core/finance/data.js'")
    .replaceAll("'core/financial-model.js'", "'core/finance/rules.js'")
    .replaceAll('core/dds.js', 'core/finance/index.js')
    .replaceAll('core/financial-model.js', 'core/finance/index.js');
  next = next.replace(
    /const dds = source\('core\/finance\/data\.js'\);[\s\S]*?const walletData = source\('settings\/wallets\/data\.js'\);/,
    `const financeData = source('core/finance/data.js');\nif (!/const STORAGE_KEY = ['\"]book\\.dds['\"]/.test(financeData)) errors.push('core/finance/data.js must own DDS movement persistence');\n\nconst financeService = source('core/finance/service.js');\nif (!/export function recordPaymentIncome/.test(financeService) || !/export function recordRefundExpense/.test(financeService)) {\n  errors.push('core/finance/service.js must own payment income and refund expense commands');\n}\n\nconst financeRules = source('core/finance/rules.js');\nif (!/export function calculateFinancialPlan/.test(financeRules) || !/export function calculateFinancialFact/.test(financeRules)) {\n  errors.push('core/finance/rules.js must own financial plan/fact calculations');\n}\nif (!/export function recordFinancialItems/.test(financeRules) || !/sourceType:\\s*'product'/.test(financeRules)) {\n  errors.push('Finance rules must assemble both procedure and product Record sources');\n}\n\nconst financeIndex = source('core/finance/index.js');\nif (!/recordPaymentIncome/.test(financeIndex) || !/calculateFinancialPlan/.test(financeIndex) || !/getRecordPaymentState/.test(financeIndex)) {\n  errors.push('core/finance/index.js must expose the complete public Finance contract');\n}\n\nconst walletData = source('settings/wallets/data.js');`
  );
  return next;
});

// Domain checker additionally rejects dangling imports to files removed by this migration.
edit('scripts/check-domain-architecture.mjs', (source) => source.includes('imports removed legacy domain owner') ? source : source.replace(
  "    const resolved = rel(resolve(dirname(file), specifier));\n",
  "    const resolved = rel(resolve(dirname(file), specifier));\n    if (legacyFiles.includes(resolved)) {\n      errors.push(`${path}: imports removed legacy domain owner ${resolved}`);\n      continue;\n    }\n"
));

for (const legacy of legacyTargets.keys()) {
  const file = join(root, legacy);
  if (existsSync(file)) unlinkSync(file);
}

console.log('domain handoff codemod: applied');

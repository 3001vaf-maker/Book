import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['core', 'journal', 'ui', 'timetable', 'online-booking', 'settings'];
const retired = 'recordSettlementDiscountPercent';
const errors = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) {
      walk(file);
      continue;
    }
    if (!/\.(?:js|mjs|ts)$/.test(name)) continue;
    const text = readFileSync(file, 'utf8');
    if (text.includes(retired)) errors.push(`${relative(process.cwd(), file)}: retired discount resolver must not return`);
  }
}

for (const root of roots) walk(root);

const financeIndex = readFileSync('core/finance/index.js', 'utf8');
if (!financeIndex.includes('recordSettlementPriceCondition') || !financeIndex.includes('recordSettlementPricePercent')) {
  errors.push('core/finance/index.js must expose the canonical price-condition resolver');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('price condition architecture check: OK');

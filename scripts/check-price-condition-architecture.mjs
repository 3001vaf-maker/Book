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

const financeRules = readFileSync('core/finance/rules.js', 'utf8');
if (financeRules.includes('item?.discountPercent') || financeRules.includes('item.discountPercent')) {
  errors.push('core/finance/rules.js must not calculate from legacy item.discountPercent');
}

const settlement = readFileSync('core/finance/settlement.js', 'utf8');
if (!settlement.includes("resolvePersonPriceCondition") || !settlement.includes('recordSettlementPriceCondition')) {
  errors.push('core/finance/settlement.js must resolve automatic percent through the shared price-condition resolver');
}

const recordUi = readFileSync('journal/record.js', 'utf8');
if (/discountPercent\s*:/.test(recordUi)) {
  errors.push('journal/record.js must not snapshot a person discount percent into a record');
}

const recordServer = readFileSync('server/src/record/record.service.ts', 'utf8');
if (/discountPercent\s*:/.test(recordServer)) {
  errors.push('server/src/record/record.service.ts must not snapshot a person discount percent into a record');
}

const depositUi = readFileSync('core/loyalty/deposit/index.js', 'utf8');
if (depositUi.includes("String(deposit?.benefitMode || 'none') !== 'none' || benefitBalance > 0.009")) {
  errors.push('deposit service-percent mode must not be displayed as a monetary benefit balance');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('price condition architecture check: OK');

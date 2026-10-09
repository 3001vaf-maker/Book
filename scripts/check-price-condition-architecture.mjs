import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['core', 'journal', 'ui', 'timetable', 'online-booking', 'settings', 'server/src'];
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
if (!financeRules.includes('correctionForItem') || !financeRules.includes('pricePercentMoney')) {
  errors.push('core/finance/rules.js must keep manual price correction and automatic price percent as separate stages');
}

const priceCondition = readFileSync('core/loyalty/price-condition.js', 'utf8');
if (!priceCondition.includes('resolvePersonPriceCondition') || !priceCondition.includes('resolvePriceConditionSources')) {
  errors.push('core/loyalty/price-condition.js must remain the single browser price-condition resolver');
}

const settlement = readFileSync('core/finance/settlement.js', 'utf8');
if (!settlement.includes('resolvePersonPriceCondition') || !settlement.includes('recordSettlementPriceCondition')) {
  errors.push('core/finance/settlement.js must resolve automatic percent through the shared price-condition resolver');
}
if (settlement.includes('owner?.discountPercent') || settlement.includes('person?.discountPercent')) {
  errors.push('core/finance/settlement.js must not read a personal percent directly');
}

const recordUi = readFileSync('journal/record.js', 'utf8');
if (/discountPercent\s*:/.test(recordUi)) {
  errors.push('journal/record.js must not snapshot a person discount percent into a record');
}

const recordServer = readFileSync('server/src/record/record.service.ts', 'utf8');
if (/discountPercent\s*:/.test(recordServer)) {
  errors.push('server/src/record/record.service.ts must not snapshot a person discount percent into a record');
}
if (!recordServer.includes('resolvePersonPricePercent') || !recordServer.includes('this.pricePercent')) {
  errors.push('server/src/record/record.service.ts must resolve automatic percent through the canonical server resolver');
}

const serverPriceCondition = readFileSync('server/src/loyalty/price-condition.ts', 'utf8');
if (!serverPriceCondition.includes('resolvePersonPricePercent') || !serverPriceCondition.includes('sources.length > 1')) {
  errors.push('server/src/loyalty/price-condition.ts must own server price-percent resolution and conflict detection');
}

const depositUi = readFileSync('core/loyalty/deposit/index.js', 'utf8');
if (depositUi.includes("String(deposit?.benefitMode || 'none') !== 'none' || benefitBalance > 0.009")) {
  errors.push('deposit service-percent mode must not be displayed as a monetary benefit balance');
}

const paymentUi = readFileSync('ui/payment/index.js', 'utf8');
if (!paymentUi.includes('Ручная коррекция цены, %') || !paymentUi.includes('Ручная коррекция цены, ₽')) {
  errors.push('payment UI must expose manual price correction explicitly');
}
if (!paymentUi.includes("label: 'Условие'") || !paymentUi.includes('disabled: true')) {
  errors.push('automatic price condition must be read-only in payment UI');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('price condition architecture check: OK');

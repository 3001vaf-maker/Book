import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateSettlement } from '../core/finance/index.js';
import { resolvePersonPriceCondition } from '../core/loyalty/price-condition.js';

// Manual price correction changes the operation price first.
// The one automatic PRICE_PERCENT privilege is applied only after that correction.
const corrected = calculateSettlement([
  {
    sourceType: 'procedure',
    sourceId: 'procedure-1',
    name: 'Стрижка',
    price: 5000,
    correctionMode: 'percent',
    correctionPercent: 10,
  },
], { pricePercent: 20 });
assert.equal(corrected.serviceTotal, 5000);
assert.equal(corrected.correctionTotal, 500);
assert.equal(corrected.pricePercentTotal, 900);
assert.equal(corrected.planTotal, 3600);

// One automatic percentage source is valid.
const personalOnly = resolvePersonPriceCondition({ discountPercent: 20 }, []);
assert.equal(personalOnly.conflict, false);
assert.equal(personalOnly.percent, 20);
assert.equal(personalOnly.source?.type, 'personal');

const programOnly = resolvePersonPriceCondition({ discountPercent: 0 }, [
  { type: 'deposit', id: 'deposit-1', name: 'Депозит', percent: 20 },
]);
assert.equal(programOnly.conflict, false);
assert.equal(programOnly.percent, 20);
assert.equal(programOnly.source?.type, 'deposit');

// Multiple automatic percentage sources must never be summed or silently selected.
const conflict = resolvePersonPriceCondition({ discountPercent: 20 }, [
  { type: 'deposit', id: 'deposit-1', name: 'Депозит', percent: 20 },
]);
assert.equal(conflict.conflict, true);
assert.equal(conflict.percent, 0);
assert.equal(conflict.source, null);
assert.equal(conflict.sources.length, 2);

const depositServiceSource = readFileSync(new URL('../server/src/loyalty/deposit.service.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../server/prisma/migrations/20261008214500_deposit_benefit_balances/migration.sql', import.meta.url), 'utf8');

// Refund is principal-only. The generic available balance must never become refundable cash.
assert.match(depositServiceSource, /refundableAmount:\s*row\.status === 'active' \? principalBalance : 0/);
assert.match(depositServiceSource, /amount:\s*current\.refundableAmount/);
assert.doesNotMatch(depositServiceSource, /refundableAmount:\s*row\.status === 'active' \? balance/);

// Hard delete is destructive: remove the deposit allocation from linked Finance operations,
// remove deposit-owned funding/withdrawal facts, then remove the instance itself.
assert.match(depositServiceSource, /depositAllocations:\s*nextAllocations/);
assert.match(depositServiceSource, /kind:\s*\{ in:\s*\['deposit-funding', 'deposit-withdrawal'\] \}/);
assert.match(depositServiceSource, /DELETE FROM "LoyaltyDepositInstance"/);
assert.match(depositServiceSource, /TransactionIsolationLevel\.Serializable/);

// Deposit money and promotional value are separate. Upfront benefit is created once on funding;
// service-price percent creates no money. Spending consumes principal first and benefit second.
assert.match(migrationSource, /benefitType=discount is a time-limited discount right and never creates money/);
assert.match(migrationSource, /benefitType=accrual adds promotional spendable value once, at funding time/);
assert.match(migrationSource, /IF loyalty_deposit_benefit_mode\(terms_value\) = 'accrual' THEN/);
assert.match(migrationSource, /principal_used := LEAST\(principal, allocation_amount\);/);
assert.match(migrationSource, /benefit_used := LEAST\(benefit, GREATEST\(0, allocation_amount - principal_used\)\);/);
assert.match(migrationSource, /loyalty_deposit_benefit_mode\(terms_value\) <> 'discount'/);

console.log('deposit business contract tests: OK');

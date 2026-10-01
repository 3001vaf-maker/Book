import assert from 'node:assert/strict';
import {
  buildLoanSchedule,
  calculateLoanState,
  loanTermEndDate,
} from '../core/finance/cash/loan-calculator.js';

const receive = (amount, occurredAt) => ({
  economicType: 'LOAN_RECEIVED',
  direction: 'IN',
  amount,
  occurredAt,
  operationStatus: 'completed',
});
const repay = (amount, occurredAt) => ({
  economicType: 'LOAN_REPAYMENT',
  direction: 'OUT',
  amount,
  occurredAt,
  operationStatus: 'completed',
});

const annual = {
  loanTerms: {
    termMode: 'none',
    interestRate: 20,
    ratePeriod: 'annual',
    repaymentMode: 'free',
  },
};
const annualState = calculateLoanState(
  annual,
  [receive(100000, '2024-01-01T12:00:00.000Z')],
  '2024-02-01',
);
const annualExpected = 100000 * 0.20 * 31 / 366;
assert.ok(Math.abs(annualState.accruedInterest - annualExpected) < 1e-9);
assert.ok(Math.abs(annualState.totalDue - (100000 + annualExpected)) < 1e-9);

const monthly = {
  loanTerms: {
    termMode: 'none',
    interestRate: 20,
    ratePeriod: 'monthly',
    repaymentMode: 'free',
  },
};
const monthlyState = calculateLoanState(
  monthly,
  [receive(100000, '2026-10-01T09:00:00.000Z')],
  '2026-11-01',
);
assert.ok(Math.abs(monthlyState.accruedInterest - 20000) < 1e-9);

const splitPeriod = calculateLoanState(
  monthly,
  [
    receive(100000, '2026-10-01T09:00:00.000Z'),
    repay(50000, '2026-10-16T09:00:00.000Z'),
  ],
  '2026-11-01',
);
const firstInterest = 100000 * 0.20 * 15 / 31;
const expectedPrincipal = 100000 - (50000 - firstInterest);
const secondInterest = expectedPrincipal * 0.20 * 16 / 31;
assert.ok(Math.abs(splitPeriod.principal - expectedPrincipal) < 1e-9);
assert.ok(Math.abs(splitPeriod.accruedInterest - secondInterest) < 1e-9);
assert.ok(Math.abs(splitPeriod.interestPaid - firstInterest) < 1e-9);

const fixedTerm = {
  loanTerms: {
    termMode: 'duration',
    durationValue: 12,
    durationUnit: 'months',
    interestRate: 0,
    ratePeriod: 'annual',
    repaymentMode: 'monthly',
    monthlyMode: 'equal-principal',
    firstPaymentDate: '2026-11-01',
  },
};
assert.equal(loanTermEndDate(fixedTerm, '2026-10-01'), '2027-10-01');
const schedule = buildLoanSchedule(
  fixedTerm,
  [receive(120000, '2026-10-01T09:00:00.000Z')],
  '2026-10-01',
);
assert.equal(schedule.length, 12);
for (const item of schedule) {
  assert.ok(Math.abs(item.principal - 10000) < 1e-7);
  assert.ok(Math.abs(item.interest) < 1e-9);
  assert.ok(Math.abs(item.total - 10000) < 1e-7);
}
assert.equal(schedule.at(-1).date, '2027-10-01');

console.log('loan calculator tests: OK');

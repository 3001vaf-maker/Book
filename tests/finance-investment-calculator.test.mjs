import assert from 'node:assert/strict';
import {
  calculateInvestmentState,
  investmentXirr,
  normalizeInvestmentTerms,
} from '../core/finance/index.js';

const movement = (economicType, amount, occurredAt, direction = 'IN') => ({
  economicType,
  amount,
  occurredAt,
  direction,
  operationStatus: 'completed',
});

const self = {
  name: 'Оборудование',
  investmentTerms: {
    role: 'self',
    investmentType: 'own-business',
    participationModel: 'self',
  },
  investmentEvents: [
    { id: 'saving-1', type: 'saving', amount: 40000, occurredDate: '2026-05-01' },
    { id: 'valuation-1', type: 'valuation', amount: 150000, occurredDate: '2026-10-01' },
  ],
};
const selfState = calculateInvestmentState(self, [
  movement('INVESTMENT_CONTRIBUTION', 300000, '2026-01-01T09:00:00.000Z', 'OUT'),
  movement('INVESTMENT_EXPENSE', 20000, '2026-02-01T09:00:00.000Z', 'OUT'),
  movement('INVESTMENT_INCOME', 180000, '2026-06-01T09:00:00.000Z', 'IN'),
], '2026-10-01');

assert.equal(selfState.contributed, 300000);
assert.equal(selfState.expenses, 20000);
assert.equal(selfState.income, 180000);
assert.equal(selfState.savings, 40000);
assert.equal(selfState.currentValue, 150000);
assert.equal(selfState.result, 50000);
assert.ok(Math.abs(selfState.roi - 15.625) < 1e-9);
assert.ok(Math.abs(selfState.paybackRatio - 68.75) < 1e-9);
assert.equal(selfState.paybackDate, '');

const raised = {
  name: 'Проект',
  investmentTerms: {
    role: 'raise',
    investmentType: 'business-project',
    participationModel: 'equity',
    sharePercent: 20,
    participantAccountId: 'account-1',
    participantStatus: 'accepted',
  },
  investmentEvents: [
    { id: 'valuation-1', type: 'valuation', amount: 5000000, occurredDate: '2026-09-01' },
  ],
};
const raisedState = calculateInvestmentState(raised, [
  movement('INVESTMENT_RECEIVED', 500000, '2026-01-01T09:00:00.000Z'),
  movement('INVESTMENT_RETURN', 100000, '2026-08-01T09:00:00.000Z', 'OUT'),
  movement('INVESTMENT_INCOME_PAYMENT', 40000, '2026-09-01T09:00:00.000Z', 'OUT'),
], '2026-10-01');

assert.equal(raisedState.received, 500000);
assert.equal(raisedState.capitalReturned, 100000);
assert.equal(raisedState.incomePaid, 40000);
assert.equal(raisedState.remainingObligation, 400000);
assert.equal(raisedState.currentValue, 5000000);
assert.equal(raisedState.shareValue, 1000000);
assert.equal(raisedState.roi, null);

const xirr = investmentXirr([
  { date: '2025-01-01', amount: -1000 },
  { date: '2026-01-01', amount: 1100 },
]);
assert.ok(xirr != null);
assert.ok(Math.abs(xirr - 0.1) < 1e-8);

const legacy = normalizeInvestmentTerms({ investmentTerms: {} });
assert.equal(legacy.role, 'raise');

console.log('investment calculator tests: OK');

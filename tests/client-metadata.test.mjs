import assert from 'node:assert/strict';
import { calculateFinancialPlan, hydrateFinanceFromServer, recordPaymentIncome } from '../core/finance/index.js';
import { hydrateRecordStateFromServer } from '../core/record/index.js';
import { getClientMetadata } from '../main/clients/metadata.js';

hydrateRecordStateFromServer({
  records: [
    { id: 'r1', date: '2026-09-01', client: { key: 'c1' }, procedures: [], products: [] },
    { id: 'r2', date: '2026-09-05', client: { key: 'c1' }, procedures: [], products: [] },
    { id: 'r3', date: '2026-09-09', client: { key: 'c1' }, procedures: [], products: [] },
  ],
  recordEvents: [
    { id: 'r1-created', recordId: 'r1', type: 'created', at: '2026-09-01T09:00:00.000Z', payload: {} },
    { id: 'r1-arrived', recordId: 'r1', type: 'arrived', at: '2026-09-01T10:00:00.000Z', payload: {} },
    { id: 'r2-created', recordId: 'r2', type: 'created', at: '2026-09-05T09:00:00.000Z', payload: {} },
    { id: 'r2-no-show', recordId: 'r2', type: 'no-show', at: '2026-09-05T10:00:00.000Z', payload: {} },
    { id: 'r3-created', recordId: 'r3', type: 'created', at: '2026-09-09T09:00:00.000Z', payload: {} },
    { id: 'r3-cancelled', recordId: 'r3', type: 'cancelled', at: '2026-09-09T10:00:00.000Z', payload: {} },
  ],
});

hydrateFinanceFromServer({ version: 5, income: [], expense: [] });
const plan = calculateFinancialPlan([{ sourceType: 'procedure', sourceId: 'p1', name: 'Услуга', price: 5000 }]);
const payment = recordPaymentIncome({
  source: { type: 'record', id: 'r1' },
  finance: plan,
  maxAmount: 5000,
  serviceAmount: 5000,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 5000 }],
});
assert.ok(payment);

const metadata = getClientMetadata('c1');

assert.equal(metadata.recordCount, 2);
assert.equal(metadata.paidTotal, 5000);
assert.equal(metadata.lastVisit, '2026-09-05');

console.log('client metadata tests: OK');

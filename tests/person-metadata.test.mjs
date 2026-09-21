import assert from 'node:assert/strict';
import { calculateSettlement, hydrateFinanceFromServer } from '../core/finance/index.js';
import { hydrateRecordStateFromServer } from '../core/record/index.js';
import { getPersonMetadata } from '../main/people/metadata.js';
import { canonicalFinanceState, paymentFixture, settlementRow } from './helpers/finance-canonical.mjs';

hydrateRecordStateFromServer({
  records: [
    { id: 'r1', date: '2026-09-01', person: { key: 'c1' }, procedures: [], products: [] },
    { id: 'r2', date: '2026-09-05', person: { key: 'c1' }, procedures: [], products: [] },
    { id: 'r3', date: '2026-09-09', person: { key: 'c1' }, procedures: [], products: [] },
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

const settlement = calculateSettlement([{ sourceType: 'procedure', sourceId: 'p1', name: 'Услуга', price: 5000 }]);
const payment = paymentFixture({
  id: 'payment-r1',
  recordId: 'r1',
  settlement,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 5000 }],
  serviceAmount: 5000,
});
hydrateFinanceFromServer(canonicalFinanceState({
  settlements: [settlementRow('r1', settlement)],
  payments: [payment],
}));

const metadata = getPersonMetadata('c1');

assert.equal(metadata.recordCount, 2);
assert.equal(metadata.paidTotal, 5000);
assert.equal(metadata.lastVisit, '2026-09-05');

console.log('person metadata tests: OK');

import assert from 'node:assert/strict';
import { calculateFinancialPlan, hydrateFinanceFromServer, recordPaymentIncome } from '../core/finance/index.js';
import { hydrateRecordStateFromServer } from '../core/record/index.js';
import { createUEI, detachUEI, hydrateUEIFromServer, linkUEI } from '../core/uei.js';
import {
  findIdentityOwnerByAccountId,
  getClients,
  getIdentityMemberKeys,
  getIdentityOwner,
  hydrateClientsFromServer,
} from '../main/clients/data.js';
import { getClientMetadata } from '../main/clients/metadata.js';

hydrateClientsFromServer([
  { key: 'p1', name: 'Александр', phones: ['+79030000001'], accounts: ['a1'], discountPercent: 15, programs: [{ name: 'VIP' }] },
  { key: 'p2', name: 'Александр', phones: ['+79030000002'], accounts: ['a2'] },
  { key: 'p3', name: 'Александр', phones: ['+79030000003'], accounts: ['a3'] },
  { key: 'p4', name: 'Анна', phones: ['+79030000004'], accounts: ['a4'] },
]);
hydrateUEIFromServer({ entities: {}, relations: {}, revoked: [] });
hydrateRecordStateFromServer({
  records: [
    { id: 'r1', date: '2026-09-01', client: { key: 'p1' }, procedures: [], products: [] },
    { id: 'r2', date: '2026-09-02', client: { key: 'p2' }, procedures: [], products: [] },
    { id: 'r3', date: '2026-09-03', client: { key: 'p3' }, procedures: [], products: [] },
    { id: 'r4', date: '2026-09-04', client: { key: 'p4' }, procedures: [], products: [] },
  ],
  recordEvents: [],
});
hydrateFinanceFromServer({ version: 5, income: [], expense: [] });

function pay(recordId, amount) {
  const finance = calculateFinancialPlan([{ sourceType: 'procedure', sourceId: `service-${recordId}`, name: 'Услуга', price: amount }]);
  return recordPaymentIncome({
    source: { type: 'record', id: recordId },
    finance,
    maxAmount: amount,
    serviceAmount: amount,
    allocations: [{ walletId: 'cash', walletName: 'Наличные', amount }],
  });
}

assert.ok(pay('r1', 1000));
assert.ok(pay('r2', 2000));
assert.ok(pay('r3', 3000));
assert.ok(pay('r4', 4000));

createUEI({ entityType: 'person', entityId: 'p1', value: 'A1', identifiers: ['+79030000001'] });
linkUEI({ entityType: 'person', entityId: 'p2', value: '00A1', identifiers: ['+79030000002'] });
linkUEI({ entityType: 'person', entityId: 'p3', value: '00A1', identifiers: ['+79030000003'] });

assert.deepEqual(getClients().map((person) => person.key), ['p1', 'p4']);
assert.deepEqual(getIdentityMemberKeys('p2'), ['p1', 'p2', 'p3']);
assert.equal(getIdentityOwner('p3')?.key, 'p1');
assert.equal(findIdentityOwnerByAccountId('a2')?.key, 'p1');

const merged = getClientMetadata('p2');
assert.equal(merged.recordCount, 3);
assert.equal(merged.paidTotal, 6000);
assert.equal(merged.lastVisit, '2026-09-03');

detachUEI({ entityType: 'person', entityId: 'p3', uei: '00A1', explicit: true });
assert.deepEqual(getClients().map((person) => person.key), ['p1', 'p3', 'p4']);
assert.deepEqual(getIdentityMemberKeys('p1'), ['p1', 'p2']);
assert.equal(findIdentityOwnerByAccountId('a3')?.key, 'p3');

const remaining = getClientMetadata('p1');
assert.equal(remaining.recordCount, 2);
assert.equal(remaining.paidTotal, 3000);
assert.equal(remaining.lastVisit, '2026-09-02');

const detached = getClientMetadata('p3');
assert.equal(detached.recordCount, 1);
assert.equal(detached.paidTotal, 3000);
assert.equal(detached.lastVisit, '2026-09-03');

console.log('UEI identity integration tests: OK');

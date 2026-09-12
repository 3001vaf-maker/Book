import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

localStorage.setItem('book.people', JSON.stringify([
  { key: 'p1', name: 'Александр', phones: ['+79030000001'], accounts: ['a1'], discountPercent: 15, programs: [{ name: 'VIP' }] },
  { key: 'p2', name: 'Александр', phones: ['+79030000002'], accounts: ['a2'] },
  { key: 'p3', name: 'Александр', phones: ['+79030000003'], accounts: ['a3'] },
  { key: 'p4', name: 'Анна', phones: ['+79030000004'], accounts: ['a4'] },
]));

localStorage.setItem('book.records', JSON.stringify([
  { id: 'r1', status: 'active', date: '2026-09-01', client: { key: 'p1' } },
  { id: 'r2', status: 'active', date: '2026-09-02', client: { key: 'p2' } },
  { id: 'r3', status: 'active', date: '2026-09-03', client: { key: 'p3' } },
  { id: 'r4', status: 'active', date: '2026-09-04', client: { key: 'p4' } },
]));

localStorage.setItem('book.payments', JSON.stringify([
  { id: 'pay1', status: 'completed', source: { type: 'record', id: 'r1' }, total: 1000 },
  { id: 'pay2', status: 'completed', source: { type: 'record', id: 'r2' }, total: 2000 },
  { id: 'pay3', status: 'completed', source: { type: 'record', id: 'r3' }, total: 3000 },
  { id: 'pay4', status: 'completed', source: { type: 'record', id: 'r4' }, total: 4000 },
]));

const { createUEI, linkUEI, detachUEI } = await import('../core/uei.js');
const {
  getClients,
  getIdentityMemberKeys,
  getIdentityOwner,
  findIdentityOwnerByAccountId,
} = await import('../main/clients/data.js');
const { getClientMetadata } = await import('../main/clients/metadata.js');

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

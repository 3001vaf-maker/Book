import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
};

localStorage.setItem('book.records', JSON.stringify([
  { id: 'r1', status: 'active', attendance: 'arrived', date: '2026-09-01', client: { key: 'c1' } },
  { id: 'r2', status: 'active', attendance: 'no-show', date: '2026-09-05', client: { key: 'c1' } },
  { id: 'r3', status: 'cancelled', attendance: '', date: '2026-09-09', client: { key: 'c1' } },
]));

localStorage.setItem('book.payments', JSON.stringify([
  { id: 'p1', status: 'completed', source: { type: 'record', id: 'r1' }, total: 5000 },
  { id: 'p2', status: 'completed', source: { type: 'record', id: 'r3' }, total: 9000 },
]));

const { getClientMetadata } = await import('../main/clients/metadata.js');
const metadata = getClientMetadata('c1');

assert.equal(metadata.recordCount, 2);
assert.equal(metadata.paidTotal, 5000);
assert.equal(metadata.lastVisit, '2026-09-05');

console.log('client metadata tests: OK');

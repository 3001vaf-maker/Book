import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};
globalThis.sessionStorage = {
  getItem: () => 'test-token',
  setItem: () => {},
  removeItem: () => {},
};

const legacyPeople = JSON.stringify([{ key: 'legacy-person', name: 'Legacy', phones: [] }]);
const legacyUEI = JSON.stringify({ entities: { L001: { uei: 'L001', owner: { type: 'person', id: 'legacy-person' }, members: ['person:legacy-person'], history: [], reserved: true } }, relations: { 'person:legacy-person': 'L001' }, revoked: [] });
const legacyRecords = JSON.stringify([{ id: 'legacy-record', date: '2026-01-01' }]);
const legacyEvents = JSON.stringify([]);
localStorage.setItem('book.people', legacyPeople);
localStorage.setItem('book.uei', legacyUEI);
localStorage.setItem('book.records', legacyRecords);
localStorage.setItem('book.recordEvents', legacyEvents);

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || 'GET', body: options.body || '' });
  return { ok: true, status: 200, json: async () => ({}) };
};

const clients = await import('../main/clients/data.js');
const uei = await import('../core/uei.js');
const record = await import('../core/record/index.js');
const persistence = await import('../core/business-persistence.js');

clients.hydrateClientsFromServer([{ key: 'server-person', name: 'Server', phones: ['+79030000000'], tags: ['future-tag'] }]);
uei.hydrateUEIFromServer({ entities: {}, relations: {}, revoked: [] });
record.hydrateRecordStateFromServer({
  records: [{ id: 'server-record', date: '2026-09-12', from: '10:00', to: '11:00' }],
  recordEvents: [{ id: 'server-created', recordId: 'server-record', type: 'created', at: '2026-09-12T09:00:00.000Z', payload: {} }],
});
persistence.setBusinessServerReady(true);

assert.deepEqual(clients.getAllClients().map((person) => person.key), ['server-person']);
assert.deepEqual(record.getRecords().map((item) => item.id), ['server-record']);
assert.deepEqual(uei.listUEIs(), []);
assert.deepEqual(clients.getAllClients()[0].tags, ['future-tag'], 'unknown tag ids must survive until Tags owner moves server-side');

const people = clients.getAllClients();
people[0].surname = 'Updated';
clients.saveClients(people);
uei.createUEI({ entityType: 'person', entityId: 'server-person', value: 'A1' });

await persistence.flushBusinessPersistence({ timeoutMs: 2000 });

assert.equal(localStorage.getItem('book.people'), legacyPeople);
assert.equal(localStorage.getItem('book.uei'), legacyUEI);
assert.equal(localStorage.getItem('book.records'), legacyRecords);
assert.equal(localStorage.getItem('book.recordEvents'), legacyEvents);
assert.ok(calls.some((call) => call.url.includes('/business-state/people/server-person') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.includes('/business-state/uei') && call.method === 'PUT'));

console.log('business server owner tests: OK');

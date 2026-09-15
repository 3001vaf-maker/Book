import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.sessionStorage = {
  getItem: () => '',
  setItem() {},
  removeItem() {},
};
globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
if (!globalThis.crypto?.randomUUID) globalThis.crypto = { randomUUID: () => `id-${Math.random()}` };

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || 'GET', body: options.body || '' });
  return { ok: true, status: 200, json: async () => ({}) };
};

const persistence = await import('../core/business-persistence.js');
const data = await import('../settings/documents/data.js');
const consents = await import('../settings/documents/consents.js');
const history = await import('../settings/documents/history.js');
const migration = await import('../document-migration.js');
void migration;

persistence.setBusinessServerReady(true);
data.hydrateDocumentsFromServer([{ id: 'pdn-consent', system: true, kind: 'consent', title: 'PDN', clientConsent: true, required: true, version: 1, text: 'x' }]);
consents.hydrateConsentsFromServer([
  {
    id: 'ce-account',
    subjectType: 'BOOKING_ACCOUNT',
    subjectKey: 'account-1',
    documentId: 'pdn-consent',
    documentVersion: 1,
    status: 'accepted',
    acceptedAt: '2026-09-15T10:00:00.000Z',
    eventAt: '2026-09-15T10:00:00.000Z',
  },
  {
    id: 'ce-contact',
    subjectType: 'CONTACT_POINT',
    subjectKey: 'PHONE:79990000000',
    contactType: 'PHONE',
    contactValue: '+7 (999) 000-00-00',
    documentId: 'messages-consent',
    documentVersion: 1,
    status: 'accepted',
    acceptedAt: '2026-09-15T10:00:00.000Z',
    eventAt: '2026-09-15T10:00:00.000Z',
  },
]);
history.hydrateDocumentHistoryFromServer([]);

assert.equal(consents.getLatestAccountConsent('account-1', 'pdn-consent')?.status, 'accepted');
assert.equal(consents.getLatestContactConsent('SMS', '89990000000', 'messages-consent')?.status, 'accepted');

data.saveDocument({ id: 'pdn-consent', system: true, kind: 'consent', title: 'PDN 2', clientConsent: true, required: true, version: 1, text: 'x' });
history.recordDocumentHistory({ documentId: 'pdn-consent', documentTitle: 'PDN 2', documentVersion: 1, action: 'renamed' });
await persistence.flushBusinessPersistence();

assert.ok(calls.some((call) => call.url.endsWith('/document-state/documents') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.endsWith('/document-state/history') && call.method === 'PUT'));
assert.equal(calls.some((call) => call.url.endsWith('/document-state/consents') && call.method === 'PUT'), false);
assert.equal(JSON.parse(storage.get('book.documents.templates.v1') || 'null'), null);
console.log('document server owner tests: OK');

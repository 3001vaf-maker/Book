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
consents.hydrateConsentsFromServer([]);
history.hydrateDocumentHistoryFromServer([]);

data.saveDocument({ id: 'pdn-consent', system: true, kind: 'consent', title: 'PDN 2', clientConsent: true, required: true, version: 1, text: 'x' });
consents.recordConsent({ clientId: 'p1', documentId: 'pdn-consent', documentVersion: 1 });
history.recordDocumentHistory({ documentId: 'pdn-consent', documentTitle: 'PDN 2', documentVersion: 1, action: 'renamed' });
await persistence.flushBusinessPersistence();

assert.ok(calls.some((call) => call.url.endsWith('/document-state/documents') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.endsWith('/document-state/consents') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.endsWith('/document-state/history') && call.method === 'PUT'));
assert.equal(JSON.parse(storage.get('book.documents.templates.v1') || 'null'), null);
console.log('document server owner tests: OK');

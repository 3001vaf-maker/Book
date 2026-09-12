import assert from 'node:assert/strict';

const storage = {};
Object.defineProperties(storage, {
  getItem: { enumerable: false, value(key) { return Object.hasOwn(storage, String(key)) ? storage[String(key)] : null; } },
  setItem: { enumerable: false, value(key, value) { storage[String(key)] = String(value); } },
  removeItem: { enumerable: false, value(key) { delete storage[String(key)]; } },
  clear: { enumerable: false, value() { Object.keys(storage).forEach((key) => delete storage[key]); } },
  key: { enumerable: false, value(index) { return Object.keys(storage)[index] ?? null; } },
  length: { enumerable: false, get() { return Object.keys(storage).length; } },
});
globalThis.localStorage = storage;

const { clearLegacyBusinessStorage } = await import('../core/legacy-browser-business.js');

const businessKeys = [
  'book.profile',
  'book.profile.customProfessions',
  'book.workplaces',
  'book.people',
  'book.uei',
  'book.records',
  'book.recordEvents',
  'book:timetable-state',
  'book.journalBreaks',
  'book.procedures',
  'book.procedures.history',
  'book.booking-settings.v1',
  'book.documents.templates.v1',
  'book.documents.consents.v1',
  'book.documents.consents.legacy-migrated.v1',
  'book.documents.history.v1',
  'book.dds',
  'book.payments',
  'book.wallets',
  'book.tags',
  'book.products',
  'book.products.history',
];
for (const key of businessKeys) localStorage.setItem(key, `legacy:${key}`);

const technical = new Map([
  ['book.booking-account.token.tenant-a', 'public-session-token'],
  ['book.booking-account.email.tenant-a', 'client@example.com'],
  ['book.people.sort', 'lastDesc'],
  ['book.onboarding.step.v3', '3'],
  ['book:workplace-context:journal', '{"workplaceId":"wp-1"}'],
]);
for (const [key, value] of technical) localStorage.setItem(key, value);

clearLegacyBusinessStorage();

for (const key of businessKeys) {
  assert.equal(localStorage.getItem(key), null, `legacy business key must be removed after server verification: ${key}`);
}
for (const [key, value] of technical) {
  assert.equal(localStorage.getItem(key), value, `technical/session/UI state must survive cleanup: ${key}`);
}

assert.ok(businessKeys.length >= 20, 'test must cover the complete migrated business dataset set');
console.log('browser storage autonomy tests: OK');

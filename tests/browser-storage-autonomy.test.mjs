import assert from 'node:assert/strict';

const values = new Map();
globalThis.localStorage = {
  getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
  setItem(key, value) { values.set(String(key), String(value)); },
  removeItem(key) { values.delete(String(key)); },
  clear() { values.clear(); },
  key(index) { return [...values.keys()][index] ?? null; },
  get length() { return values.size; },
};

const { LEGACY_BUSINESS_STORAGE_KEYS, clearLegacyBusinessStorage } = await import('../core/legacy-browser-business.js');

for (const key of LEGACY_BUSINESS_STORAGE_KEYS) localStorage.setItem(key, `legacy:${key}`);

const technical = new Map([
  ['book.booking-account.token.tenant-a', 'public-session-token'],
  ['book.booking-account.email.tenant-a', 'client@example.com'],
  ['book.people.sort', 'lastDesc'],
  ['book.onboarding.step.v3', '3'],
  ['book.workplace-context.journal', '{"workplaceKey":"wp-1"}'],
]);
for (const [key, value] of technical) localStorage.setItem(key, value);

clearLegacyBusinessStorage();

for (const key of LEGACY_BUSINESS_STORAGE_KEYS) {
  assert.equal(localStorage.getItem(key), null, `legacy business key must be removed after server verification: ${key}`);
}
for (const [key, value] of technical) {
  assert.equal(localStorage.getItem(key), value, `technical/session/UI state must survive cleanup: ${key}`);
}

assert.ok(LEGACY_BUSINESS_STORAGE_KEYS.length >= 20, 'cleanup must cover the complete migrated business dataset set');
console.log('browser storage autonomy tests: OK');

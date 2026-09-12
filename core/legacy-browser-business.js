// Compatibility cleanup for browser-owned business data from pre-server Book versions.
// These keys may be read during one-time migration, but after every server owner is
// verified they must not remain as a working database in the browser.
export const LEGACY_BUSINESS_STORAGE_KEYS = Object.freeze([
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
]);

export function clearLegacyBusinessStorage(storage = localStorage) {
  for (const key of LEGACY_BUSINESS_STORAGE_KEYS) storage.removeItem(key);
}

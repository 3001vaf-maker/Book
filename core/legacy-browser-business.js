// Lifecycle cleanup for browser-owned data from pre-server Book versions.
// It deliberately does not know entity storage keys: canonical data owners keep
// ownership of those keys. After every server owner is verified, any Book-local
// key that is not explicitly technical/session/UI state is obsolete and removed.

function isBookNamespace(key) {
  return key.startsWith('book.') || key.startsWith('book:');
}

function isTechnicalBrowserState(key) {
  return key === 'book.people.sort'
    || key.startsWith('book.booking-account.token.')
    || key.startsWith('book.booking-account.email.')
    || key.startsWith('book.onboarding.')
    || key === 'book:workplace-context'
    || key.startsWith('book:workplace-context:');
}

export function clearLegacyBusinessStorage(storage = localStorage) {
  Object.keys(storage)
    .filter((key) => isBookNamespace(key) && !isTechnicalBrowserState(key))
    .forEach((key) => storage.removeItem(key));
}

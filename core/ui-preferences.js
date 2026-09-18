const PREFIX = 'book.ui.';

export function getUiPreference(key) {
  return localStorage.getItem(`${PREFIX}${String(key || '').trim()}`);
}

export function setUiPreference(key, value = '1') {
  localStorage.setItem(`${PREFIX}${String(key || '').trim()}`, String(value));
}

export function hasUiPreference(key) {
  return getUiPreference(key) === '1';
}

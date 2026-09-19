const SORT_KEY = 'book.people.sort';
const DEFAULT_SORT = 'nameAsc';
const SORT_MODES = new Set(['nameAsc', 'nameDesc', 'lastAsc', 'lastDesc']);

export function getPersonSortMode() {
  const value = localStorage.getItem(SORT_KEY) || DEFAULT_SORT;
  return SORT_MODES.has(value) ? value : DEFAULT_SORT;
}

export function setPersonSortMode(value) {
  const mode = SORT_MODES.has(value) ? value : DEFAULT_SORT;
  localStorage.setItem(SORT_KEY, mode);
  return mode;
}

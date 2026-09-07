const KEY = 'book.procedures';
const HISTORY_KEY = 'book.procedures.history';

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getProcedures() {
  const values = read(KEY, []);
  return Array.isArray(values) ? values.filter((item) => !item.deletedAt) : [];
}

export function saveProcedure(item) {
  const values = getProcedures();
  const exists = values.some((value) => value.id === item.id);
  write(KEY, exists ? values.map((value) => value.id === item.id ? item : value) : [...values, item]);
  return item;
}

export function pushProcedureHistory(record, action) {
  const history = read(HISTORY_KEY, []);
  history.push({ ...record, historyAction: action, historyAt: new Date().toISOString() });
  write(HISTORY_KEY, history);
}

export function deleteProcedure(id) {
  const values = getProcedures();
  const found = values.find((item) => item.id === id);
  if (!found) return false;
  pushProcedureHistory(found, 'deleted');
  write(KEY, values.map((item) => item.id === id ? { ...item, deletedAt: new Date().toISOString() } : item));
  return true;
}

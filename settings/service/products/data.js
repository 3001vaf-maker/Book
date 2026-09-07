const KEY = 'book.products';
const HISTORY_KEY = 'book.products.history';

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getProducts() {
  const values = read(KEY, []);
  return Array.isArray(values) ? values.filter((item) => !item.deletedAt) : [];
}

export function saveProduct(item) {
  const values = getProducts();
  const exists = values.some((value) => value.id === item.id);
  write(KEY, exists ? values.map((value) => value.id === item.id ? item : value) : [...values, item]);
  return item;
}

export function pushProductHistory(record, action) {
  const history = read(HISTORY_KEY, []);
  history.push({ ...record, historyAction: action, historyAt: new Date().toISOString() });
  write(HISTORY_KEY, history);
}

export function deleteProduct(id) {
  const values = getProducts();
  const found = values.find((item) => item.id === id);
  if (!found) return false;
  pushProductHistory(found, 'deleted');
  write(KEY, values.map((item) => item.id === id ? { ...item, deletedAt: new Date().toISOString() } : item));
  return true;
}

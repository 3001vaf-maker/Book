import { queueAuxiliaryDataset } from '../../../core/business-persistence.js';

const KEY = 'book.products';
const HISTORY_KEY = 'book.products.history';
let productsState = null;
let historyState = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readLegacy(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function readRawProducts() {
  const value = productsState === null ? readLegacy(KEY, []) : productsState;
  return Array.isArray(value) ? clone(value) : [];
}

function readHistory() {
  const value = historyState === null ? readLegacy(HISTORY_KEY, []) : historyState;
  return Array.isArray(value) ? clone(value) : [];
}

function writeProducts(value) {
  const normalized = Array.isArray(value) ? clone(value) : [];
  if (productsState === null) localStorage.setItem(KEY, JSON.stringify(normalized));
  else {
    productsState = normalized;
    void queueAuxiliaryDataset('products', productsState);
  }
}

function writeHistory(value) {
  const normalized = Array.isArray(value) ? clone(value) : [];
  if (historyState === null) localStorage.setItem(HISTORY_KEY, JSON.stringify(normalized));
  else {
    historyState = normalized;
    void queueAuxiliaryDataset('productHistory', historyState);
  }
}

export function readLegacyProductSnapshot() {
  return {
    present: localStorage.getItem(KEY) != null || localStorage.getItem(HISTORY_KEY) != null,
    products: Array.isArray(readLegacy(KEY, [])) ? clone(readLegacy(KEY, [])) : [],
    productHistory: Array.isArray(readLegacy(HISTORY_KEY, [])) ? clone(readLegacy(HISTORY_KEY, [])) : [],
  };
}

export function hydrateProductsFromServer({ products = [], productHistory = [] } = {}) {
  productsState = Array.isArray(products) ? clone(products) : [];
  historyState = Array.isArray(productHistory) ? clone(productHistory) : [];
  return { products: clone(productsState), productHistory: clone(historyState) };
}

export function getProducts() {
  return readRawProducts().filter((item) => !item.deletedAt);
}

export function saveProduct(item) {
  const values = readRawProducts();
  const exists = values.some((value) => value.id === item.id);
  writeProducts(exists ? values.map((value) => value.id === item.id ? item : value) : [...values, item]);
  return item;
}

export function pushProductHistory(record, action) {
  const history = readHistory();
  history.push({ ...record, historyAction: action, historyAt: new Date().toISOString() });
  writeHistory(history);
}

export function deleteProduct(id) {
  const values = readRawProducts();
  const found = values.find((item) => item.id === id && !item.deletedAt);
  if (!found) return false;
  pushProductHistory(found, 'deleted');
  writeProducts(values.map((item) => item.id === id ? { ...item, deletedAt: new Date().toISOString() } : item));
  return true;
}

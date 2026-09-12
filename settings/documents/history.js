const STORAGE_KEY = 'book.documents.history.v1';
let historyState = null;
let persistHistory = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalize(item = {}) {
  return {
    id: String(item.id || crypto.randomUUID()),
    documentId: String(item.documentId || ''),
    documentTitle: String(item.documentTitle || 'Документ'),
    documentVersion: Math.max(1, Number(item.documentVersion || 1)),
    action: String(item.action || 'updated'),
    createdAt: String(item.createdAt || new Date().toISOString()),
    source: String(item.source || 'manual'),
  };
}

function readLegacy() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.map(normalize).filter((item) => item.documentId) : [];
  } catch {
    return [];
  }
}

function read() {
  return historyState !== null ? clone(historyState) : readLegacy();
}

function writeItems(items = []) {
  const normalized = (Array.isArray(items) ? items : []).map(normalize).filter((item) => item.documentId);
  if (historyState !== null) {
    historyState = clone(normalized);
    if (typeof persistHistory === 'function') void persistHistory(clone(historyState));
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return clone(normalized);
}

export function configureDocumentHistoryPersistence(handler = null) {
  persistHistory = typeof handler === 'function' ? handler : null;
}

export function readLegacyDocumentHistorySnapshot() {
  return readLegacy().map((item) => clone(item));
}

export function hydrateDocumentHistoryFromServer(items = []) {
  historyState = (Array.isArray(items) ? items : []).map(normalize).filter((item) => item.documentId);
  return getDocumentHistory();
}

export function getDocumentHistory() {
  return read().sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
}

export function recordDocumentHistory({ documentId, documentTitle, documentVersion = 1, action = 'updated', source = 'manual' } = {}) {
  if (!documentId) return null;
  const item = normalize({ documentId, documentTitle, documentVersion, action, source, createdAt: new Date().toISOString() });
  const items = read();
  items.push(item);
  writeItems(items);
  return item;
}

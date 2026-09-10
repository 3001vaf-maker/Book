const STORAGE_KEY = 'book.documents.history.v1';

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

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.map(normalize).filter((item) => item.documentId) : [];
  } catch {
    return [];
  }
}

function write(items = []) {
  const normalized = (Array.isArray(items) ? items : []).map(normalize).filter((item) => item.documentId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getDocumentHistory() {
  return read().sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
}

export function recordDocumentHistory({ documentId, documentTitle, documentVersion = 1, action = 'updated', source = 'manual' } = {}) {
  if (!documentId) return null;
  const item = normalize({ documentId, documentTitle, documentVersion, action, source, createdAt: new Date().toISOString() });
  const items = read();
  items.push(item);
  write(items);
  return item;
}

// Company-side history belongs to Admin/Document Registry only.
// It never contains the operational history of a user's Book with that user's people.

let documentRegistryHistory = [];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(item = {}) {
  return {
    id: String(item.id || ''),
    tenantId: String(item.tenantId || ''),
    tenantName: String(item.tenantName || ''),
    platformAccountId: String(item.platformAccountId || ''),
    accountEmail: String(item.accountEmail || ''),
    documentKey: String(item.documentKey || ''),
    documentTitle: String(item.documentTitle || ''),
    documentVersion: Math.max(1, Number(item.documentVersion || 1)),
    documentContent: String(item.documentContent || ''),
    action: String(item.action || ''),
    source: String(item.source || ''),
    occurredAt: String(item.occurredAt || ''),
  };
}

export function hydrateDocumentRegistryHistory(items = []) {
  documentRegistryHistory = (Array.isArray(items) ? items : []).map(normalize);
  return getDocumentRegistryHistory();
}

export function getDocumentRegistryHistory() {
  return clone(documentRegistryHistory);
}

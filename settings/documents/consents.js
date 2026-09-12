const STORAGE_KEY = 'book.documents.consents.v1';
const MIGRATION_KEY = 'book.documents.consents.legacy-migrated.v1';
let consentState = null;
let persistConsents = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalize(item = {}) {
  return {
    id: String(item.id || crypto.randomUUID()),
    clientId: String(item.clientId || ''),
    documentId: String(item.documentId || ''),
    documentVersion: Number(item.documentVersion || 1),
    status: item.status === 'revoked' ? 'revoked' : item.status === 'declined' ? 'declined' : 'accepted',
    acceptedAt: String(item.acceptedAt || ''),
    revokedAt: String(item.revokedAt || ''),
    source: String(item.source || 'manual'),
    createdAt: String(item.createdAt || new Date().toISOString()),
  };
}

function readLegacy() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.map(normalize).filter((item) => item.clientId && item.documentId) : [];
  } catch {
    return [];
  }
}

function read() {
  return consentState !== null ? clone(consentState) : readLegacy();
}

function writeItems(items) {
  const normalized = (Array.isArray(items) ? items : []).map(normalize).filter((item) => item.clientId && item.documentId);
  if (consentState !== null) {
    consentState = clone(normalized);
    if (typeof persistConsents === 'function') void persistConsents(clone(consentState));
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return clone(normalized);
}

export function configureConsentPersistence(handler = null) {
  persistConsents = typeof handler === 'function' ? handler : null;
}

export function readLegacyConsentSnapshot() {
  return readLegacy().map((item) => clone(item));
}

export function hydrateConsentsFromServer(items = []) {
  consentState = (Array.isArray(items) ? items : []).map(normalize).filter((item) => item.clientId && item.documentId);
  return getConsents();
}

export function migrateLegacyConsents(clients = []) {
  if (consentState === null && localStorage.getItem(MIGRATION_KEY) === '1') return;
  const existing = read();
  const keys = new Set(existing.map((item) => `${item.clientId}:${item.documentId}`));
  const next = [...existing];

  for (const client of Array.isArray(clients) ? clients : []) {
    if (client.agreements?.personalData && !keys.has(`${client.key}:pdn-consent`)) {
      next.push(normalize({ clientId: client.key, documentId: 'pdn-consent', status: 'accepted', source: 'legacy', acceptedAt: '' }));
      keys.add(`${client.key}:pdn-consent`);
    }
    if (client.agreements?.mailings && !keys.has(`${client.key}:messages-consent`)) {
      next.push(normalize({ clientId: client.key, documentId: 'messages-consent', status: 'accepted', source: 'legacy', acceptedAt: '' }));
      keys.add(`${client.key}:messages-consent`);
    }
  }

  if (next.length !== existing.length) writeItems(next);
  if (consentState === null) localStorage.setItem(MIGRATION_KEY, '1');
}

export function getConsents() {
  return read();
}

export function getClientConsents(clientId) {
  const id = String(clientId || '');
  return getConsents().filter((item) => item.clientId === id);
}

export function getLatestClientConsent(clientId, documentId) {
  const matches = getClientConsents(clientId)
    .filter((item) => item.documentId === String(documentId || ''))
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  return matches[0] || null;
}

export function recordConsent({ clientId, documentId, documentVersion = 1, status = 'accepted', source = 'manual', acceptedAt = new Date().toISOString(), revokedAt = '' } = {}) {
  const item = normalize({ clientId, documentId, documentVersion, status, source, acceptedAt, revokedAt, createdAt: new Date().toISOString() });
  const items = getConsents();
  items.push(item);
  writeItems(items);
  return item;
}

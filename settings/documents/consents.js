import { getAllClients } from '../../main/clients/data.js';

const STORAGE_KEY = 'book.documents.consents.v1';
const MIGRATION_KEY = 'book.documents.consents.legacy-migrated.v1';

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

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.map(normalize).filter((item) => item.clientId && item.documentId) : [];
  } catch {
    return [];
  }
}

function write(items) {
  const normalized = (Array.isArray(items) ? items : []).map(normalize).filter((item) => item.clientId && item.documentId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function migrateLegacyOnce() {
  if (localStorage.getItem(MIGRATION_KEY) === '1') return;
  const existing = read();
  const keys = new Set(existing.map((item) => `${item.clientId}:${item.documentId}`));
  const next = [...existing];

  for (const client of getAllClients()) {
    if (client.agreements?.personalData && !keys.has(`${client.key}:pdn-consent`)) {
      next.push(normalize({ clientId: client.key, documentId: 'pdn-consent', status: 'accepted', source: 'legacy', acceptedAt: '' }));
    }
    if (client.agreements?.mailings && !keys.has(`${client.key}:messages-consent`)) {
      next.push(normalize({ clientId: client.key, documentId: 'messages-consent', status: 'accepted', source: 'legacy', acceptedAt: '' }));
    }
  }

  write(next);
  localStorage.setItem(MIGRATION_KEY, '1');
}

export function getConsents() {
  migrateLegacyOnce();
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
  write(items);
  return item;
}

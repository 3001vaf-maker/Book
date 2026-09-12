import { apiRequest } from './core/auth.js';
import { queueDocumentDataset, setBusinessServerReady } from './core/business-persistence.js';
import { readLegacyRecordSnapshot } from './core/record/index.js';
import { readLegacyClientsSnapshot } from './main/clients/data.js';
import {
  configureConsentPersistence,
  getConsents,
  hydrateConsentsFromServer,
  migrateLegacyConsents,
  readLegacyConsentSnapshot,
} from './settings/documents/consents.js';
import {
  configureDocumentPersistence,
  getDefaultDocuments,
  hydrateDocumentsFromServer,
  readLegacyDocumentsSnapshot,
} from './settings/documents/data.js';
import {
  configureDocumentHistoryPersistence,
  hydrateDocumentHistoryFromServer,
  readLegacyDocumentHistorySnapshot,
} from './settings/documents/history.js';

configureDocumentPersistence((value) => queueDocumentDataset('documents', value));
configureConsentPersistence((value) => queueDocumentDataset('consents', value));
configureDocumentHistoryPersistence((value) => queueDocumentDataset('history', value));

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeBundle(value = {}) {
  return {
    documents: Array.isArray(value.documents) ? clone(value.documents) : [],
    consents: Array.isArray(value.consents) ? clone(value.consents) : [],
    history: Array.isArray(value.history) ? clone(value.history) : [],
  };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonical(value) {
  return JSON.stringify(stable(normalizeBundle(value)));
}

function sameBundle(left, right) {
  return canonical(left) === canonical(right);
}

function populatedLegacyBrowser() {
  const clients = readLegacyClientsSnapshot();
  const record = readLegacyRecordSnapshot();
  return Boolean(clients.length || record.records.length || record.recordEvents.length);
}

function localBundle() {
  const clients = readLegacyClientsSnapshot();
  migrateLegacyConsents(clients);
  return normalizeBundle({
    documents: readLegacyDocumentsSnapshot() || getDefaultDocuments(),
    consents: readLegacyConsentSnapshot(),
    history: readLegacyDocumentHistorySnapshot(),
  });
}

async function responseJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

function hydrate(bundle) {
  const normalized = normalizeBundle(bundle?.data || bundle);
  hydrateDocumentsFromServer(normalized.documents);
  hydrateConsentsFromServer(normalized.consents);
  hydrateDocumentHistoryFromServer(normalized.history);
}

async function verifyLocal(local, remote) {
  const remoteBundle = normalizeBundle(remote?.data || remote);
  if (!sameBundle(local, remoteBundle)) throw new Error('Документы на сервере не совпадают с production-данными браузера');
  const response = await apiRequest('/document-state/migrate/verify', {
    method: 'POST',
    body: JSON.stringify(local),
  });
  const verified = await responseJson(response, 'Не удалось подтвердить перенос документов');
  if (!verified?.verified || !sameBundle(local, verified?.data || verified)) {
    throw new Error('Сервер не подтвердил точность переноса документов');
  }
  return verified;
}

export async function initializeDocumentState(account = {}) {
  const local = localBundle();
  const remoteResponse = await apiRequest('/document-state');
  const remote = await responseJson(remoteResponse, 'Не удалось загрузить документы');

  if (remote?.verified) {
    hydrate(remote);
    return { source: 'server', verified: true };
  }

  if (remote?.migrated) {
    if (!populatedLegacyBrowser()) return { source: 'server-awaiting-verification', verified: false };
    const verified = await verifyLocal(local, remote);
    hydrate(verified);
    return { source: 'legacy-verified', verified: true };
  }

  if (populatedLegacyBrowser()) {
    const migrateResponse = await apiRequest('/document-state/migrate', {
      method: 'POST',
      body: JSON.stringify(local),
    });
    const migrated = await responseJson(migrateResponse, 'Не удалось перенести документы');
    if (!sameBundle(local, migrated?.data || migrated)) throw new Error('Перенос документов остановлен: серверная копия не прошла сверку');
    const verified = await verifyLocal(local, migrated);
    hydrate(verified);
    return { source: 'legacy-migrated', verified: true };
  }

  if (account?.user?.workspaceUnlocked) return { source: 'awaiting-populated-browser', verified: false };

  const defaults = normalizeBundle({ documents: getDefaultDocuments(), consents: getConsents(), history: [] });
  const bootstrapResponse = await apiRequest('/document-state/bootstrap', {
    method: 'POST',
    body: JSON.stringify(defaults),
  });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище документов');
  if (!bootstrapped?.verified) throw new Error('Серверное хранилище документов не подтверждено');
  hydrate(bootstrapped);
  return { source: 'server-bootstrap', verified: true };
}

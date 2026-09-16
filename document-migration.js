import { apiRequest } from './core/auth.js';
import { queueDocumentDataset } from './core/business-persistence.js';
import { hydrateConsentsFromServer } from './settings/documents/consents.js';
import {
  configureDocumentPersistence,
  getDefaultDocuments,
  hydrateDocumentsFromServer,
} from './settings/documents/data.js';
import {
  configureDocumentHistoryPersistence,
  hydrateDocumentHistoryFromServer,
} from './settings/documents/history.js';

configureDocumentPersistence((value) => queueDocumentDataset('documents', value));
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

export async function initializeDocumentState() {
  const remoteResponse = await apiRequest('/document-state');
  const remote = await responseJson(remoteResponse, 'Не удалось загрузить документы');

  if (remote?.verified) {
    hydrate(remote);
    return { source: 'server', verified: true };
  }

  if (!remote?.migrated) {
    const defaults = normalizeBundle({ documents: getDefaultDocuments(), consents: [], history: [] });
    const bootstrapResponse = await apiRequest('/document-state/bootstrap', {
      method: 'POST',
      body: JSON.stringify(defaults),
    });
    const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать пустое серверное хранилище документов');
    if (!bootstrapped?.verified) throw new Error('Пустое серверное хранилище документов не подтверждено');
    hydrate(bootstrapped);
    return { source: 'server-bootstrap', verified: true };
  }

  return { source: 'server-unverified', verified: false };
}

import { apiRequest } from './core/auth.js';
import { queueDocumentDataset } from './core/business-persistence.js';
import { getBookDocumentBases } from './admin/document-registry/catalog.js';
import { hydrateConsentsFromServer } from './settings/documents/consents.js';
import { getProfile } from './settings/profile/data.js';
import { getWorkplaces } from './settings/profile/workplaces/data.js';
import {
  buildBookDocuments,
  configureBookDocumentBases,
  configureDocumentPersistence,
  hydrateDocumentsFromServer,
  reconcileBookDocuments,
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

async function persistReconciled(value) {
  const documentsResponse = await apiRequest('/document-state/documents', {
    method: 'PUT',
    body: JSON.stringify({ value: value.documents }),
  });
  await responseJson(documentsResponse, 'Не удалось обновить документы');

  const historyResponse = await apiRequest('/document-state/history', {
    method: 'PUT',
    body: JSON.stringify({ value: value.history }),
  });
  await responseJson(historyResponse, 'Не удалось обновить историю документов');
}

export async function initializeDocumentState() {
  configureBookDocumentBases(getBookDocumentBases(), {
    profile: getProfile(),
    workplaces: getWorkplaces(),
  });

  const remoteResponse = await apiRequest('/document-state');
  const remote = await responseJson(remoteResponse, 'Не удалось загрузить документы');

  if (remote?.verified) {
    const current = normalizeBundle(remote?.data || remote);
    const reconciled = reconcileBookDocuments(current.documents, current.history);
    if (reconciled.changed) {
      const next = {
        documents: reconciled.documents,
        consents: current.consents,
        history: reconciled.history,
      };
      await persistReconciled(next);
      hydrate({ data: next });
      return { source: 'server-admin-template-reconciled', verified: true };
    }
    hydrate(remote);
    return { source: 'server', verified: true };
  }

  const defaults = normalizeBundle({
    documents: buildBookDocuments(),
    consents: [],
    history: [],
  });
  const bootstrapResponse = await apiRequest('/document-state/bootstrap', {
    method: 'POST',
    body: JSON.stringify(defaults),
  });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище документов');
  if (!bootstrapped?.verified) throw new Error('Серверное хранилище документов не подтверждено');
  hydrate(bootstrapped);
  return { source: 'server-bootstrap-admin-template', verified: true };
}

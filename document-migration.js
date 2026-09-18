import { apiRequest } from './core/auth.js';
import { queueDocumentDataset } from './core/business-persistence.js';
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

export async function initializeDocumentState() {
  const [remoteResponse, basesResponse] = await Promise.all([
    apiRequest('/document-state'),
    apiRequest('/document-state/bases'),
  ]);
  const remote = await responseJson(remoteResponse, 'Не удалось загрузить документы');
  const bases = await responseJson(basesResponse, 'Не удалось загрузить основы документов');

  configureBookDocumentBases(bases, {
    profile: getProfile(),
    workplaces: getWorkplaces(),
  });

  if (remote?.verified) {
    const current = normalizeBundle(remote?.data || remote);
    const reconciled = reconcileBookDocuments(current.documents, current.history);
    if (reconciled.changed) {
      const [documentsResponse, historyResponse] = await Promise.all([
        apiRequest('/document-state/documents', {
          method: 'PUT',
          body: JSON.stringify({ value: reconciled.documents }),
        }),
        apiRequest('/document-state/history', {
          method: 'PUT',
          body: JSON.stringify({ value: reconciled.history }),
        }),
      ]);
      await responseJson(documentsResponse, 'Не удалось обновить документы');
      await responseJson(historyResponse, 'Не удалось обновить историю документов');
      hydrate({
        data: {
          documents: reconciled.documents,
          consents: current.consents,
          history: reconciled.history,
        },
      });
      return { source: 'server-reconciled', verified: true };
    }
    hydrate(remote);
    return { source: 'server', verified: true };
  }

  if (!remote?.migrated) {
    const defaults = normalizeBundle({ documents: buildBookDocuments(), consents: [], history: [] });
    const bootstrapResponse = await apiRequest('/document-state/bootstrap', {
      method: 'POST',
      body: JSON.stringify(defaults),
    });
    const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище документов');
    if (!bootstrapped?.verified) throw new Error('Серверное хранилище документов не подтверждено');
    hydrate(bootstrapped);
    return { source: 'server-bootstrap', verified: true };
  }

  return { source: 'server-unverified', verified: false };
}

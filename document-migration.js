import { apiRequest } from './core/auth.js';
import { queueDocumentDataset } from './core/business-persistence.js';
import { getProfile } from './settings/profile/data.js';
import {
  configureConsentPersistence,
  hydrateConsentsFromServer,
} from './settings/documents/consents.js';
import {
  configureDocumentPersistence,
  hydrateDocumentsFromServer,
} from './settings/documents/data.js';
import {
  configureDocumentHistoryPersistence,
  hydrateDocumentHistoryFromServer,
} from './settings/documents/history.js';

configureDocumentPersistence((value) => queueDocumentDataset('documents', value));
configureConsentPersistence(null);
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

function operatorIdentity(account = {}) {
  const profile = getProfile();
  const fullName = [profile?.name, profile?.surname].filter(Boolean).join(' ').trim()
    || String(account?.user?.email || '').trim()
    || 'Пользователь Book';
  const contact = String(profile?.emails?.[0] || account?.user?.email || profile?.phones?.[0] || profile?.phone || '').trim()
    || 'Контакт не указан';
  return { fullName, contact };
}

function renderTemplate(text, identity) {
  return String(text || '')
    .replaceAll('[ФИО пользователя]', identity.fullName)
    .replaceAll('[Контакт пользователя]', identity.contact);
}

function syncAdminTemplates(bundle, templates, account = {}) {
  const source = normalizeBundle(bundle?.data || bundle);
  const identity = operatorIdentity(account);
  const documents = [...source.documents];
  const history = [...source.history];
  let changed = false;

  for (const template of templates) {
    const id = String(template?.documentId || '');
    if (!id) continue;
    const index = documents.findIndex((item) => String(item?.id || '') === id);
    const previous = index >= 0 ? documents[index] : null;

    // A legacy system document with version > 1 may already contain the user's own edits.
    // Do not overwrite it automatically if it predates template-origin metadata.
    if (previous && !previous.templateKey && Number(previous.version || 1) > 1) {
      if (!previous.customized) {
        documents[index] = { ...previous, customized: true };
        changed = true;
      }
      continue;
    }

    if (previous?.customized) continue;

    const text = renderTemplate(template?.text, identity);
    const previousVersion = Math.max(1, Number(previous?.version || 1));
    const contentChanged = Boolean(previous)
      && (String(previous?.text || '') !== text || String(previous?.title || '') !== String(template?.title || ''));
    const nextVersion = previous
      ? (contentChanged ? previousVersion + 1 : previousVersion)
      : Math.max(1, Number(template?.templateVersion || 1));

    const next = {
      id,
      system: true,
      kind: template?.kind === 'consent' ? 'consent' : 'agreement',
      title: String(template?.title || 'Документ'),
      clientConsent: Boolean(template?.clientConsent),
      required: Boolean(template?.required),
      version: nextVersion,
      text,
      templateKey: String(template?.templateKey || ''),
      templateVersion: Math.max(1, Number(template?.templateVersion || 1)),
      templatePublishedAt: String(template?.templatePublishedAt || ''),
      customized: false,
    };

    const same = previous && JSON.stringify(previous) === JSON.stringify(next);
    if (same) continue;

    if (index >= 0) documents[index] = next;
    else documents.push(next);

    history.push({
      id: crypto.randomUUID(),
      documentId: next.id,
      documentTitle: next.title,
      documentVersion: next.version,
      action: previous ? 'template-synced' : 'template-created',
      createdAt: new Date().toISOString(),
      source: 'admin-template',
    });
    changed = true;
  }

  return {
    changed,
    data: {
      documents,
      consents: source.consents,
      history,
    },
  };
}

async function loadAdminTemplates() {
  const response = await apiRequest('/document-state/templates');
  const templates = await responseJson(response, 'Не удалось загрузить шаблоны Admin/Documents');
  if (!Array.isArray(templates) || templates.length !== 3) {
    throw new Error('Admin/Documents должен предоставить ровно 3 основы документов пользователя');
  }
  return templates;
}

async function persistTemplateSync(value) {
  const normalized = normalizeBundle(value);
  const documentsResponse = await apiRequest('/document-state/documents', {
    method: 'PUT',
    body: JSON.stringify({ value: normalized.documents }),
  });
  await responseJson(documentsResponse, 'Не удалось сохранить документы из Admin-шаблонов');

  const historyResponse = await apiRequest('/document-state/history', {
    method: 'PUT',
    body: JSON.stringify({ value: normalized.history }),
  });
  await responseJson(historyResponse, 'Не удалось сохранить историю документов');

  return normalized;
}

export async function initializeDocumentState(account = {}) {
  const templates = await loadAdminTemplates();
  const remoteResponse = await apiRequest('/document-state');
  const remote = await responseJson(remoteResponse, 'Не удалось загрузить документы');

  if (remote?.verified) {
    const synced = syncAdminTemplates(remote, templates, account);
    const data = synced.changed ? await persistTemplateSync(synced.data) : normalizeBundle(remote.data);
    hydrate({ data });
    return { source: synced.changed ? 'server-admin-template-sync' : 'server', verified: true };
  }

  if (remote?.migrated || account?.user?.workspaceUnlocked) {
    return { source: 'server-awaiting-verification', verified: false };
  }

  const generated = syncAdminTemplates({ documents: [], consents: [], history: [] }, templates, account).data;
  const bootstrapResponse = await apiRequest('/document-state/bootstrap', {
    method: 'POST',
    body: JSON.stringify(generated),
  });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище документов');
  if (!bootstrapped?.verified) throw new Error('Серверное хранилище документов не подтверждено');
  hydrate(bootstrapped);
  return { source: 'server-bootstrap-admin-templates', verified: true };
}

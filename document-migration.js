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
configureConsentPersistence((value) => queueDocumentDataset('consents', value));
configureDocumentHistoryPersistence((value) => queueDocumentDataset('history', value));

const LEGACY_TEMPLATE_TEXTS = new Map([
  ['pdn-agreement', 'Шаблон для адаптации под вашу работу. Укажите сведения об операторе, цели и правила обработки персональных данных, категории данных, сроки хранения, порядок отзыва и контакты для обращений. Перед использованием рекомендуется проверить документ с юристом.'],
  ['pdn-consent', 'Я даю согласие на обработку персональных данных, необходимых для записи и оказания услуг, связи со мной и ведения истории записей. Состав данных, цели, действия с данными, срок действия согласия и способ его отзыва должны быть уточнены оператором перед использованием этого шаблона.'],
  ['messages-consent', 'Я согласен(на) получать информационные сообщения, связанные с записью, изменением или отменой визита, а также иные сообщения, на которые я отдельно согласился(ась). Это согласие является необязательным и может быть отозвано.'],
]);

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

function legacyMock(document) {
  const expected = LEGACY_TEMPLATE_TEXTS.get(String(document?.id || ''));
  return Boolean(expected && String(document?.text || '').trim() === expected.trim());
}

function sameDocument(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function syncAdminTemplates(bundle, templates, account = {}) {
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
    const renderedText = renderTemplate(template?.text, identity);
    const renderedTitle = String(template?.title || 'Документ');
    const templateVersion = Math.max(1, Number(template?.templateVersion || 1));

    if (!previous) {
      const created = {
        id,
        system: true,
        kind: template?.kind === 'consent' ? 'consent' : 'agreement',
        title: renderedTitle,
        clientConsent: Boolean(template?.clientConsent),
        required: Boolean(template?.required),
        version: templateVersion,
        text: renderedText,
        templateKey: String(template?.templateKey || ''),
        templateVersion,
        templatePublishedAt: String(template?.templatePublishedAt || ''),
        customized: false,
      };
      documents.push(created);
      history.push({
        id: crypto.randomUUID(),
        documentId: created.id,
        documentTitle: created.title,
        documentVersion: created.version,
        action: 'template-created',
        createdAt: new Date().toISOString(),
        source: 'admin-template',
      });
      changed = true;
      continue;
    }

    const base = {
      ...previous,
      system: true,
      kind: template?.kind === 'consent' ? 'consent' : 'agreement',
      clientConsent: Boolean(template?.clientConsent),
      required: Boolean(template?.required),
      templateKey: String(template?.templateKey || ''),
      templateVersion,
      templatePublishedAt: String(template?.templatePublishedAt || ''),
    };

    // Existing full documents may already be the exact documents that were shown and signed.
    // Never replace them merely because they predate template metadata.
    if (!previous.templateKey && !legacyMock(previous)) {
      const linked = {
        ...base,
        customized: String(previous.text || '') !== renderedText || String(previous.title || '') !== renderedTitle,
      };
      if (!sameDocument(previous, linked)) {
        documents[index] = linked;
        changed = true;
      }
      continue;
    }

    if (previous.customized) {
      const linked = { ...base, customized: true };
      if (!sameDocument(previous, linked)) {
        documents[index] = linked;
        changed = true;
      }
      continue;
    }

    const contentChanged = String(previous.text || '') !== renderedText || String(previous.title || '') !== renderedTitle;
    const templateChanged = Number(previous.templateVersion || 0) !== templateVersion;
    if (!contentChanged && !templateChanged) continue;

    const next = {
      ...base,
      title: renderedTitle,
      text: renderedText,
      version: contentChanged ? Math.max(1, Number(previous.version || 1)) + 1 : Math.max(1, Number(previous.version || 1)),
      customized: false,
    };
    documents[index] = next;

    if (contentChanged) {
      history.push({
        id: crypto.randomUUID(),
        documentId: next.id,
        documentTitle: next.title,
        documentVersion: next.version,
        action: legacyMock(previous) ? 'legacy-template-replaced' : 'template-synced',
        createdAt: new Date().toISOString(),
        source: 'admin-template',
      });
    }
    changed = true;
  }

  return { changed, data: { documents, consents: source.consents, history } };
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

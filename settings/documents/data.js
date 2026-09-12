import { recordDocumentHistory } from './history.js';

const STORAGE_KEY = 'book.documents.templates.v1';
let documentsState = null;
let persistDocuments = null;

const DEFAULT_DOCUMENTS = [
  {
    id: 'pdn-agreement',
    system: true,
    kind: 'agreement',
    title: 'Соглашение об обработке персональных данных',
    clientConsent: false,
    required: false,
    version: 1,
    text: 'Шаблон для адаптации под вашу работу. Укажите сведения об операторе, цели и правила обработки персональных данных, категории данных, сроки хранения, порядок отзыва и контакты для обращений. Перед использованием рекомендуется проверить документ с юристом.'
  },
  {
    id: 'pdn-consent',
    system: true,
    kind: 'consent',
    title: 'Согласие на обработку персональных данных',
    clientConsent: true,
    required: true,
    version: 1,
    text: 'Я даю согласие на обработку персональных данных, необходимых для записи и оказания услуг, связи со мной и ведения истории записей. Состав данных, цели, действия с данными, срок действия согласия и способ его отзыва должны быть уточнены оператором перед использованием этого шаблона.'
  },
  {
    id: 'messages-consent',
    system: true,
    kind: 'consent',
    title: 'Согласие на информационные сообщения',
    clientConsent: true,
    required: false,
    version: 1,
    text: 'Я согласен(на) получать информационные сообщения, связанные с записью, изменением или отменой визита, а также иные сообщения, на которые я отдельно согласился(ась). Это согласие является необязательным и может быть отозвано.'
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(item = {}) {
  return {
    id: String(item.id || `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    system: Boolean(item.system),
    kind: item.kind === 'consent' ? 'consent' : 'agreement',
    title: String(item.title || 'Документ'),
    clientConsent: Boolean(item.clientConsent),
    required: Boolean(item.required),
    version: Math.max(1, Number(item.version || 1)),
    text: String(item.text || '')
  };
}

function legacySaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return Array.isArray(saved) && saved.length ? saved.map(normalize) : null;
  } catch {
    return null;
  }
}

export function configureDocumentPersistence(handler = null) {
  persistDocuments = typeof handler === 'function' ? handler : null;
}

export function getDefaultDocuments() {
  return clone(DEFAULT_DOCUMENTS).map(normalize);
}

export function readLegacyDocumentsSnapshot() {
  const saved = legacySaved();
  return saved ? saved.map((item) => clone(item)) : null;
}

export function hydrateDocumentsFromServer(items = []) {
  documentsState = (Array.isArray(items) && items.length ? items : DEFAULT_DOCUMENTS).map(normalize);
  return getDocuments();
}

export function getDocuments() {
  if (documentsState !== null) return clone(documentsState).map(normalize);
  const saved = legacySaved();
  return saved || getDefaultDocuments();
}

export function saveDocuments(items = []) {
  const normalized = (Array.isArray(items) ? items : []).map(normalize);
  if (documentsState !== null) {
    documentsState = clone(normalized);
    if (typeof persistDocuments === 'function') void persistDocuments(clone(documentsState));
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return clone(normalized);
}

export function saveDocument(document) {
  const items = getDocuments();
  const previous = items.find((item) => item.id === document?.id);
  const changedText = previous && String(previous.text || '') !== String(document?.text || '');
  const changedTitle = previous && String(previous.title || '') !== String(document?.title || '');
  const next = normalize({
    ...document,
    version: changedText ? Number(previous.version || 1) + 1 : Number(document?.version || previous?.version || 1),
  });
  const index = items.findIndex((item) => item.id === next.id);
  if (index >= 0) items[index] = next;
  else items.push(next);
  saveDocuments(items);

  if (!previous) {
    recordDocumentHistory({ documentId: next.id, documentTitle: next.title, documentVersion: next.version, action: 'created' });
  } else if (changedText || changedTitle) {
    recordDocumentHistory({ documentId: next.id, documentTitle: next.title, documentVersion: next.version, action: changedText ? 'version-created' : 'renamed' });
  }

  return next;
}

export function createDocument({ title = 'Новый документ', text = '' } = {}) {
  return saveDocument({
    id: `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    system: false,
    kind: 'agreement',
    title,
    clientConsent: false,
    required: false,
    version: 1,
    text
  });
}

export function resetDocumentTemplates() {
  if (documentsState !== null) return saveDocuments(getDefaultDocuments());
  localStorage.removeItem(STORAGE_KEY);
  return getDocuments();
}

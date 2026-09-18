import { recordDocumentHistory } from './history.js';

let documentsState = null;
let persistDocuments = null;

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
    text: String(item.text || ''),
    templateKey: String(item.templateKey || ''),
    templateVersion: Math.max(0, Number(item.templateVersion || 0)),
    templatePublishedAt: String(item.templatePublishedAt || ''),
    customized: Boolean(item.customized),
  };
}

export function configureDocumentPersistence(handler = null) {
  persistDocuments = typeof handler === 'function' ? handler : null;
}

export function hydrateDocumentsFromServer(items = []) {
  documentsState = (Array.isArray(items) ? items : []).map(normalize);
  return getDocuments();
}

export function getDocuments() {
  return clone(documentsState === null ? [] : documentsState).map(normalize);
}

export function saveDocuments(items = []) {
  documentsState = (Array.isArray(items) ? items : []).map(normalize);
  if (typeof persistDocuments === 'function') void persistDocuments(clone(documentsState));
  return clone(documentsState);
}

export function saveDocument(document) {
  const items = getDocuments();
  const previous = items.find((item) => item.id === document?.id);
  const changedText = previous && String(previous.text || '') !== String(document?.text || '');
  const changedTitle = previous && String(previous.title || '') !== String(document?.title || '');
  const next = normalize({
    ...document,
    customized: previous?.system ? true : Boolean(document?.customized),
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
    text,
    customized: true,
  });
}

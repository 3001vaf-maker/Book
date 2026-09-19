import { recordDocumentHistory } from './history.js';

let documentsState = null;
let persistDocuments = null;
let platformBasesState = [];
let platformContextState = { profile: {} };

const PLATFORM_DOCUMENT_IDS = ['pdn-agreement', 'pdn-consent', 'messages-consent'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeBase(item = {}) {
  return {
    key: String(item.key || ''),
    documentId: String(item.documentId || ''),
    kind: item.kind === 'consent' ? 'consent' : 'agreement',
    personConsent: Boolean(item.personConsent),
    required: Boolean(item.required),
    title: String(item.title || 'Документ'),
    version: Math.max(1, Number(item.version || 1)),
    content: String(item.content || ''),
  };
}

function normalize(item = {}) {
  const sourceMode = String(item.sourceMode || '').toUpperCase();
  return {
    id: String(item.id || `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    system: Boolean(item.system),
    kind: item.kind === 'consent' ? 'consent' : 'agreement',
    title: String(item.title || 'Документ'),
    personConsent: Boolean(item.personConsent),
    required: Boolean(item.required),
    version: Math.max(1, Number(item.version || 1)),
    text: String(item.text || ''),
    sourceMode: sourceMode === 'BOOK' ? 'BOOK' : sourceMode === 'CUSTOM' ? 'CUSTOM' : '',
    baseKey: String(item.baseKey || ''),
    baseVersion: Math.max(0, Number(item.baseVersion || 0)),
    availableBaseVersion: Math.max(0, Number(item.availableBaseVersion || 0)),
    availableBookText: String(item.availableBookText || ''),
  };
}

function contextValues() {
  const profile = platformContextState.profile || {};
  const fullName = [profile.name, profile.surname]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
  const emails = Array.isArray(profile.emails) ? profile.emails : [];
  const phones = Array.isArray(profile.phones) ? profile.phones : [];
  const contact = String(emails[0] || phones[0] || profile.email || profile.phone || '').trim();
  return {
    '[ФИО пользователя]': fullName,
    '[Контакт пользователя]': contact,
  };
}

function contextReady() {
  const values = contextValues();
  return Boolean(values['[ФИО пользователя]'] && values['[Контакт пользователя]']);
}

export function renderPlatformBaseText(base) {
  let text = String(base?.content || '');
  for (const [placeholder, value] of Object.entries(contextValues())) {
    text = text.split(placeholder).join(value || '________________');
  }
  return text;
}

function baseForDocument(documentId) {
  return platformBasesState.find((item) => item.documentId === documentId) || null;
}

function makeDocumentFromPlatformBase(base, version = 1) {
  return normalize({
    id: base.documentId,
    system: true,
    kind: base.kind,
    title: base.title,
    personConsent: base.personConsent,
    required: base.required,
    version,
    text: renderPlatformBaseText(base),
    sourceMode: 'BOOK',
    baseKey: base.key,
    baseVersion: base.version,
  });
}

function historyEntry(document, action, source) {
  return {
    id: crypto.randomUUID(),
    documentId: document.id,
    documentTitle: document.title,
    documentVersion: Math.max(1, Number(document.version || 1)),
    action,
    createdAt: new Date().toISOString(),
    source,
    snapshot: clone(document),
  };
}

export function configurePlatformDocumentBases(bases = [], context = {}) {
  platformBasesState = (Array.isArray(bases) ? bases : [])
    .map(normalizeBase)
    .filter((item) => item.key && item.documentId && item.content);
  platformContextState = {
    profile: context?.profile && typeof context.profile === 'object' ? clone(context.profile) : {},
  };
}

export function getPlatformDocumentBases() {
  return clone(platformBasesState);
}

export function buildTenantDocumentsFromPlatformBases() {
  if (!platformBasesState.length || !contextReady()) return [];
  return PLATFORM_DOCUMENT_IDS
    .map((id) => baseForDocument(id))
    .filter(Boolean)
    .map((base) => makeDocumentFromPlatformBase(base, 1));
}

export function reconcileTenantDocumentsWithPlatformBases(items = [], history = []) {
  const current = (Array.isArray(items) ? items : []).map(normalize);
  const nextHistory = Array.isArray(history) ? clone(history) : [];
  let changed = false;

  if (!platformBasesState.length || !contextReady()) {
    return { documents: current, history: nextHistory, changed: false };
  }

  for (const documentId of PLATFORM_DOCUMENT_IDS) {
    const base = baseForDocument(documentId);
    if (!base) continue;
    const rendered = renderPlatformBaseText(base);
    const index = current.findIndex((item) => item.id === documentId);

    if (index < 0) {
      const created = makeDocumentFromPlatformBase(base, 1);
      current.push(created);
      nextHistory.push(historyEntry(created, 'created', 'admin-template'));
      changed = true;
      continue;
    }

    const item = current[index];

    // Existing real documents are never overwritten merely because this connection is new.
    if (!item.sourceMode) {
      const exactAdminDocument = item.title === base.title && item.text === rendered;
      current[index] = normalize({
        ...item,
        sourceMode: exactAdminDocument ? 'BOOK' : 'CUSTOM',
        baseKey: base.key,
        baseVersion: exactAdminDocument ? base.version : 0,
        availableBaseVersion: exactAdminDocument ? 0 : base.version,
        availableBookText: exactAdminDocument ? '' : rendered,
      });
      changed = true;
      continue;
    }

    if (item.sourceMode === 'BOOK') {
      if (item.text !== rendered || item.title !== base.title || item.baseVersion !== base.version) {
        const previous = clone(item);
        const refreshed = normalize({
          ...item,
          title: base.title,
          text: rendered,
          version: Number(item.version || 1) + 1,
          baseKey: base.key,
          baseVersion: base.version,
          availableBaseVersion: 0,
          availableBookText: '',
        });
        current[index] = refreshed;
        nextHistory.push(historyEntry(previous, 'superseded', 'admin-template'));
        nextHistory.push(historyEntry(refreshed, 'version-created', 'admin-template'));
        changed = true;
      }
      continue;
    }

    const nextAvailable = item.text === rendered && item.title === base.title ? 0 : base.version;
    const nextText = nextAvailable ? rendered : '';
    if (item.baseKey !== base.key
      || item.availableBaseVersion !== nextAvailable
      || item.availableBookText !== nextText) {
      current[index] = normalize({
        ...item,
        baseKey: base.key,
        availableBaseVersion: nextAvailable,
        availableBookText: nextText,
      });
      changed = true;
    }
  }

  return { documents: current.map(normalize), history: nextHistory, changed };
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
    sourceMode: previous?.sourceMode || document?.sourceMode || 'CUSTOM',
    version: changedText ? Number(previous.version || 1) + 1 : Number(document?.version || previous?.version || 1),
  });
  const index = items.findIndex((item) => item.id === next.id);
  if (index >= 0) items[index] = next;
  else items.push(next);
  saveDocuments(items);

  if (!previous) {
    recordDocumentHistory({
      documentId: next.id,
      documentTitle: next.title,
      documentVersion: next.version,
      action: 'created',
      source: next.sourceMode === 'BOOK' ? 'admin-template' : 'custom',
      snapshot: next,
    });
  } else if (changedText || changedTitle) {
    recordDocumentHistory({
      documentId: next.id,
      documentTitle: next.title,
      documentVersion: next.version,
      action: changedText ? 'version-created' : 'renamed',
      source: next.sourceMode === 'BOOK' ? 'admin-template' : 'custom',
      snapshot: next,
    });
  }

  return next;
}

export function createDocument({ title = 'Новый документ', text = '' } = {}) {
  return saveDocument({
    id: `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    system: false,
    kind: 'agreement',
    title,
    personConsent: false,
    required: false,
    version: 1,
    text,
    sourceMode: 'CUSTOM',
  });
}

export function resetDocumentTemplates() {
  return saveDocuments(buildTenantDocumentsFromPlatformBases());
}

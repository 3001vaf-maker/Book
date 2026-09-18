import { recordDocumentHistory } from './history.js';

let documentsState = null;
let persistDocuments = null;
let bookBasesState = [];
let bookContextState = { profile: {}, workplaces: [] };

const BOOK_DOCUMENT_IDS = ['pdn-agreement', 'pdn-consent', 'messages-consent'];

const LEGACY_DEFAULT_DOCUMENTS = [
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

function normalizeBase(item = {}) {
  return {
    key: String(item.key || ''),
    documentId: String(item.documentId || ''),
    title: String(item.title || 'Документ'),
    version: Math.max(1, Number(item.version || 1)),
    text: String(item.text || ''),
    publishedAt: String(item.publishedAt || ''),
  };
}

function normalize(item = {}) {
  const sourceMode = String(item.sourceMode || '').toUpperCase();
  return {
    id: String(item.id || `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    system: Boolean(item.system),
    kind: item.kind === 'consent' ? 'consent' : 'agreement',
    title: String(item.title || 'Документ'),
    clientConsent: Boolean(item.clientConsent),
    required: Boolean(item.required),
    version: Math.max(1, Number(item.version || 1)),
    text: String(item.text || ''),
    sourceMode: sourceMode === 'BOOK' ? 'BOOK' : sourceMode === 'CUSTOM' ? 'CUSTOM' : '',
    baseKey: String(item.baseKey || ''),
    baseVersion: Math.max(0, Number(item.baseVersion || 0)),
    basePublishedAt: String(item.basePublishedAt || ''),
    availableBaseVersion: Math.max(0, Number(item.availableBaseVersion || 0)),
    availableBasePublishedAt: String(item.availableBasePublishedAt || ''),
    availableBookText: String(item.availableBookText || ''),
    profileUpdateAvailable: Boolean(item.profileUpdateAvailable),
    dismissedBaseVersion: Math.max(0, Number(item.dismissedBaseVersion || 0)),
  };
}

function missingValue() {
  return '________________';
}

function bookContextValues() {
  const profile = bookContextState.profile || {};
  const fullName = [profile.name, profile.surname].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
  const emails = Array.isArray(profile.emails) ? profile.emails : [];
  const phones = Array.isArray(profile.phones) ? profile.phones : [];
  const contact = String(emails[0] || phones[0] || profile.email || profile.phone || '').trim();
  return {
    '[ФИО пользователя]': fullName || missingValue(),
    '[Контакт пользователя]': contact || missingValue(),
  };
}

export function renderBookBaseText(base) {
  let text = String(base?.text || '');
  for (const [placeholder, value] of Object.entries(bookContextValues())) {
    text = text.split(placeholder).join(value);
  }
  return text;
}

function bookContextReady() {
  const profile = bookContextState.profile || {};
  const workplaces = Array.isArray(bookContextState.workplaces) ? bookContextState.workplaces : [];
  const contacts = [
    ...(Array.isArray(profile.emails) ? profile.emails : []),
    ...(Array.isArray(profile.phones) ? profile.phones : []),
    profile.email,
    profile.phone,
  ].map((value) => String(value || '').trim()).filter(Boolean);
  return Boolean(String(profile.name || '').trim()
    && String(profile.profession || '').trim()
    && contacts.length
    && workplaces.length);
}

function documentConfig(documentId) {
  if (documentId === 'pdn-agreement') return { kind: 'agreement', clientConsent: false, required: false };
  if (documentId === 'pdn-consent') return { kind: 'consent', clientConsent: true, required: true };
  if (documentId === 'messages-consent') return { kind: 'consent', clientConsent: true, required: false };
  return { kind: 'agreement', clientConsent: false, required: false };
}

function baseForDocument(documentId) {
  return bookBasesState.find((item) => item.documentId === documentId) || null;
}

function makeBookDocument(base, version = 1) {
  const config = documentConfig(base.documentId);
  return normalize({
    id: base.documentId,
    system: true,
    ...config,
    title: base.title,
    version,
    text: renderBookBaseText(base),
    sourceMode: 'BOOK',
    baseKey: base.key,
    baseVersion: base.version,
    basePublishedAt: base.publishedAt,
  });
}

function legacyDefault(documentId) {
  return LEGACY_DEFAULT_DOCUMENTS.find((item) => item.id === documentId) || null;
}

function isUntouchedLegacyDocument(item) {
  const legacy = legacyDefault(item.id);
  if (!legacy) return false;
  return String(item.title || '') === legacy.title
    && String(item.text || '') === legacy.text
    && Number(item.version || 1) === Number(legacy.version || 1);
}

function historyEntry(document, action, source = 'book-base-migration') {
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

export function configureBookDocumentBases(bases = [], context = {}) {
  bookBasesState = (Array.isArray(bases) ? bases : []).map(normalizeBase).filter((item) => item.key && item.documentId);
  bookContextState = {
    profile: context?.profile && typeof context.profile === 'object' ? clone(context.profile) : {},
    workplaces: Array.isArray(context?.workplaces) ? clone(context.workplaces) : [],
  };
}

export function getBookDocumentBases() {
  return clone(bookBasesState);
}

export function buildBookDocuments() {
  if (!bookBasesState.length) return [];
  if (!bookContextReady()) return [];
  return BOOK_DOCUMENT_IDS
    .map((id) => baseForDocument(id))
    .filter(Boolean)
    .map((base) => makeBookDocument(base, 1));
}

export function reconcileBookDocuments(items = [], history = []) {
  const current = (Array.isArray(items) ? items : []).map(normalize);
  const nextHistory = Array.isArray(history) ? clone(history) : [];
  let changed = false;

  if (!bookContextReady()) {
    return { documents: current.map(normalize), history: nextHistory, changed: false };
  }

  for (const documentId of BOOK_DOCUMENT_IDS) {
    const base = baseForDocument(documentId);
    if (!base) continue;
    const index = current.findIndex((item) => item.id === documentId);

    if (index < 0) {
      const created = makeBookDocument(base, 1);
      current.push(created);
      nextHistory.push(historyEntry(created, 'created', 'book-base'));
      changed = true;
      continue;
    }

    const item = current[index];
    if (!item.sourceMode) {
      if (isUntouchedLegacyDocument(item)) {
        const previous = clone(item);
        const migrated = makeBookDocument(base, Number(item.version || 1) + 1);
        current[index] = migrated;
        nextHistory.push(historyEntry(previous, 'superseded', 'legacy-template'));
        nextHistory.push(historyEntry(migrated, 'version-created', 'book-base'));
        changed = true;
        continue;
      }
      item.sourceMode = 'CUSTOM';
      item.baseKey = base.key;
      item.availableBaseVersion = base.version;
      item.availableBasePublishedAt = base.publishedAt;
      item.availableBookText = renderBookBaseText(base);
      current[index] = normalize(item);
      changed = true;
      continue;
    }

    const rendered = renderBookBaseText(base);
    const previousPresentation = JSON.stringify({
      availableBaseVersion: item.availableBaseVersion,
      availableBasePublishedAt: item.availableBasePublishedAt,
      availableBookText: item.availableBookText,
      profileUpdateAvailable: item.profileUpdateAvailable,
    });

    if (item.sourceMode === 'BOOK') {
      const needsRefresh = base.version > Number(item.baseVersion || 0) || rendered !== item.text;
      if (needsRefresh) {
        const previous = clone(item);
        const refreshed = normalize({
          ...item,
          title: base.title,
          text: rendered,
          version: Number(item.version || 1) + 1,
          baseKey: base.key,
          baseVersion: base.version,
          basePublishedAt: base.publishedAt,
          availableBaseVersion: 0,
          availableBasePublishedAt: '',
          availableBookText: '',
          profileUpdateAvailable: false,
          dismissedBaseVersion: 0,
        });
        current[index] = refreshed;
        nextHistory.push(historyEntry(previous, 'superseded', 'book-auto-refresh'));
        nextHistory.push(historyEntry(refreshed, 'version-created', 'book-auto-refresh'));
        changed = true;
        continue;
      }
      item.availableBaseVersion = 0;
      item.availableBasePublishedAt = '';
      item.availableBookText = '';
      item.profileUpdateAvailable = false;
    } else {
      item.availableBaseVersion = base.version > Number(item.dismissedBaseVersion || 0) ? base.version : 0;
      item.availableBasePublishedAt = item.availableBaseVersion ? base.publishedAt : '';
      item.availableBookText = item.availableBaseVersion ? rendered : '';
      item.profileUpdateAvailable = false;
    }
    current[index] = normalize(item);

    const nextPresentation = JSON.stringify({
      availableBaseVersion: current[index].availableBaseVersion,
      availableBasePublishedAt: current[index].availableBasePublishedAt,
      availableBookText: current[index].availableBookText,
      profileUpdateAvailable: current[index].profileUpdateAvailable,
    });
    if (previousPresentation !== nextPresentation) changed = true;
  }

  return { documents: current.map(normalize), history: nextHistory, changed };
}

export function configureDocumentPersistence(handler = null) {
  persistDocuments = typeof handler === 'function' ? handler : null;
}

export function getDefaultDocuments() {
  return clone(LEGACY_DEFAULT_DOCUMENTS).map(normalize);
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
  const nextCandidate = normalize(document);
  const changedText = previous && String(previous.text || '') !== String(nextCandidate.text || '');
  const changedTitle = previous && String(previous.title || '') !== String(nextCandidate.title || '');
  const changedSource = previous && String(previous.sourceMode || '') !== String(nextCandidate.sourceMode || '');
  const changedBase = previous && Number(previous.baseVersion || 0) !== Number(nextCandidate.baseVersion || 0);
  const versionChanged = Boolean(previous && (changedText || changedTitle || changedSource || changedBase));

  if (previous && versionChanged) {
    recordDocumentHistory({
      documentId: previous.id,
      documentTitle: previous.title,
      documentVersion: previous.version,
      action: 'superseded',
      source: previous.sourceMode === 'BOOK' ? 'book-base' : 'custom',
      snapshot: previous,
    });
  }

  const next = normalize({
    ...nextCandidate,
    version: versionChanged
      ? Number(previous.version || 1) + 1
      : Number(nextCandidate.version || previous?.version || 1),
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
      source: next.sourceMode === 'BOOK' ? 'book-base' : 'custom',
      snapshot: next,
    });
  } else if (versionChanged) {
    recordDocumentHistory({
      documentId: next.id,
      documentTitle: next.title,
      documentVersion: next.version,
      action: 'version-created',
      source: next.sourceMode === 'BOOK' ? 'book-base' : 'custom',
      snapshot: next,
    });
  }

  return next;
}

export function useBookBase(documentId) {
  const current = getDocuments().find((item) => item.id === documentId);
  const base = baseForDocument(documentId);
  if (!current || !base) return null;
  return saveDocument({
    ...current,
    title: base.title,
    text: renderBookBaseText(base),
    sourceMode: 'BOOK',
    baseKey: base.key,
    baseVersion: base.version,
    basePublishedAt: base.publishedAt,
    availableBaseVersion: 0,
    availableBasePublishedAt: '',
    availableBookText: '',
    profileUpdateAvailable: false,
    dismissedBaseVersion: 0,
  });
}

export function dismissBookBase(documentId) {
  const current = getDocuments().find((item) => item.id === documentId);
  const base = baseForDocument(documentId);
  if (!current || !base) return null;
  const next = normalize({
    ...current,
    dismissedBaseVersion: base.version,
    availableBaseVersion: 0,
    availableBasePublishedAt: '',
    availableBookText: '',
    profileUpdateAvailable: false,
  });
  const items = getDocuments();
  const index = items.findIndex((item) => item.id === documentId);
  if (index >= 0) items[index] = next;
  saveDocuments(items);
  return next;
}

export function saveCustomDocument(document, { title, text } = {}) {
  const base = baseForDocument(document?.id);
  const offeredVersion = base && Number(base.version || 0) > Number(document?.dismissedBaseVersion || 0)
    ? Number(base.version || 0)
    : 0;
  return saveDocument({
    ...document,
    title: String(title || document?.title || 'Документ'),
    text: String(text ?? document?.text ?? ''),
    sourceMode: 'CUSTOM',
    availableBaseVersion: offeredVersion,
    availableBasePublishedAt: offeredVersion ? base?.publishedAt || '' : '',
    availableBookText: offeredVersion && base ? renderBookBaseText(base) : '',
    profileUpdateAvailable: false,
  });
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
    sourceMode: 'CUSTOM',
  });
}

export function resetDocumentTemplates() {
  return saveDocuments(buildBookDocuments());
}

const STORAGE_KEY = 'book.documents.templates.v1';

const DEFAULT_DOCUMENTS = [
  {
    id: 'pdn-agreement',
    system: true,
    kind: 'agreement',
    title: 'Соглашение об обработке персональных данных',
    clientConsent: false,
    required: false,
    text: 'Шаблон для адаптации под вашу работу. Укажите сведения об операторе, цели и правила обработки персональных данных, категории данных, сроки хранения, порядок отзыва и контакты для обращений. Перед использованием рекомендуется проверить документ с юристом.'
  },
  {
    id: 'pdn-consent',
    system: true,
    kind: 'consent',
    title: 'Согласие на обработку персональных данных',
    clientConsent: true,
    required: true,
    text: 'Я даю согласие на обработку персональных данных, необходимых для записи и оказания услуг, связи со мной и ведения истории записей. Состав данных, цели, действия с данными, срок действия согласия и способ его отзыва должны быть уточнены оператором перед использованием этого шаблона.'
  },
  {
    id: 'messages-consent',
    system: true,
    kind: 'consent',
    title: 'Согласие на информационные сообщения',
    clientConsent: true,
    required: false,
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
    text: String(item.text || '')
  };
}

export function getDocuments() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) return saved.map(normalize);
  } catch {}
  return clone(DEFAULT_DOCUMENTS);
}

export function saveDocuments(items = []) {
  const normalized = (Array.isArray(items) ? items : []).map(normalize);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function saveDocument(document) {
  const items = getDocuments();
  const next = normalize(document);
  const index = items.findIndex((item) => item.id === next.id);
  if (index >= 0) items[index] = next;
  else items.push(next);
  saveDocuments(items);
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
    text
  });
}

export function resetDocumentTemplates() {
  localStorage.removeItem(STORAGE_KEY);
}

import assert from 'node:assert/strict';
import {
  configureBookDocumentBases,
  getDefaultDocuments,
  hydrateDocumentsFromServer,
  getDocuments,
  reconcileBookDocuments,
  saveCustomDocument,
  useBookBase,
} from '../settings/documents/data.js';

const basesV1 = [
  {
    key: 'user-document-pdn-policy',
    documentId: 'pdn-agreement',
    title: 'Политика обработки персональных данных',
    version: 1,
    text: 'Оператор: [ФИО пользователя]\nКонтакт: [Контакт пользователя]\nМесто: [Место деятельности]',
    publishedAt: '2026-09-18T00:00:00.000Z',
  },
  {
    key: 'user-document-pdn-consent',
    documentId: 'pdn-consent',
    title: 'Согласие на обработку персональных данных',
    version: 1,
    text: 'Я даю согласие оператору [ФИО пользователя]. Контакт: [Контакт пользователя].',
    publishedAt: '2026-09-18T00:00:00.000Z',
  },
  {
    key: 'user-document-messages-consent',
    documentId: 'messages-consent',
    title: 'Согласие на рекламные и маркетинговые сообщения',
    version: 1,
    text: 'Рекламодатель: [ФИО пользователя]. Контакт: [Контакт пользователя].',
    publishedAt: '2026-09-18T00:00:00.000Z',
  },
];

configureBookDocumentBases(basesV1, {
  profile: { name: 'Александр', surname: 'Волоковых', emails: ['a@example.test'], phones: [] },
  workplaces: [{ address: 'Москва' }],
});

const reconciled = reconcileBookDocuments(getDefaultDocuments(), []);
assert.equal(reconciled.changed, true);
assert.deepEqual(
  reconciled.documents.filter((item) => ['pdn-agreement', 'pdn-consent', 'messages-consent'].includes(item.id)).map((item) => item.id),
  ['pdn-agreement', 'pdn-consent', 'messages-consent'],
);
for (const item of reconciled.documents) {
  assert.equal(item.sourceMode, 'BOOK');
  assert.equal(item.version, 2);
  assert.match(item.text, /Александр Волоковых/);
  assert.doesNotMatch(item.text, /обратиться к юристу|Шаблон для адаптации/i);
}
assert.ok(reconciled.history.some((item) => item.action === 'superseded' && item.snapshot?.id === 'pdn-consent'));

hydrateDocumentsFromServer(reconciled.documents);
const beforeCustom = getDocuments().find((item) => item.id === 'pdn-consent');
const custom = saveCustomDocument(beforeCustom, { title: beforeCustom.title, text: 'Мой собственный документ' });
assert.equal(custom.id, 'pdn-consent');
assert.equal(custom.sourceMode, 'CUSTOM');
assert.equal(custom.version, 3);

const backToBook = useBookBase('pdn-consent');
assert.equal(backToBook.id, 'pdn-consent');
assert.equal(backToBook.sourceMode, 'BOOK');
assert.equal(backToBook.version, 4);
assert.equal(backToBook.baseVersion, 1);

configureBookDocumentBases(
  basesV1.map((item) => item.documentId === 'pdn-consent'
    ? { ...item, version: 2, text: item.text + '\nНовая редакция Book.', publishedAt: '2026-09-19T00:00:00.000Z' }
    : item),
  {
    profile: { name: 'Александр', surname: 'Волоковых', emails: ['a@example.test'], phones: [] },
    workplaces: [{ address: 'Москва' }],
  },
);

const updateAvailable = reconcileBookDocuments(getDocuments(), []);
const currentConsent = updateAvailable.documents.find((item) => item.id === 'pdn-consent');
assert.equal(currentConsent.version, 4, 'новая основа Book не должна применяться без выбора пользователя');
assert.equal(currentConsent.baseVersion, 1);
assert.equal(currentConsent.availableBaseVersion, 2);
assert.match(currentConsent.availableBookText, /Новая редакция Book/);

console.log('document base chain: ok');

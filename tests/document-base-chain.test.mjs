import assert from 'node:assert/strict';
import {
  configureBookDocumentBases,
  getDocuments,
  hydrateDocumentsFromServer,
  reconcileBookDocuments,
  saveCustomDocument,
} from '../settings/documents/data.js';

const basesV1 = [
  {
    key: 'user-document-pdn-policy',
    documentId: 'pdn-agreement',
    title: 'Политика обработки персональных данных',
    version: 1,
    text: 'Оператор: [ФИО пользователя]\nКонтакт: [Контакт пользователя]',
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
  profile: { name: 'Александр', surname: 'Волоковых', emails: ['a@example.test'], phones: [], profession: '' },
  workplaces: [],
});
let reconciled = reconcileBookDocuments([], []);
assert.equal(reconciled.changed, false, 'до заполненного профиля документы мастера не создаются');
assert.equal(reconciled.documents.length, 0);

configureBookDocumentBases(basesV1, {
  profile: { name: 'Александр', surname: 'Волоковых', emails: ['a@example.test'], phones: [], profession: 'Парикмахер' },
  workplaces: [{ key: 'studio', address: 'Москва' }],
});
reconciled = reconcileBookDocuments([], []);
assert.equal(reconciled.changed, true);
assert.deepEqual(reconciled.documents.map((item) => item.id), ['pdn-agreement', 'pdn-consent', 'messages-consent']);
for (const item of reconciled.documents) {
  assert.equal(item.sourceMode, 'BOOK');
  assert.equal(item.version, 1);
  assert.match(item.text, /Александр Волоковых/);
  assert.doesNotMatch(item.text, /\[ФИО пользователя\]|________________/);
}

hydrateDocumentsFromServer(reconciled.documents);
configureBookDocumentBases(basesV1, {
  profile: { name: 'Александр', surname: 'Волоковых', emails: ['new@example.test'], phones: [], profession: 'Парикмахер' },
  workplaces: [{ key: 'studio', address: 'Москва' }],
});
const profileRefresh = reconcileBookDocuments(getDocuments(), reconciled.history);
assert.equal(profileRefresh.changed, true);
for (const item of profileRefresh.documents) {
  assert.equal(item.version, 2, 'изменение профильных данных автоматически создаёт новую версию');
  assert.match(item.text, /new@example\.test/);
  assert.equal(item.profileUpdateAvailable, false);
}
assert.ok(profileRefresh.history.some((item) => item.action === 'superseded' && item.source === 'book-auto-refresh'));

hydrateDocumentsFromServer(profileRefresh.documents);
const basesV2 = basesV1.map((item) => ({
  ...item,
  version: 2,
  text: item.text + '\nРедакция Book v2.',
  publishedAt: '2026-09-19T00:00:00.000Z',
}));
configureBookDocumentBases(basesV2, {
  profile: { name: 'Александр', surname: 'Волоковых', emails: ['new@example.test'], phones: [], profession: 'Парикмахер' },
  workplaces: [{ key: 'studio', address: 'Москва' }],
});
const baseRefresh = reconcileBookDocuments(getDocuments(), profileRefresh.history);
for (const item of baseRefresh.documents) {
  assert.equal(item.version, 3, 'новая основа Book автоматически становится новой рабочей версией');
  assert.equal(item.baseVersion, 2);
  assert.match(item.text, /Редакция Book v2/);
}

hydrateDocumentsFromServer(baseRefresh.documents);
const consent = getDocuments().find((item) => item.id === 'pdn-consent');
const custom = saveCustomDocument(consent, { title: consent.title, text: 'Мой собственный документ' });
assert.equal(custom.sourceMode, 'CUSTOM');

configureBookDocumentBases(basesV2.map((item) => item.documentId === 'pdn-consent' ? { ...item, version: 3 } : item), {
  profile: { name: 'Александр', surname: 'Волоковых', emails: ['new@example.test'], phones: [], profession: 'Парикмахер' },
  workplaces: [{ key: 'studio', address: 'Москва' }],
});
const customOffer = reconcileBookDocuments(getDocuments(), baseRefresh.history);
const customConsent = customOffer.documents.find((item) => item.id === 'pdn-consent');
assert.equal(customConsent.sourceMode, 'CUSTOM');
assert.equal(customConsent.availableBaseVersion, 3, 'свой документ не перезаписывается автоматически');

console.log('document base chain: ok');

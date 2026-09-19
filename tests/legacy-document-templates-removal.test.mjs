import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getBookDocumentBases } from '../admin/document-registry/catalog.js';
import {
  buildBookDocuments,
  configureBookDocumentBases,
  reconcileBookDocuments,
} from '../settings/documents/data.js';

const activeData = readFileSync(new URL('../settings/documents/data.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../tenant-document-archive.js', import.meta.url), 'utf8');

assert.doesNotMatch(activeData, /DEFAULT_DOCUMENTS/);
assert.doesNotMatch(activeData, /getDefaultDocuments/);
assert.doesNotMatch(activeData, /Шаблон для адаптации под вашу работу/);
assert.doesNotMatch(activeData, /Состав данных, цели, действия с данными, срок действия согласия/);
assert.doesNotMatch(activeData, /Я согласен\(на\) получать информационные сообщения/);

assert.match(migration, /getBookDocumentBases/);
assert.match(migration, /\.\/admin\/document-registry\/catalog\.js/);
assert.doesNotMatch(migration, /getDefaultDocuments/);

const bases = getBookDocumentBases();
assert.equal(bases.length, 3);
assert.deepEqual(bases.map((item) => item.documentId), [
  'pdn-agreement',
  'pdn-consent',
  'messages-consent',
]);
for (const base of bases) {
  assert.ok(base.content.length > 500, `Admin base is unexpectedly short: ${base.key}`);
}

configureBookDocumentBases(bases, {
  profile: {
    name: 'Александр',
    surname: 'Волоковых',
    emails: ['owner@example.test'],
    phones: [],
  },
  workplaces: [{ key: 'studio' }],
});

const fresh = buildBookDocuments();
assert.equal(fresh.length, 3);
assert.equal(fresh.every((item) => item.sourceMode === 'BOOK'), true);
assert.equal(fresh.every((item) => item.baseKey.startsWith('user-document-')), true);
assert.equal(fresh.some((item) => item.text.includes('[ФИО пользователя]')), false);
assert.equal(fresh.some((item) => item.text.includes('[Контакт пользователя]')), false);
assert.equal(fresh.some((item) => item.text.includes('Александр Волоковых')), true);

const existingFullText = 'Это уже существующий полный документ версии 3, который использовался в реальном тесте.';
const current = [{
  id: 'pdn-consent',
  system: true,
  kind: 'consent',
  title: 'Согласие на обработку персональных данных',
  clientConsent: true,
  required: true,
  version: 3,
  text: existingFullText,
}];

const reconciled = reconcileBookDocuments(current, []);
const kept = reconciled.documents.find((item) => item.id === 'pdn-consent');
assert.equal(kept.text, existingFullText, 'Existing real document text must not be overwritten');
assert.equal(kept.version, 3, 'Existing real document version must not change');
assert.equal(kept.sourceMode, 'CUSTOM', 'Existing unmatched real document is preserved as its own current document');
assert.equal(reconciled.history.length, 2, 'Only genuinely missing documents may be created from Admin bases');
assert.equal(reconciled.history.every((item) => item.source === 'admin-template'), true);

const generatedConsent = fresh.find((item) => item.id === 'pdn-consent');
const exactExisting = [{ ...generatedConsent, version: 3, sourceMode: '' }];
const exactReconciled = reconcileBookDocuments(exactExisting, []);
const exact = exactReconciled.documents.find((item) => item.id === 'pdn-consent');
assert.equal(exact.text, generatedConsent.text);
assert.equal(exact.version, 3, 'Linking an existing exact Admin document must not change its version');
assert.equal(exact.sourceMode, 'BOOK');

console.log('Legacy document templates removal tests: OK');

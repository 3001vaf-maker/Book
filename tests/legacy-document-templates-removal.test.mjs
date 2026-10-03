import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getRegistryUserLegalTemplates } from '../admin/document-registry/catalog.js';
import {
  buildTenantDocumentsFromPlatformBases,
  configurePlatformDocumentBases,
  reconcileTenantDocumentsWithPlatformBases,
} from '../settings/documents/data.js';

const activeData = readFileSync(new URL('../settings/documents/data.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../tenant-document-archive.js', import.meta.url), 'utf8');

assert.doesNotMatch(activeData, /DEFAULT_DOCUMENTS|getDefaultDocuments/);
assert.doesNotMatch(activeData, /Шаблон для адаптации под вашу работу/);
assert.doesNotMatch(activeData, /getBookDocumentBases|configureBookDocumentBases|buildBookDocuments|reconcileBookDocuments/);
assert.match(activeData, /platform-registry/);
assert.doesNotMatch(activeData, /admin-template/);

assert.match(migration, /tenant-document-archive\/platform-bases/);
assert.doesNotMatch(migration, /admin\/document-registry\/catalog\.js|getPlatformDocumentBases/);
assert.doesNotMatch(migration, /getWorkplaces|workplaces/);

const config = {
  'user-document-pdn-policy': { documentId: 'pdn-agreement', kind: 'agreement', personConsent: false, required: false },
  'user-document-pdn-consent': { documentId: 'pdn-consent', kind: 'consent', personConsent: true, required: true },
  'user-document-messages-consent': { documentId: 'messages-consent', kind: 'consent', personConsent: true, required: false },
};
const bases = getRegistryUserLegalTemplates().map((item) => ({
  key: item.key,
  ...config[item.key],
  title: item.title,
  version: 1,
  content: item.content,
}));

assert.equal(bases.length, 3);
assert.deepEqual(bases.map((item) => item.documentId), ['pdn-agreement','pdn-consent','messages-consent']);
for (const base of bases) assert.ok(base.content.length > 500, `Registry base is unexpectedly short: ${base.key}`);

configurePlatformDocumentBases(bases, {
  profile: {
    name: 'Александр',
    surname: 'Волоковых',
    emails: ['owner@example.test'],
    phones: [],
  },
});

const fresh = buildTenantDocumentsFromPlatformBases();
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
  personConsent: true,
  required: true,
  version: 3,
  text: existingFullText,
}];

const reconciled = reconcileTenantDocumentsWithPlatformBases(current, []);
const kept = reconciled.documents.find((item) => item.id === 'pdn-consent');
assert.equal(kept.text, existingFullText);
assert.equal(kept.version, 3);
assert.equal(kept.sourceMode, 'CUSTOM');
assert.equal(reconciled.history.length, 2);
assert.equal(reconciled.history.every((item) => item.source === 'platform-registry'), true);

const generatedConsent = fresh.find((item) => item.id === 'pdn-consent');
const exactExisting = [{ ...generatedConsent, version: 3, sourceMode: '' }];
const exactReconciled = reconcileTenantDocumentsWithPlatformBases(exactExisting, []);
const exact = exactReconciled.documents.find((item) => item.id === 'pdn-consent');
assert.equal(exact.text, generatedConsent.text);
assert.equal(exact.version, 3);
assert.equal(exact.sourceMode, 'BOOK');

console.log('Legacy document templates removal tests: OK');

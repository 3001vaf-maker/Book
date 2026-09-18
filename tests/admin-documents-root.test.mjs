import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { syncAdminTemplates } from '../document-migration.js';

const catalog = readFileSync(new URL('../server/src/platform-documents/platform-document-catalog.ts', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('../admin/documents/view.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../server/prisma/migrations/20260918231500_document_repository_root/migration.sql', import.meta.url), 'utf8');

const bookKeys = ['privacy-policy','saas-agreement','master-pd-consent','marketing-consent','public-profile-consent','dpa'];
const userBaseKeys = ['user-document-pdn-policy','user-document-pdn-consent','user-document-messages-consent'];

for (const key of [...bookKeys, ...userBaseKeys]) {
  assert.match(catalog, new RegExp(`key: ["']${key}["']`), `Missing canonical document key ${key}`);
}
assert.equal(bookKeys.length, 6);
assert.equal(userBaseKeys.length, 3);

assert.match(admin, /adminRequest\('\/documents'\)/);
assert.match(admin, /adminRequest\('\/documents\/history'\)/);
assert.match(view, /Book ↔ пользователь/);
assert.match(view, /Основы документов пользователя/);
assert.match(view, /История Book/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS "LegalAcceptanceEvent"/);
assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS "ConsentEvent"/, 'Tenant signing history must not be duplicated into a second store in this change');

const legacyConsentText = 'Я даю согласие на обработку персональных данных, необходимых для записи и оказания услуг, связи со мной и ведения истории записей. Состав данных, цели, действия с данными, срок действия согласия и способ его отзыва должны быть уточнены оператором перед использованием этого шаблона.';
const existingSignedText = 'ПОЛНЫЙ ПРАВИЛЬНЫЙ ДОКУМЕНТ, КОТОРЫЙ УЖЕ ПОКАЗЫВАЛСЯ КЛИЕНТУ';

const bundle = {
  documents: [
    {
      id: 'pdn-agreement',
      system: true,
      kind: 'agreement',
      title: 'Политика обработки персональных данных',
      clientConsent: false,
      required: false,
      version: 4,
      text: existingSignedText,
    },
    {
      id: 'pdn-consent',
      system: true,
      kind: 'consent',
      title: 'Согласие на обработку персональных данных',
      clientConsent: true,
      required: true,
      version: 1,
      text: legacyConsentText,
    },
  ],
  consents: [
    {
      id: 'signature-today',
      clientId: 'client-1',
      documentId: 'pdn-consent',
      documentVersion: 1,
      status: 'accepted',
      acceptedAt: '2026-09-18T12:00:00.000Z',
      createdAt: '2026-09-18T12:00:00.000Z',
    },
  ],
  history: [],
};

const templates = [
  {
    templateKey: 'user-document-pdn-policy',
    documentId: 'pdn-agreement',
    kind: 'agreement',
    clientConsent: false,
    required: false,
    title: 'Политика обработки персональных данных',
    templateVersion: 2,
    templatePublishedAt: '2026-09-18T10:00:00.000Z',
    text: 'Политика для [ФИО пользователя]. Контакт: [Контакт пользователя].',
  },
  {
    templateKey: 'user-document-pdn-consent',
    documentId: 'pdn-consent',
    kind: 'consent',
    clientConsent: true,
    required: true,
    title: 'Согласие на обработку персональных данных',
    templateVersion: 2,
    templatePublishedAt: '2026-09-18T10:00:00.000Z',
    text: 'Новое полное согласие для [ФИО пользователя]. Контакт: [Контакт пользователя].',
  },
  {
    templateKey: 'user-document-messages-consent',
    documentId: 'messages-consent',
    kind: 'consent',
    clientConsent: true,
    required: false,
    title: 'Согласие на рекламные и маркетинговые сообщения',
    templateVersion: 2,
    templatePublishedAt: '2026-09-18T10:00:00.000Z',
    text: 'Маркетинговое согласие для [ФИО пользователя]. Контакт: [Контакт пользователя].',
  },
];

const result = syncAdminTemplates(bundle, templates, { user: { email: 'owner@example.test' } });
const policy = result.data.documents.find((item) => item.id === 'pdn-agreement');
const consent = result.data.documents.find((item) => item.id === 'pdn-consent');
const messages = result.data.documents.find((item) => item.id === 'messages-consent');

assert.equal(policy.text, existingSignedText, 'Existing full document must not be overwritten');
assert.equal(policy.templateKey, 'user-document-pdn-policy', 'Existing document must be linked to its Admin template');
assert.equal(policy.version, 4, 'Linking metadata must not change an already used document version');
assert.equal(consent.text, 'Новое полное согласие для owner@example.test. Контакт: owner@example.test.');
assert.equal(consent.version, 2, 'Replacing the legacy mock must create a new document version');
assert.equal(messages.templateKey, 'user-document-messages-consent');
assert.deepEqual(result.data.consents, bundle.consents, 'Template synchronization must not rewrite or duplicate signing history');

console.log('Admin/Documents repository tests: OK');

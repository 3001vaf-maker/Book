import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const admin = readFileSync('admin/admin.js', 'utf8');
const appModule = readFileSync('server/src/app.module.ts', 'utf8');
const profileService = readFileSync('server/src/profile/profile.service.ts', 'utf8');
const policy = readFileSync('server/src/profile/profile-creation-policy.service.ts', 'utf8');
const controller = readFileSync('server/src/profile/profile.controller.ts', 'utf8');
const cleanReset = readFileSync('server/prisma/migrations/20260916150000_clean_launch_reset/migration.sql', 'utf8');

const activeDocuments = [
  'privacy-policy',
  'saas-agreement',
  'user-pd-consent',
  'marketing-consent',
  'public-profile-consent',
  'dpa',
];

for (const key of activeDocuments) {
  assert.match(admin, new RegExp(key));
}

for (const key of [
  'user-document-pdn-policy',
  'user-document-pdn-consent',
  'user-document-messages-consent',
]) {
  assert.match(admin, new RegExp(key));
}

assert.match(admin, /Действующие документы — 6/);
assert.match(admin, /Для пользователей/);
assert.match(admin, /Для SaaS \/ платформы/);
assert.match(admin, /Шаблоны рабочих документов/);
assert.match(admin, /Политика обработки персональных данных/);
assert.match(admin, /Согласие на обработку персональных данных/);
assert.match(admin, /Согласие на рекламные и маркетинговые сообщения/);
assert.match(admin, /История/);

assert.match(appModule, /PlatformDocumentsModule/);
assert.match(policy, /PROFILE_CREATION_DOCUMENT_KEY = 'user-pd-consent'/);
assert.doesNotMatch(policy, /PROFILE_CREATION_DOCUMENT_KEY = 'user-document-pdn-consent'/);

const migrateBlock = profileService.slice(
  profileService.indexOf('async migrate'),
  profileService.indexOf('async verifyMigration'),
);
assert.ok(
  migrateBlock.indexOf('if (existing) return') < migrateBlock.indexOf('creationPolicy.assertAccepted'),
  'existing Profile must not be blocked by profile-creation consent',
);

const bootstrapBlock = profileService.slice(
  profileService.indexOf('async bootstrap'),
  profileService.indexOf('async creationRequirement'),
);
assert.match(bootstrapBlock, /if \(!existing\)/);
assert.match(bootstrapBlock, /creationPolicy\.assertAccepted/);

assert.match(controller, /@Get\('creation-requirement'\)/);
assert.match(controller, /@Post\('creation-consent'\)/);

assert.doesNotMatch(cleanReset, /DELETE FROM "LegalDocument"/);
assert.doesNotMatch(cleanReset, /DELETE FROM "LegalDocumentVersion"/);

console.log('owner documents/profile creation architecture: OK');

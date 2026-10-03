import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(path, 'utf8');

const core = source('core.js');
const access = source('server/src/saas-access/saas-access.service.ts');
const accessController = source('server/src/saas-access/saas-access.controller.ts');
const coreAccess = source('core/access.js');
const registrationDocuments = source('server/src/document-registry/registration-document.service.ts');
const invitation = source('server/src/tenant-invitation/tenant-invitation.service.ts');
const profile = source('settings/profile/profile.js');
const finance = source('core/finance/finance.js');
const journal = source('journal/journal.js');
const settings = source('settings/settings.js');
const admin = source('admin/admin.js');
const adminAccess = source('server/src/saas-admin/saas-admin.service.ts');
const cleanupMigration = source('server/prisma/migrations/20260930143000_remove_first_run_runtime/migration.sql');
const recovery = source('server/scripts/recover-failed-prelaunch-migration.mjs');
const dockerfile = source('Dockerfile');

assert.match(core, /activateBookDemo\(\)/);

assert.match(access, /const DEMO_DAYS = 14/);
assert.match(access, /async activateDemo\(/);
assert.match(access, /source: 'APP_OPENED'/);
assert.match(access, /async requestLive\(/);
assert.match(access, /eventType: 'LIVE_REQUESTED'/);

assert.match(accessController, /@Post\('demo\/activate'\)/);
assert.match(accessController, /@Post\('requests\/live'\)/);

assert.match(coreAccess, /requestLiveMode/);
assert.match(coreAccess, /\/saas-access\/requests\/live/);

assert.match(registrationDocuments, /requiredForRegistration/);
assert.match(registrationDocuments, /marketing-consent/);
assert.match(registrationDocuments, /Необходимо подтвердить документ/);

assert.match(invitation, /RegistrationDocumentService/);
assert.match(invitation, /registrationDocuments\.validate/);
assert.match(invitation, /PlatformConsentEvent/);

assert.match(profile, /DEMO · осталось/);
assert.match(profile, /Запросить LIVE/);
assert.match(profile, /requestLiveMode/);

assert.match(invitation, /TOOL_CAPABILITY_KEYS/);
for (const key of [
  'workplaces.access',
  'timetable.access',
  'people.access',
  'finance.cash.access',
  'finance.dds.access',
  'finance.income_expense.access',
  'finance.articles.access',
  'finance.special.access',
  'finance.investment.self.access',
  'finance.investment.raise.access',
  'finance.investment.external.access',
  'finance.z_report.access',
  'journal.day.access',
  'journal.month.access',
  'journal.list.access',
  'services.access',
  'online_booking.access',
  'notifications.access',
  'integrations.access',
  'documents.access',
  'tags.access',
]) assert.match(invitation, new RegExp(key.replaceAll('.', '\\.')));

assert.match(invitation, /Перед формированием ссылки выберите хотя бы один инструмент/);
assert.match(invitation, /tenantCapabilityOverride\.create/);
assert.match(access, /this\.demoActive\(access\)[\s\S]*override\.enabled/);
assert.match(adminAccess, /key: \{ in: \[\.\.\.TOOL_CAPABILITY_KEYS\] \}/);

assert.match(finance, /finance\.cash\.access/);
assert.match(finance, /finance\.investment\.self\.access/);
assert.match(finance, /finance\.investment\.raise\.access/);
assert.match(finance, /finance\.investment\.external\.access/);
assert.match(finance, /finance\.z_report\.access/);
assert.match(journal, /journal\.day\.access/);
assert.match(journal, /journal\.list\.access/);
assert.match(settings, /services\.access/);
assert.match(settings, /online_booking\.access/);
assert.match(profile, /workplaces\.access/);

assert.match(core, /section === 'finance' \|\| section === 'settings'/);
assert.match(core, /journalView: 'day'/);
assert.doesNotMatch(core, /secondary\.journal/);
assert.match(core, /children\.length === 1 \? children\[0\]\.label : definition\.label/);
assert.match(core, /children\.length > 1 \? children\.length : 0/);
assert.match(core, /childItems\.length > 1 \? v2CardDeck/);
assert.match(core, /secondaryItems\(id\)\.length > 1/);

assert.match(admin, /Инструменты DEMO/);
assert.match(admin, /selectedInvitationTools/);
assert.match(admin, /JSON\.stringify\(\{ tools \}\)/);

assert.doesNotMatch(cleanupMigration, /DELETE FROM "PlatformActivityEvent"/);
assert.match(recovery, /firstRunCleanupMigration/);
assert.match(recovery, /return 43/);
assert.match(dockerfile, /migrate resolve --rolled-back 20260930143000_remove_first_run_runtime/);

console.log('Direct DEMO entry, assigned-tool and migration recovery contract: OK');

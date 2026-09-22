import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const schema = source('server/prisma/schema.prisma');
const migration = source('server/prisma/migrations/20260921190000_first_run_scenario/migration.sql');
const ownerSeed = source('server/prisma/seed-owner.ts');
const invitation = source('server/src/tenant-invitation/tenant-invitation.service.ts');
const firstRun = source('server/src/first-run/first-run.service.ts');
const access = source('server/src/saas-access/saas-access.service.ts');
const runtime = source('first-run/runtime.js');
const core = source('core.js');
const indexHtml = source('index.html');
const booking = source('server/src/online-booking/online-booking.service.ts');
const dispatch = source('server/src/communication/communication-dispatch.service.ts');
const people = source('main/people/people.js');
const admin = source('admin/admin.js');
const saasAdminService = source('server/src/saas-admin/saas-admin.service.ts');
const notices = source('server/src/platform-notice/platform-notice.service.ts');
const platformNoticesUi = source('core/platform-notices.js');
const documentArchive = source('server/src/tenant-document-archive/tenant-document-archive.service.ts');
const firstRunModule = source('server/src/first-run/first-run.module.ts');
const firstRunApi = source('first-run/api.js');
const documentData = source('settings/documents/data.js');
const documentUi = source('settings/documents/documents.js');
const tenantDocumentArchiveUi = source('tenant-document-archive.js');

assert.match(schema, /model FirstRunScenario\s*\{/);
assert.match(schema, /model FirstRunScenarioVersion\s*\{/);
assert.match(schema, /model FirstRunProgress\s*\{/);
assert.match(schema, /model FirstRunStepProgress\s*\{/);
assert.match(schema, /model PlatformActivityEvent\s*\{/);
assert.match(schema, /model PlatformSession\s*\{/);
assert.match(schema, /model PlatformNotice\s*\{/);
assert.match(schema, /commercialMode\s+String\s+@default\("LIVE"\)/);
assert.match(schema, /demoActivatedAt\s+DateTime\?/);
assert.match(schema, /demoExpiresAt\s+DateTime\?/);

assert.match(firstRun, /const DEMO_DAYS = 14/);
assert.match(firstRun, /firstRunScenarioVersionId/);
assert.match(schema, /model FirstRunProgress[\s\S]*?status\s+String\s+@default\("IN_PROGRESS"\)/);
assert.match(firstRun, /assertRealOperationsAllowed/);
assert.match(firstRun, /if \(access\.commercialMode !== 'LIVE'\)/);
assert.doesNotMatch(firstRun, /commercialMode !== 'LIVE' \|\| progress/);
assert.match(firstRun, /cleanupDemoOperationalData/);
assert.match(firstRun, /person\.deleteMany/);
assert.match(firstRun, /record\.deleteMany/);
assert.match(firstRun, /financeOperation\.deleteMany/);
assert.doesNotMatch(firstRun, /profile\.deleteMany/);
assert.doesNotMatch(firstRun, /businessOperationalState\.deleteMany/);

assert.match(invitation, /activateInvitation\(invitation\.id, invitation\.tenantId\)/);
assert.match(invitation, /validateRegistrationDocuments\(input\?\.documents\)/);
assert.match(invitation, /PlatformConsentEvent/);
assert.match(invitation, /assignFromInvitation/);
assert.match(invitation, /commercialMode: 'DEMO'/);

assert.match(access, /source: 'DEMO'/);
assert.match(access, /return \{ key, valueType, enabled: true, limit: null, source: 'DEMO' \}/);
assert.match(access, /return \{ key, valueType, enabled: null, limit: null, source: 'DEMO' \}/);
assert.match(access, /source: 'DEMO_EXPIRED'/);
assert.match(access, /source: 'OWNER'/);
assert.doesNotMatch(access, /source: 'FIRST_RUN'/);
assert.doesNotMatch(access, /firstRunActive/);
assert.match(access, /source: 'TENANT_OVERRIDE'/);
assert.match(access, /source: 'PLAN'/);
assert.match(access, /source: 'DEFAULT'/);
assert.doesNotMatch(access, /LEGACY_COMPAT/);
assert.doesNotMatch(access, /legacyCompatibilityValue/);

assert.match(runtime, /markFirstRunStepSeen/);
assert.match(runtime, /completeFirstRunStep/);
assert.match(runtime, /flushBusinessPersistence/);
assert.match(runtime, /first-run-pulse/);
assert.match(runtime, /online-booking-welcome/);
assert.match(runtime, /finance-dds/);
assert.match(firstRun, /documentArchive\.saveRknGuide/);
assert.match(firstRun, /documentArchive\.rknGuideDocument/);
assert.match(documentArchive, /RKN_GUIDE_PDF/);
assert.match(documentArchive, /snapshotHash/);
assert.match(documentArchive, /current\.documents\.push\(document\)/);
assert.match(firstRunModule, /TenantDocumentArchiveModule/);
assert.match(firstRunApi, /documentId=.*encodeURIComponent/);
assert.match(documentData, /attachment:/);
assert.match(documentData, /savedGuides/);
assert.match(documentUi, /Инструкции/);
assert.match(documentUi, /data-rkn-guide-download/);
assert.match(documentUi, /Сформировать актуальную инструкцию/);
assert.match(documentUi, /refreshTenantDocumentArchive/);
assert.match(tenantDocumentArchiveUi, /refreshTenantDocumentArchive/);
assert.match(core, /FirstRunRuntime/);
assert.match(core, /renderDemoExpired/);
assert.doesNotMatch(core, /onboarding\/onboarding\.js/);
assert.doesNotMatch(core, /renderOnboarding/);
assert.doesNotMatch(core, /isOnboardingComplete/);
assert.doesNotMatch(indexHtml, /ui\/onboarding\/onboarding\.css/);

assert.match(booking, /assertRealOperationsAllowed\(tenantId\)/);
assert.match(dispatch, /assertRealOperationsAllowed\(tenantId\)/);
assert.match(people, /canUseRealPersonalData/);

assert.match(admin, /Первое знакомство/);
assert.match(admin, /Продлить DEMO на 14 дней/);
assert.match(admin, /data-capability-order-list/);
assert.match(saasAdminService, /CAPABILITY_CHANGED/);
assert.match(notices, /createForTenantOwner/);
assert.match(platformNoticesUi, /platform-notices/);
assert.match(core, /startPlatformNotices/);

const order = [
  'profile',
  'procedures',
  'products',
  'online-booking',
  'documents',
  'people',
  'timetable',
  'journal-record',
  'payment',
  'journal-month',
  'journal-list',
  'chat',
  'finance-overview',
  'complete',
];
let last = -1;
for (const key of order) {
  const index = migration.indexOf(`'${key}'`);
  assert.ok(index > last, `first-run order must keep ${key} after the previous milestone`);
  last = index;
}

assert.match(migration, /'documents',80,'REQUIRED_INFO'/);
assert.match(migration, /'people',90,'REQUIRED_ACTION'/);
assert.match(migration, /'payment',120,'REQUIRED_ACTION'/);
assert.match(migration, /'journal-month',130,'OPTIONAL_INFO'/);
assert.match(migration, /'chat',150,'OPTIONAL_INFO'/);

console.log('first-run architecture tests: OK');

assert.match(firstRun, /Состояние рабочего пространства не настроено/);
assert.doesNotMatch(firstRun, /if \(!access\)[\s\S]{0,400}return true/);

assert.match(ownerSeed, /tenantAccess\.upsert/);
assert.match(ownerSeed, /isOwnerBook:\s*true/);
assert.match(ownerSeed, /commercialMode:\s*'LIVE'/);

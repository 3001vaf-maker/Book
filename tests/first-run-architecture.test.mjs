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
const noticeController = source('server/src/platform-notice/platform-notice.controller.ts');
const platformPushMigration = source('server/prisma/migrations/20260922173000_platform_push_subscription/migration.sql');
const demoTimingMigration = source('server/prisma/migrations/20260922213000_demo_starts_at_profile_open/migration.sql');
const mainServer = source('server/src/main.ts');
const platformNoticesUi = source('core/platform-notices.js');
const documentArchive = source('server/src/tenant-document-archive/tenant-document-archive.service.ts');
const firstRunModule = source('server/src/first-run/first-run.module.ts');
const firstRunController = source('server/src/first-run/first-run.controller.ts');
const firstRunApi = source('first-run/api.js');
const rknGuideService = source('server/src/tenant-document-archive/rkn-guide.service.ts');
const tenantDocumentArchiveController = source('server/src/tenant-document-archive/tenant-document-archive.controller.ts');
const tenantDocumentArchiveModule = source('server/src/tenant-document-archive/tenant-document-archive.module.ts');
const documentData = source('settings/documents/data.js');
const documentUi = source('settings/documents/documents.js');
const tenantDocumentArchiveUi = source('tenant-document-archive.js');
const documentCatalog = source('admin/document-registry/catalog.js');
const rknTemplateMigration = source('server/prisma/migrations/20260923011500_seed_rkn_guide_template/migration.sql');

assert.match(schema, /model FirstRunScenario\s*\{/);
assert.match(schema, /model FirstRunScenarioVersion\s*\{/);
assert.match(schema, /model FirstRunProgress\s*\{/);
assert.match(schema, /model FirstRunStepProgress\s*\{/);
assert.match(schema, /model PlatformActivityEvent\s*\{/);
assert.match(schema, /model PlatformSession\s*\{/);
assert.match(schema, /model PlatformNotice\s*\{/);
assert.match(schema, /commercialMode\s+String\s+@default\("DEMO"\)/);
assert.match(schema, /demoActivatedAt\s+DateTime\?/);
assert.match(schema, /demoExpiresAt\s+DateTime\?/);
assert.match(schema, /liveRequestedAt\s+DateTime\?/);
assert.match(schema, /liveRequestedByPlatformAccountId\s+String\?/);
assert.match(schema, /liveApprovedAt\s+DateTime\?/);
assert.match(schema, /liveApprovedByAdminId\s+String\?/);

assert.match(firstRun, /const DEMO_DAYS = 14/);
assert.match(firstRun, /activateDemoAtProfileOpen/);
assert.match(firstRun, /step\.key === 'profile'/);
assert.match(firstRun, /eventType: 'DEMO_ACTIVATED'/);
assert.match(firstRun, /source: 'PROFILE_OPENED'/);
assert.match(firstRun, /acceptedInvitation/);
assert.match(firstRun, /firstRunScenarioVersionId/);
assert.match(schema, /model FirstRunProgress[\s\S]*?status\s+String\s+@default\("IN_PROGRESS"\)/);
assert.match(firstRun, /assertRealOperationsAllowed/);
assert.match(firstRun, /if \(access\.commercialMode !== 'LIVE'\)/);
assert.match(firstRun, /!access\.isOwnerBook && !access\.liveApprovedAt/);
assert.match(firstRun, /LIVE_APPROVED_BY_ADMIN/);
assert.match(firstRun, /liveApprovedByAdminId/);
assert.match(firstRun, /eventType: 'LIVE_REQUESTED'/);
assert.match(firstRun, /liveRequestedAt/);
assert.match(firstRun, /liveRequestedByPlatformAccountId/);
assert.doesNotMatch(firstRun, /Пользователь ещё не запросил переход в LIVE/);
assert.match(firstRun, /Запрос LIVE доступен после завершения знакомства с приложением/);
assert.doesNotMatch(firstRun, /Запрос LIVE доступен после окончания 14 дней DEMO/);
assert.doesNotMatch(firstRun, /LIVE можно подтвердить после окончания DEMO/);
assert.match(runtime, /requestLiveMode/);
assert.match(runtime, /Запросить LIVE/);
assert.match(runtime, /progress\?\.status === 'COMPLETED'/);
assert.doesNotMatch(firstRun, /commercialMode !== 'LIVE' \|\| progress/);
assert.match(firstRun, /cleanupDemoOperationalData/);
assert.match(firstRun, /if \(mode === 'LIVE'\)[\s\S]{0,500}status: 'COMPLETED'[\s\S]{0,500}cleanupDemoOperationalData/);
assert.doesNotMatch(firstRun, /if \(final\)[\s\S]{0,500}cleanupDemoOperationalData/);
assert.match(firstRun, /person\.deleteMany/);
assert.match(firstRun, /record\.deleteMany/);
assert.match(firstRun, /financeOperation\.deleteMany/);
assert.doesNotMatch(firstRun, /profile\.deleteMany/);
assert.doesNotMatch(firstRun, /businessOperationalState\.deleteMany/);

assert.doesNotMatch(invitation, /activateInvitation\(/);
assert.match(invitation, /validateRegistrationDocuments\(input\?\.documents\)/);
assert.match(invitation, /PlatformConsentEvent/);
assert.match(invitation, /prepareInvitationAssignment/);
assert.match(invitation, /assignPreparedFromInvitation/);
assert.match(invitation, /tx\.profile\.create/);
assert.match(invitation, /commercialMode: 'DEMO'/);
assert.match(invitation, /activatedAt: ''/);
assert.match(invitation, /expiresAt: ''/);

assert.match(access, /source: 'DEMO'/);
assert.match(access, /!access\.demoExpiresAt \|\| access\.demoExpiresAt\.getTime\(\) > Date\.now\(\)/);
assert.match(access, /return \{ key, valueType, enabled: true, limit: null, source: 'DEMO' \}/);
assert.match(access, /return \{ key, valueType, enabled: null, limit: null, source: 'DEMO' \}/);
assert.match(access, /source: 'DEMO_EXPIRED'/);
assert.match(access, /source: 'OWNER'/);
assert.doesNotMatch(access, /source: 'FIRST_RUN'/);
assert.doesNotMatch(access, /firstRunActive/);
assert.match(access, /source: 'TENANT_OVERRIDE'/);
assert.match(access, /source: 'PLAN'/);
assert.match(access, /source: 'DEFAULT'/);
assert.match(access, /liveUnapproved/);
assert.match(access, /liveApprovedAt/);
assert.doesNotMatch(access, /LEGACY_COMPAT/);
assert.doesNotMatch(access, /legacyCompatibilityValue/);

assert.match(runtime, /markFirstRunStepSeen/);
assert.match(runtime, /completeFirstRunStep/);
assert.match(runtime, /flushBusinessPersistence/);
assert.match(runtime, /mutateAppWithoutObserver/);
assert.match(runtime, /observer\?\.disconnect\(\)/);
assert.match(runtime, /observer\.observe\(this\.app, \{ childList: true, subtree: true \}\)/);
assert.match(runtime, /first-run-pulse/);
assert.match(runtime, /online-booking-welcome/);
assert.match(runtime, /finance-dds/);
assert.doesNotMatch(firstRun, /RKN_GUIDE_PDF|rknGuide|PDFDocument|TenantDocumentArchiveService/);
assert.doesNotMatch(firstRunController, /rkn-guide|StreamableFile/);
assert.doesNotMatch(firstRunModule, /TenantDocumentArchiveModule/);
assert.doesNotMatch(firstRunApi, /rkn-guide|ensureRknGuide|downloadRknGuide/);
assert.match(rknGuideService, /documentArchive\.saveRknGuide/);
assert.match(rknGuideService, /documentArchive\.rknGuideDocument/);
assert.match(documentArchive, /RKN_GUIDE_PDF/);
assert.match(documentArchive, /sourceHash/);
assert.match(documentArchive, /pdfBase64/);
assert.match(documentArchive, /PRE_REGISTRY_TEMPLATE/);
assert.match(documentArchive, /current\.documents\.push\(document\)/);
assert.doesNotMatch(documentArchive, /canonicalGuides\.length \+ 1/);
assert.doesNotMatch(rknGuideService, /canonicalGuides\.length \+ 1/);
assert.match(documentArchive, /Math\.max\(maxVersion, Number\(item\?\.version \|\| 0\)\)/);
assert.match(rknGuideService, /Math\.max\(maxVersion, Number\(objectValue\(item\)\.version \|\| 0\)\)/);
assert.match(tenantDocumentArchiveModule, /RknGuideService/);
assert.match(tenantDocumentArchiveController, /rkn-guide\/ensure/);
assert.match(tenantDocumentArchiveController, /rkn-guide\.pdf/);
assert.match(tenantDocumentArchiveUi, /documentId=.*encodeURIComponent/);
assert.match(documentData, /attachment:/);
assert.match(documentData, /savedGuides/);
assert.match(documentUi, /Инструкции/);
assert.match(documentUi, /data-rkn-guide-download/);
assert.doesNotMatch(documentUi, /Сформировать актуальную инструкцию/);
assert.match(documentUi, /автоматически из актуального шаблона Реестра/);
assert.match(tenantDocumentArchiveUi, /refreshTenantDocumentArchive/);

assert.match(documentCatalog, /rkn-notification-guide-template/);
assert.match(documentCatalog, /RKN_GUIDE_TEMPLATE/);
assert.match(documentCatalog, /Что видите в форме/);
assert.match(documentCatalog, /Что делать/);
assert.match(documentCatalog, /ВАЖНО ОБ ОТВЕТСТВЕННОСТИ/);
assert.match(documentCatalog, /\[\[PROFESSION\]\]/);
assert.match(documentCatalog, /\[\[UPDATE_SECTION\]\]/);
assert.doesNotMatch(documentCatalog, /\[\[WORKPLACES\]\]/);
assert.doesNotMatch(rknGuideService, /WORKPLACES|workplaces/);
assert.match(rknGuideService, /Версия \$\{personalVersion\} — инструкция по проверке и изменению ранее поданных сведений/);
assert.match(rknGuideService, /Старая версия инструкции остаётся в Документах и не перезаписывается/);
assert.match(rknTemplateMigration, /rkn-notification-guide-template/);
assert.match(rknTemplateMigration, /PlatformDocumentVersion/);
assert.match(rknGuideService, /private async template/);
assert.match(rknGuideService, /async ensure/);
assert.match(rknGuideService, /\/usr\/share\/fonts\/dejavu\/DejaVuSans\.ttf/);
assert.doesNotMatch(rknGuideService, /\/usr\/share\/fonts\/ttf-dejavu\/DejaVuSans\.ttf/);
assert.match(runtime, /modalSeenKey/);
assert.doesNotMatch(runtime, /data-first-run-rkn-guide/);
assert.doesNotMatch(runtime, /ensureRknGuide|rkn-guide|tenant-document-archive/);
assert.match(core, /syncRknGuideIfReady/);
assert.doesNotMatch(core, /book:workplaces-changed/);
assert.match(core, /book:server-mutation-completed/);
assert.match(core, /FirstRunRuntime/);
assert.match(core, /renderDemoExpired/);
assert.match(core, /renderFirstRunUnavailable/);
assert.doesNotMatch(core, /catch \{\s*firstRunState = null;\s*\}/);
assert.doesNotMatch(core, /onboarding\/onboarding\.js/);
assert.doesNotMatch(core, /renderOnboarding/);
assert.doesNotMatch(core, /isOnboardingComplete/);
assert.doesNotMatch(indexHtml, /ui\/onboarding\/onboarding\.css/);

assert.match(booking, /assertRealOperationsAllowed\(tenantId\)/);
assert.match(dispatch, /assertRealOperationsAllowed\(tenantId\)/);
assert.match(people, /canUseRealPersonalData/);

assert.match(admin, /Первое знакомство/);
assert.match(admin, /Продлить DEMO на 14 дней/);
assert.match(admin, /liveRequestedAt/);
assert.match(admin, /Перевести в LIVE/);
assert.match(admin, /Запросы LIVE/);
assert.match(admin, /data-live-request-count/);
assert.match(admin, /data-grant-live/);
assert.match(admin, /Запроса нет — администратор всё равно может включить LIVE/);
assert.match(admin, /LIVE_REQUESTED/);
assert.match(admin, /LIVE_APPROVED_BY_ADMIN/);
assert.match(admin, /data-capability-order-list/);
assert.match(saasAdminService, /CAPABILITY_CHANGED/);
assert.match(notices, /createForTenantOwner/);
assert.match(notices, /createForPlatformAdmins/);
assert.match(notices, /PlatformPushSubscription/);
assert.match(notices, /webpush\.sendNotification/);
assert.match(noticeController, /push\/subscription/);
assert.match(platformPushMigration, /CREATE TABLE IF NOT EXISTS "PlatformPushSubscription"/);
assert.match(demoTimingMigration, /STEP_MODAL_SHOWN/);
assert.match(demoTimingMigration, /"stepKey" = 'profile'/);
assert.match(demoTimingMigration, /"demoActivatedAt" = NULL/);
assert.match(demoTimingMigration, /INTERVAL '14 days'/);
assert.match(mainServer, /service-worker\.js/);
assert.match(firstRunModule, /PlatformNoticeModule/);
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
assert.doesNotMatch(firstRun, /if \(!access\)\s*return true/);

assert.match(ownerSeed, /tenantAccess\.upsert/);
assert.match(ownerSeed, /isOwnerBook:\s*true/);
assert.match(ownerSeed, /commercialMode:\s*'LIVE'/);

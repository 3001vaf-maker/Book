import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const core = readFileSync('core.js', 'utf8');
const registration = readFileSync('core/registration-flow.js', 'utf8');
const tenantController = readFileSync('server/src/legal-runtime/tenant-legal.controller.ts', 'utf8');
const legalService = readFileSync('server/src/legal-runtime/legal-runtime.service.ts', 'utf8');
const documentData = readFileSync('settings/documents/data.js', 'utf8');
const bookingService = readFileSync('server/src/online-booking/online-booking.service.ts', 'utf8');
const notificationService = readFileSync('server/src/notification/notification.service.ts', 'utf8');
const legalNotificationService = readFileSync('server/src/notification/legal-notification.service.ts', 'utf8');
const broadcastService = readFileSync('server/src/communication/communication-broadcast.service.ts', 'utf8');
const dispatchService = readFileSync('server/src/communication/communication-dispatch.service.ts', 'utf8');
const marketingConsentService = readFileSync('server/src/legal-runtime/marketing-consent.service.ts', 'utf8');
const telegramBotService = readFileSync('server/src/communication/telegram-bot.service.ts', 'utf8');
const bookingController = readFileSync('server/src/online-booking/online-booking.controller.ts', 'utf8');
const profileMigration = readFileSync('settings/profile/migration.js', 'utf8');
const businessMigration = readFileSync('business-migration.js', 'utf8');
const operationalMigration = readFileSync('operational-migration.js', 'utf8');
const documentMigration = readFileSync('document-migration.js', 'utf8');
const auxiliaryMigration = readFileSync('auxiliary-migration.js', 'utf8');
const profileService = readFileSync('server/src/profile/profile.service.ts', 'utf8');
const businessStateService = readFileSync('server/src/business-state/business-state.service.ts', 'utf8');
const documentStateService = readFileSync('server/src/document-state/document-state.service.ts', 'utf8');
const auxiliaryStateService = readFileSync('server/src/auxiliary-state/auxiliary-state.service.ts', 'utf8');
const saasAdminService = readFileSync('server/src/saas-admin/saas-admin.service.ts', 'utf8');
const adminUi = readFileSync('admin/admin.js', 'utf8');
const manualInvitationService = readFileSync('server/src/manual-invitation/manual-invitation.service.ts', 'utf8');
const masterInvitationService = readFileSync('server/src/master-invitation/master-invitation.service.ts', 'utf8');

assert.match(registration, /Добро пожаловать в Book/);
assert.match(registration, /Условия работы с Book/);
assert.match(registration, /<h1>Регистрация<\/h1>/);
assert.match(registration, /Документы ваших клиентов будут сформированы отдельно после настройки профиля в DEMO/);
assert.match(registration, /После входа они уже будут в профиле/);
assert.match(registration, /name="name"/);
assert.match(registration, /name="surname"/);
assert.match(registration, /name="phone"/);
assert.match(registration, /name="email"/);
assert.doesNotMatch(registration, /repair-profile/);
assert.match(manualInvitationService, /tx\.profile\.create/);
assert.match(masterInvitationService, /tx\.profile\.create/);
assert.match(manualInvitationService, /profession: ''/);
assert.match(masterInvitationService, /profession: ''/);

assert.match(core, /data-demo-banner/);
assert.match(core, /Я уже могу работать с персональными данными/);
assert.match(core, /Мне нужна помощь/);
assert.match(core, /CONTINUE_WITHOUT_CONFIRMATION/);
assert.match(core, /Этап 1 — Профиль/);
assert.match(core, /Этап 2 — Работа/);
assert.match(core, /function profileIdentityReady\(\)/);
assert.match(core, /setupRow\('Профиль', profileIdentityReady\(\), 'profile'/);
assert.match(core, /setupRow\('Рабочее место', getWorkplaceEntities\(\)\.length > 0, 'profile'\)/);
assert.match(core, /Этап 3 — Возможности Book/);
assert.match(core, /Помощник ведёт по этапам, но ничего не блокирует/);
assert.match(core, /data-demo-go-live/);
const demoHubBlock = core.slice(core.indexOf('function openDemoHub()'), core.indexOf('function openLiveChoice()'));
assert.match(demoHubBlock, /button\('Перейти к LIVE', \{ data: 'data-demo-go-live' \}\)/);
assert.doesNotMatch(demoHubBlock, /disabled\s*:|if\s*\(\s*!profileSetupReady\(\)\s*\)/);
assert.match(core, /canUseBookCapability\('services\.access'\)/);
assert.match(core, /canUseBookCapability\('timetable\.access'\)/);
assert.match(core, /canUseBookCapability\('online_booking\.access'\)/);

assert.match(core, /Печать \/ сохранить как PDF/);
assert.doesNotMatch(core, /renderMasterLegalSetup|data-legal-identity|operatorIdentityConfigured/);
assert.doesNotMatch(core, /renderOnboarding|isOnboardingComplete/);

assert.doesNotMatch(tenantController, /filing\/submitted|filing\/prepared|@Post\('documents'\)|@Put\('checklist'\)/);
assert.match(tenantController, /activateTenantLive\(auth\.tenantId, auth\.userId, body/);

const liveBlock = legalService.slice(legalService.indexOf('async activateTenantLive'), legalService.indexOf('async returnTenantToDemo'));
assert.match(liveBlock, /READY/);
assert.match(liveBlock, /GUIDED_SUBMITTED/);
assert.match(liveBlock, /CONTINUE_WITHOUT_CONFIRMATION/);
assert.match(liveBlock, /responsibilityAcknowledged/);
assert.doesNotMatch(liveBlock, /canBecomeLive|missingLiveDocuments|TENANT_CHECKLIST_KEYS/);

const tenantLiveBlock = legalService.slice(legalService.indexOf('async assertTenantLive'), legalService.indexOf('async assertRealClientMutation'));
assert.match(tenantLiveBlock, /access\.isOwnerBook/);
assert.match(tenantLiveBlock, /operationMode: 'LIVE'/);
assert.ok(
  tenantLiveBlock.indexOf('access.isOwnerBook') < tenantLiveBlock.indexOf('tenantState(tenantId)'),
  'platform owner workspace must not depend on tenant DEMO/LIVE state',
);

assert.match(documentData, /function bookContextReady/);
assert.match(documentData, /if \(!bookContextReady\(\)\) return \[\]/);
assert.match(documentData, /book-auto-refresh/);
assert.match(documentData, /documentsState = \(Array\.isArray\(items\) \? items : \[\]\)/);

assert.match(bookingService, /documentState\.publicDocuments\(tenantId\)/);
assert.match(bookingService, /requiredClientDocuments/);
assert.match(legalService, /businessDocumentState\.findUnique/);
assert.match(legalService, /documentId" = 'messages-consent'/);

assert.doesNotMatch(notificationService, /canSendMessages|ConsentPolicyService/);
assert.match(legalNotificationService, /purpose: 'SERVICE'/);
assert.match(legalNotificationService, /approved-notification-template:/);
assert.match(broadcastService, /canSendMessages/);
assert.match(dispatchService, /const purpose = .*\|\| 'MARKETING'/);
assert.match(legalService, /purpose === 'MARKETING'/);
assert.match(legalService, /hasCurrentMarketingConsent/);
assert.match(marketingConsentService, /documentId" = 'messages-consent'/);
assert.doesNotMatch(marketingConsentService, /'marketing-consent'/);
assert.match(bookingController, /telegram-channel/);
assert.doesNotMatch(bookingController, /messages-consent|acceptContactPointConsent|revokeContactPointConsent/);
assert.match(telegramBotService, /purpose: 'DIALOG'/);
assert.doesNotMatch(telegramBotService, /canSendMessages\(tenantId/);

assert.doesNotMatch(core, /localStorage|sessionStorage/);
assert.doesNotMatch(core, /Серверное состояние Book не подтверждено/);
assert.match(core, /Book временно не загрузился/);
assert.match(core, /data-retry-server-state/);

for (const source of [profileMigration, businessMigration, operationalMigration, documentMigration, auxiliaryMigration]) {
  assert.doesNotMatch(source, /server-unverified/);
  assert.match(source, /server-reverified/);
}
assert.match(profileService, /else if \(!existing\.migrationVerifiedAt\)/);
assert.match(businessStateService, /else if \(!existing\.migrationVerifiedAt\)/);
assert.match(documentStateService, /else if \(!existing\.migrationVerifiedAt\)/);
assert.match(auxiliaryStateService, /else if \(!existing\.migrationVerifiedAt\)/);
assert.match(saasAdminService, /FROM "LegalAcceptanceEvent" e/);
assert.match(saasAdminService, /documentKey/);
assert.match(saasAdminService, /documentVersion/);
assert.match(saasAdminService, /occurredAt/);
assert.match(adminUi, /Соглашения при регистрации/);
assert.match(adminUi, /masterLegalAcceptanceHtml/);
assert.match(adminUi, /версия/);
assert.match(adminUi, /Согласие дано/);
assert.doesNotMatch(registration, /localStorage|sessionStorage/);

console.log('unified DEMO to LIVE journey tests: OK');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const core = readFileSync('core.js', 'utf8');
const registration = readFileSync('registration/registration-flow.js', 'utf8');
const tenantController = readFileSync('server/src/legal-runtime/tenant-legal.controller.ts', 'utf8');
const legalService = readFileSync('server/src/legal-runtime/legal-runtime.service.ts', 'utf8');
const documentData = readFileSync('settings/documents/data.js', 'utf8');
const bookingService = readFileSync('server/src/online-booking/online-booking.service.ts', 'utf8');

assert.match(registration, /Добро пожаловать в Book/);
assert.match(registration, /Условия работы с Book/);
assert.match(registration, /<h1>Регистрация<\/h1>/);
assert.match(registration, /Документы ваших клиентов будут сформированы отдельно после настройки вашего профиля/);

assert.match(core, /data-demo-banner/);
assert.match(core, /Я уже могу работать с персональными данными/);
assert.match(core, /Мне нужна помощь/);
assert.match(core, /CONTINUE_WITHOUT_CONFIRMATION/);
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

assert.match(documentData, /function bookContextReady/);
assert.match(documentData, /if \(!bookContextReady\(\)\) return \[\]/);
assert.match(documentData, /book-auto-refresh/);
assert.match(documentData, /documentsState = \(Array\.isArray\(items\) \? items : \[\]\)/);

assert.match(bookingService, /documentState\.publicDocuments\(tenantId\)/);
assert.match(bookingService, /requiredClientDocuments/);
assert.match(legalService, /businessDocumentState\.findUnique/);
assert.match(legalService, /documentId" = 'messages-consent'/);

console.log('unified DEMO to LIVE journey tests: OK');

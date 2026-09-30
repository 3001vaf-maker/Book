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

console.log('Direct DEMO entry contract: OK');

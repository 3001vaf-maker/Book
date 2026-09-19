import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const policy = read('server/src/document-state/consent-policy.service.ts');
const controller = read('server/src/online-booking/booking-consent.controller.ts');
const guard = read('server/src/online-booking/booking-pdn-consent.guard.ts');
const service = read('server/src/online-booking/online-booking.service.ts');
const booking = read('online-booking/booking.js');

assert.match(policy, /async accountConsentState\(/);
assert.match(policy, /return \{ pdnActive: Boolean\(pdn\?\.accepted\), consents \}/);
assert.match(policy, /async hasActivePdnConsent[\s\S]*accountConsentState\(tenantId, accountIdValue\)[\s\S]*\.pdnActive/);
assert.doesNotMatch(policy, /async requiredConsentState\(/);

assert.match(controller, /accountConsentState\(auth\.tenantId, auth\.accountId\)/);
assert.doesNotMatch(controller, /requiredConsentState/);

assert.match(guard, /const state = await this\.consentPolicy\.accountConsentState\(auth\.tenantId, auth\.accountId\)/);
assert.match(guard, /if \(!state\.pdnActive\)/);
assert.doesNotMatch(guard, /requiredConsentState/);
assert.doesNotMatch(guard, /bookingConsentAccess/);
assert.doesNotMatch(guard, /Promise\.all/);

assert.match(service, /private ensurePdnConsent\(/);
assert.match(service, /text\(item\?\.id\) === 'pdn-consent'/);
assert.match(service, /item\.documentId === 'pdn-consent'/);
assert.match(service, /this\.ensurePdnConsent\(\{ documents \}, consents\)/);
assert.doesNotMatch(service, /ensureRequiredConsents/);

assert.match(booking, /consentState\.pdnActive/);
assert.doesNotMatch(booking, /consentState\.allowed/);

console.log('PDN consent state cleanup tests: OK');

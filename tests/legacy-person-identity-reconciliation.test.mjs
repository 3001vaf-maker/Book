import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service = await readFile(new URL('../server/src/online-booking/person-identity.service.ts', import.meta.url), 'utf8');
const onlineBooking = await readFile(new URL('../server/src/online-booking/online-booking.service.ts', import.meta.url), 'utf8');
const controller = await readFile(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const sync = await readFile(new URL('../online-booking/server-sync.js', import.meta.url), 'utf8');

assert.match(service, /reconcileLegacyAccountDuplicates\(tenantId: string\)/, 'Legacy review service must remain available for historical data inspection');
assert.match(service, /requiresManualReview:\s*candidates > 0/, 'Legacy account-* candidates must be surfaced for explicit profile review');
assert.match(service, /return \{ repaired: 0, candidates, requiresManualReview: candidates > 0 \}/, 'Legacy review must never report an automatic repair');
assert.doesNotMatch(service, /peopleSharePhone\(/, 'Shared phone must not be used as an automatic Person/UEI merge rule');
assert.doesNotMatch(service, /sameNamedPerson\(/, 'Matching names must not be used as an automatic Person/UEI merge rule');
assert.doesNotMatch(service, /identity\.relations\[relationKey\]\s*=\s*uei/, 'Code must not assign a legacy Person to a UEI by inference');
assert.doesNotMatch(service, /await this\.reconcileLegacyAccountDuplicates\(tenantId\)/, 'Account login/access must not run identity reconciliation automatically');

const findOrAttach = service.slice(service.indexOf('async findOrAttachExistingPerson('), service.indexOf('async bindFirstAccess('));
assert.match(findOrAttach, /const card = await this\.cardState\(tenantId, account\.phone\)/, 'Known phone lookup must happen before any new Person is created');
assert.match(findOrAttach, /if \(!card\.owner\) return null/, 'Only an actually unknown phone may fall through to Person creation');
assert.doesNotMatch(findOrAttach, /upsertPersonFromAccount/, 'Known-phone path must never create a new Person');
const bindFirstAccess = service.slice(service.indexOf('async bindFirstAccess('), service.indexOf('async personStats('));
assert.match(bindFirstAccess, /if \(existing\) return existing/, 'Existing known-phone Person must be reused');
assert.match(bindFirstAccess, /upsertPersonFromAccount/, 'Person creation remains available only after existing-Person lookup returns null');

const manualRecords = service.slice(service.indexOf('async manualRecordViews('));
assert.match(manualRecords, /phonesMatch\(client\.phone, account\.phone\)/, 'Profile-created records must remain discoverable by the registered contact phone');
const myRequests = onlineBooking.slice(onlineBooking.indexOf('async getMyRequests('), onlineBooking.indexOf('async ownerAccounts('));
assert.match(myRequests, /manualRecordViews\(tenantId, account as any, importedRecordIds\)/, 'Account history must include profile-created pre-login records');
assert.match(myRequests, /return \[\.\.\.requestViews, \.\.\.manualViews\]/, 'Online and pre-existing profile records must be returned in one account history');

assert.match(controller, /owner\/reconcile-legacy-client-cards/, 'Owner-only legacy review route is retained for compatibility');
assert.match(controller, /@UseGuards\(JwtAuthGuard\)[\s\S]*reconcileLegacyPeople/, 'Legacy review route must require owner authentication');
assert.doesNotMatch(sync, /legacyPeopleReconciled/, 'Book startup must not keep automatic legacy reconciliation state');
assert.doesNotMatch(sync, /\/online-booking\/owner\/reconcile-legacy-client-cards/, 'Book startup must never trigger legacy Person/UEI reconciliation');

console.log('legacy-person-identity-reconciliation.test.mjs: ok');

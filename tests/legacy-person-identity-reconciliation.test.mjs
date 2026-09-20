import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service = await readFile(new URL('../server/src/online-booking/person-identity.service.ts', import.meta.url), 'utf8');
const onlineBooking = await readFile(new URL('../server/src/online-booking/online-booking.service.ts', import.meta.url), 'utf8');
const controller = await readFile(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const sync = await readFile(new URL('../online-booking/server-sync.js', import.meta.url), 'utf8');

assert.match(service, /reconcileLegacyAccountDuplicates\(tenantId: string\)/, 'Legacy review service must remain available for historical data inspection');
assert.match(service, /requiresManualReview:\s*candidates > 0/, 'Legacy account-* candidates must be surfaced for explicit review');
assert.match(service, /return \{ repaired: 0, candidates, requiresManualReview: candidates > 0 \}/, 'Legacy review must never report an automatic repair');
assert.doesNotMatch(service, /peopleSharePhone\(/, 'Shared phone must not be used as an automatic Person/UEI merge rule');
assert.doesNotMatch(service, /sameNamedPerson\(/, 'Matching names must not be used as an automatic Person/UEI merge rule');
assert.doesNotMatch(service, /identity\.relations\[relationKey\]\s*=\s*uei/, 'Code must not assign a legacy Person to a UEI by inference');
assert.doesNotMatch(service, /await this\.reconcileLegacyAccountDuplicates\(tenantId\)/, 'Account login/access must not run identity reconciliation automatically');

const findOrAttach = service.slice(service.indexOf('async findOrAttachExistingPerson('), service.indexOf('async bindFirstAccess('));
assert.match(findOrAttach, /const personState = await this\.personState\(tenantId, account\.phone\)/, 'Known phone lookup must happen before any new Person is created');
assert.match(findOrAttach, /if \(!personState\.owner\) return null/, 'Only an actually unknown phone may fall through to Person creation');
assert.doesNotMatch(findOrAttach, /upsertPersonFromAccount/, 'Known-phone path must never create a new Person');
const bindFirstAccess = service.slice(service.indexOf('async bindFirstAccess('), service.indexOf('async personStats('));
assert.match(bindFirstAccess, /if \(existing\) return existing/, 'Existing known-phone Person must be reused');
assert.match(bindFirstAccess, /upsertPersonFromAccount/, 'Person creation remains available only after existing-Person lookup returns null');

const myRecords = onlineBooking.slice(onlineBooking.indexOf('async getMyRecords('), onlineBooking.indexOf('async ownerAccounts('));
assert.match(myRecords, /await this\.personIdentity\.bindFirstAccess\(tenantId, account as any\)/, 'Known-phone Account must attach to the existing Person before Record history is read');
assert.match(myRecords, /bookingIdentityForAccount\(tenantId, accountId\)/, 'Account Record history must resolve canonical identity after Person attachment');
assert.match(myRecords, /identity\?\.memberPeople/, 'Account Record history must include all canonical UEI member People');
assert.match(myRecords, /this\.records\.listForPeople\(tenantId, people\)/, 'Pre-existing and online-created Records must be read from the one canonical Record owner');
assert.doesNotMatch(service, /manualRecordViews\(/, 'Legacy Record-to-BookingRequest adapter must remain removed');

assert.match(controller, /owner\/reconcile-legacy-people/, 'Owner-only legacy review route is retained for compatibility');
assert.match(controller, /@UseGuards\(JwtAuthGuard\)[\s\S]*reconcileLegacyPeople/, 'Legacy review route must require owner authentication');
assert.doesNotMatch(sync, /legacyPeopleReconciled/, 'Book startup must not keep automatic legacy reconciliation state');
assert.doesNotMatch(sync, /\/online-booking\/owner\/reconcile-legacy-people/, 'Book startup must never trigger legacy Person/UEI reconciliation');

console.log('legacy-person-identity-reconciliation.test.mjs: ok');

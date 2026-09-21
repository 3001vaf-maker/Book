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
assert.match(findOrAttach, /const contacts = await this\.contactsForAccount\(account\)/, 'Account contact set must be resolved before Person matching');
assert.match(findOrAttach, /const state = await this\.stateForContacts\(tenantId, contacts\)/, 'Tenant Person lookup must use the complete Account contact set');
assert.match(findOrAttach, /const matchedKeys = uniqueStrings\(state\.matches\.map\(\(match\) => match\.person\.key\)\)/, 'All contact matches must be resolved as a group');
assert.match(findOrAttach, /if \(matchedKeys\.length !== 1\)/, 'Conflicting Person matches must not be silently collapsed');
assert.match(findOrAttach, /CONTACT_CONFLICT|createBoundPerson\(tenantId, account, contacts, matchedKeys\)/, 'Conflicting contact matches must use explicit review state');
assert.doesNotMatch(findOrAttach, /personState\(tenantId, account\.phone\)/, 'Phone-only Person matching must remain removed');
assert.doesNotMatch(findOrAttach, /upsertPersonFromAccount/, 'Parallel Account-to-Person creation owner must remain removed');

const bindFirstAccess = service.slice(service.indexOf('async bindFirstAccess('), service.indexOf('async syncLinkedPeople('));
assert.match(bindFirstAccess, /if \(existing\) return existing/, 'A resolved Person binding must be reused');
assert.match(bindFirstAccess, /const contacts = await this\.contactsForAccount\(account\)/, 'New Person creation must use the complete Account contact set');
assert.match(bindFirstAccess, /createBoundPerson\(tenantId, account, contacts\)/, 'New Person creation is allowed only after grouped contact matching returns no existing Person');

const myRecords = onlineBooking.slice(onlineBooking.indexOf('async getMyRecords('), onlineBooking.indexOf('async ownerAccounts('));
assert.match(myRecords, /await this\.personIdentity\.bindFirstAccess\(tenantId, account as any\)/, 'Account must resolve its tenant Person binding before Record history is read');
assert.match(myRecords, /bookingIdentityForAccount\(tenantId, accountId\)/, 'Account Record history must resolve canonical identity after Person attachment');
assert.match(myRecords, /identity\?\.memberPeople/, 'Account Record history must include all canonical UEI member People');
assert.match(myRecords, /this\.records\.listForPeople\(tenantId, people\)/, 'Pre-existing and online-created Records must be read from the one canonical Record owner');
assert.doesNotMatch(service, /manualRecordViews\(/, 'Legacy Record-to-BookingRequest adapter must remain removed');

assert.match(controller, /owner\/reconcile-legacy-people/, 'Owner-only legacy review route is retained for compatibility');
assert.match(controller, /@UseGuards\(JwtAuthGuard\)[\s\S]*reconcileLegacyPeople/, 'Legacy review route must require owner authentication');
assert.doesNotMatch(sync, /legacyPeopleReconciled/, 'Book startup must not keep automatic legacy reconciliation state');
assert.doesNotMatch(sync, /\/online-booking\/owner\/reconcile-legacy-people/, 'Book startup must never trigger legacy Person/UEI reconciliation');

console.log('legacy-person-identity-reconciliation.test.mjs: ok');

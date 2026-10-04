import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service = await readFile(new URL('../server/src/online-booking/person-identity.service.ts', import.meta.url), 'utf8');
const onlineBooking = await readFile(new URL('../server/src/online-booking/online-booking.service.ts', import.meta.url), 'utf8');
const controller = await readFile(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const sync = await readFile(new URL('../online-booking/server-sync.js', import.meta.url), 'utf8');

assert.doesNotMatch(service, /peopleSharePhone\(/, 'Shared phone must not be used as an automatic Person/UEI merge rule');
assert.doesNotMatch(service, /sameNamedPerson\(/, 'Matching names must not be used as an automatic Person/UEI merge rule');
assert.doesNotMatch(service, /identity\.relations\[relationKey\]\s*=\s*uei/, 'Person must not be assigned to a UEI by inference');
assert.doesNotMatch(service, /reconcileLegacyAccountDuplicates|legacy/i, 'Retired identity reconciliation runtime must not return');

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
assert.match(myRecords, /await this\.bindAccountTenant\(tenantId, account\)/, 'Account must resolve its tenant Person binding before Record history is read');
const tenantBinding = onlineBooking.slice(
  onlineBooking.indexOf('private async bindAccountTenant'),
  onlineBooking.indexOf('private async globalAccountView'),
);
assert.match(tenantBinding, /personIdentity\.bindFirstAccess\(tenantId, account as any\)/, 'Canonical tenant binding helper must delegate to PersonIdentityService');
assert.match(myRecords, /bookingIdentityForAccount\(tenantId, accountId\)/, 'Account Record history must resolve canonical identity after Person attachment');
assert.match(myRecords, /identity\?\.memberPeople/, 'Account Record history must include all canonical UEI member People');
assert.match(myRecords, /this\.records\.listForPeople\(tenantId, people\)/, 'All Records must be read from the canonical Record owner');

assert.doesNotMatch(controller, /reconcile-legacy-people|reconcileLegacyPeople/i, 'Retired owner reconciliation route must not return');
assert.doesNotMatch(sync, /reconcile-legacy-people|legacyPeopleReconciled/i, 'Runtime sync must not contain identity reconciliation state');

console.log('person identity no-inference tests: OK');

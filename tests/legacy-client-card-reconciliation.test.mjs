import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service = await readFile(new URL('../server/src/online-booking/client-card-link.service.ts', import.meta.url), 'utf8');
const onlineBooking = await readFile(new URL('../server/src/online-booking/online-booking.service.ts', import.meta.url), 'utf8');
const controller = await readFile(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const sync = await readFile(new URL('../online-booking/server-sync.js', import.meta.url), 'utf8');

assert.match(service, /reconcileLegacyAccountDuplicates\(tenantId: string\)/, 'Legacy review service must remain available for historical data inspection');
assert.match(service, /requiresManualReview:\s*candidates > 0/, 'Legacy account-* candidates must be surfaced for explicit master review');
assert.match(service, /return \{ repaired: 0, candidates, requiresManualReview: candidates > 0 \}/, 'Legacy review must never report an automatic repair');
assert.doesNotMatch(service, /peopleSharePhone\(/, 'Shared phone must not be used as an automatic Person/UEI merge rule');
assert.doesNotMatch(service, /sameNamedPerson\(/, 'Matching names must not be used as an automatic Person/UEI merge rule');
assert.doesNotMatch(service, /identity\.relations\[relationKey\]\s*=\s*uei/, 'Code must not assign a legacy Person to a UEI by inference');
assert.doesNotMatch(service, /await this\.reconcileLegacyAccountDuplicates\(tenantId\)/, 'Client login/access must not run identity reconciliation automatically');

const cardState = service.slice(service.indexOf('async cardState('), service.indexOf('async reconcileLegacyAccountDuplicates('));
assert.match(cardState, /personHasPhone\(person, phone\)/, 'Client profile lookup must use phone');
assert.doesNotMatch(cardState, /email/i, 'Email must never choose an existing client profile');
assert.doesNotMatch(cardState, /telegram/i, 'Telegram must never choose an existing client profile');

const findOrAttach = service.slice(service.indexOf('async findOrAttachExistingCard('), service.indexOf('async bindFirstAccess('));
assert.match(findOrAttach, /const card = await this\.cardState\(tenantId, account\.phone\)/, 'Known phone lookup must happen before any new Person is created');
assert.match(findOrAttach, /if \(!card\.owner\) return null/, 'Only an actually unknown phone may fall through to Person creation');
assert.doesNotMatch(findOrAttach, /upsertBookingPersonFromAccount/, 'Known-phone path must never create a new Person');
const identityChoice = findOrAttach.slice(0, findOrAttach.indexOf('const owner:'));
assert.doesNotMatch(identityChoice, /account\.email/, 'Email may be stored after a phone match but must never select the profile');
assert.doesNotMatch(identityChoice, /account\.telegramId/, 'Telegram may be stored as contact data but must never select the profile');

const bindFirstAccess = service.slice(service.indexOf('async bindFirstAccess('), service.indexOf('async cardStats('));
assert.match(bindFirstAccess, /if \(existing\) return existing/, 'Existing known-phone Person must be reused');
assert.match(bindFirstAccess, /upsertBookingPersonFromAccount/, 'Person creation remains available only after existing-card lookup returns null');

const manualRecords = service.slice(service.indexOf('async manualRecordViews('));
assert.match(manualRecords, /phonesMatch\(client\.phone, account\.phone\)/, 'Master-created records must remain discoverable by the registered contact phone');
const myRequests = onlineBooking.slice(onlineBooking.indexOf('async getMyRequests('), onlineBooking.indexOf('async ownerAccounts('));
assert.match(myRequests, /manualRecordViews\(tenantId, account as any, importedRecordIds\)/, 'Account history must include master-created pre-login records');
assert.match(myRequests, /return \[\.\.\.requestViews, \.\.\.manualViews\]/, 'Online and pre-existing master records must be returned in one client history');

assert.match(controller, /owner\/reconcile-legacy-client-cards/, 'Owner-only legacy review route is retained for compatibility');
assert.match(controller, /@UseGuards\(JwtAuthGuard\)[\s\S]*reconcileLegacyClientCards/, 'Legacy review route must require owner authentication');
assert.doesNotMatch(sync, /legacyClientCardsReconciled/, 'Book startup must not keep automatic legacy reconciliation state');
assert.doesNotMatch(sync, /\/online-booking\/owner\/reconcile-legacy-client-cards/, 'Book startup must never trigger legacy Person/UEI reconciliation');

console.log('legacy-client-card-reconciliation.test.mjs: ok');

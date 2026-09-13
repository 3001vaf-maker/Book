import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service = await readFile(new URL('../server/src/online-booking/client-card-link.service.ts', import.meta.url), 'utf8');
const controller = await readFile(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const sync = await readFile(new URL('../online-booking/server-sync.js', import.meta.url), 'utf8');

assert.match(service, /reconcileLegacyAccountDuplicates\(tenantId: string\)/, 'Legacy duplicate reconciliation service is required');
assert.match(service, /legacyKey\.startsWith\('account-'\)/, 'Only legacy auto-created booking people may be repaired automatically');
assert.match(service, /peopleSharePhone\(legacy, person\)/, 'Legacy repair must require the same phone');
assert.match(service, /sameNamedPerson\(legacy, person\)/, 'Legacy repair must require compatible client names');
assert.match(service, /ueiCandidates\.length !== 1/, 'Legacy repair must stop on ambiguous UEI matches');
assert.match(service, /accounts: uniqueStrings\(\[\.\.\.accountIds\(canonicalEntry\.person\), \.\.\.legacyAccounts\]\)/, 'Booking account must move to the master-created client');
assert.match(service, /identity\.relations\[relationKey\] = uei/, 'Legacy booking person must join the existing master UEI');
assert.match(service, /const cleanedLegacy: Record<string, any> = \{ \.\.\.legacy, accounts: \[\] \}/, 'Legacy duplicate must no longer own the booking account');
assert.match(service, /await this\.reconcileLegacyAccountDuplicates\(tenantId\)/, 'Client login must also repair an old duplicate before identity lookup');

assert.match(controller, /owner\/reconcile-legacy-client-cards/, 'Owner-only reconciliation route is required');
assert.match(controller, /@UseGuards\(JwtAuthGuard\)[\s\S]*reconcileLegacyClientCards/, 'Legacy repair route must require owner authentication');
assert.match(sync, /legacyClientCardsReconciled/, 'Book startup must run the legacy repair only once per open session');
assert.match(sync, /\/online-booking\/owner\/reconcile-legacy-client-cards/, 'Book must request legacy repair before hydrating server data');

console.log('legacy-client-card-reconciliation.test.mjs: ok');

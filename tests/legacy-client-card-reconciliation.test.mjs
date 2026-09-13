import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service = await readFile(new URL('../server/src/online-booking/client-card-link.service.ts', import.meta.url), 'utf8');
const controller = await readFile(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const sync = await readFile(new URL('../online-booking/server-sync.js', import.meta.url), 'utf8');

assert.match(service, /reconcileLegacyAccountDuplicates\(tenantId: string\)/, 'Legacy review service must remain available for historical data inspection');
assert.match(service, /requiresManualReview:\s*candidates > 0/, 'Legacy account-* candidates must be surfaced for explicit master review');
assert.match(service, /return \{ repaired: 0, candidates, requiresManualReview: candidates > 0 \}/, 'Legacy review must never report an automatic repair');
assert.doesNotMatch(service, /peopleSharePhone\(/, 'Shared phone must not be used as an automatic Person/UEI merge rule');
assert.doesNotMatch(service, /sameNamedPerson\(/, 'Matching names must not be used as an automatic Person/UEI merge rule');
assert.doesNotMatch(service, /identity\.relations\[relationKey\]\s*=\s*uei/, 'Code must not assign a legacy Person to a UEI by inference');
assert.doesNotMatch(service, /await this\.reconcileLegacyAccountDuplicates\(tenantId\)/, 'Client login/access must not run identity reconciliation automatically');

assert.match(controller, /owner\/reconcile-legacy-client-cards/, 'Owner-only legacy review route is retained for compatibility');
assert.match(controller, /@UseGuards\(JwtAuthGuard\)[\s\S]*reconcileLegacyClientCards/, 'Legacy review route must require owner authentication');
assert.doesNotMatch(sync, /legacyClientCardsReconciled/, 'Book startup must not keep automatic legacy reconciliation state');
assert.doesNotMatch(sync, /\/online-booking\/owner\/reconcile-legacy-client-cards/, 'Book startup must never trigger legacy Person/UEI reconciliation');

console.log('legacy-client-card-reconciliation.test.mjs: ok');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const schema = source('server/prisma/schema.prisma');
const migration = source('server/prisma/migrations/20260921190000_first_run_scenario/migration.sql');
const invitation = source('server/src/tenant-invitation/tenant-invitation.service.ts');
const firstRun = source('server/src/first-run/first-run.service.ts');
const access = source('server/src/saas-access/saas-access.service.ts');
const runtime = source('first-run/runtime.js');
const core = source('core.js');
const booking = source('server/src/online-booking/online-booking.service.ts');
const dispatch = source('server/src/communication/communication-dispatch.service.ts');
const people = source('main/people/people.js');
const admin = source('admin/admin.js');
const notices = source('server/src/platform-notice/platform-notice.service.ts');
const platformNoticesUi = source('core/platform-notices.js');

assert.match(schema, /model FirstRunScenario\s*\{/);
assert.match(schema, /model FirstRunScenarioVersion\s*\{/);
assert.match(schema, /model FirstRunProgress\s*\{/);
assert.match(schema, /model FirstRunStepProgress\s*\{/);
assert.match(schema, /model PlatformActivityEvent\s*\{/);
assert.match(schema, /model PlatformSession\s*\{/);
assert.match(schema, /model PlatformNotice\s*\{/);
assert.match(schema, /commercialMode\s+String\s+@default\("DEMO"\)/);
assert.match(schema, /demoActivatedAt\s+DateTime\?/);
assert.match(schema, /demoExpiresAt\s+DateTime\?/);

assert.match(firstRun, /const DEMO_DAYS = 14/);
assert.match(firstRun, /firstRunScenarioVersionId/);
assert.match(firstRun, /status:\s*'IN_PROGRESS'/);
assert.match(firstRun, /assertRealOperationsAllowed/);
assert.match(firstRun, /commercialMode !== 'LIVE' \|\| progress/);
assert.match(firstRun, /cleanupDemoOperationalData/);
assert.match(firstRun, /person\.deleteMany/);
assert.match(firstRun, /record\.deleteMany/);
assert.match(firstRun, /financeOperation\.deleteMany/);
assert.doesNotMatch(firstRun, /profile\.deleteMany/);
assert.doesNotMatch(firstRun, /businessOperationalState\.deleteMany/);

assert.match(invitation, /activateInvitation\(invitation\.id, invitation\.tenantId\)/);
assert.match(invitation, /validateRegistrationDocuments\(input\?\.documents\)/);
assert.match(invitation, /PlatformConsentEvent/);
assert.match(invitation, /assignFromInvitation/);

assert.match(access, /source: 'FIRST_RUN'/);
assert.match(access, /source: 'DEMO'/);
assert.match(access, /source: 'DEMO_EXPIRED'/);
assert.match(access, /firstRunActive/);

assert.match(runtime, /markFirstRunStepSeen/);
assert.match(runtime, /completeFirstRunStep/);
assert.match(runtime, /flushBusinessPersistence/);
assert.match(runtime, /first-run-pulse/);
assert.match(runtime, /online-booking-welcome/);
assert.match(runtime, /finance-dds/);
assert.match(core, /FirstRunRuntime/);
assert.match(core, /renderDemoExpired/);

assert.match(booking, /assertRealOperationsAllowed\(tenantId\)/);
assert.match(dispatch, /assertRealOperationsAllowed\(tenantId\)/);
assert.match(people, /canUseRealPersonalData/);

assert.match(admin, /Первое знакомство/);
assert.match(admin, /Продлить DEMO на 14 дней/);
assert.match(admin, /data-capability-order-list/);
assert.match(admin, /CAPABILITY_CHANGED/);
assert.match(notices, /createForTenantOwner/);
assert.match(platformNoticesUi, /platform-notices/);
assert.match(core, /startPlatformNotices/);

const order = [
  'profile',
  'procedures',
  'products',
  'online-booking',
  'documents',
  'people',
  'timetable',
  'journal-record',
  'payment',
  'journal-month',
  'journal-list',
  'chat',
  'finance-overview',
  'complete',
];
let last = -1;
for (const key of order) {
  const index = migration.indexOf(`'${key}'`);
  assert.ok(index > last, `first-run order must keep ${key} after the previous milestone`);
  last = index;
}

assert.match(migration, /'documents',80,'REQUIRED_INFO'/);
assert.match(migration, /'people',90,'REQUIRED_ACTION'/);
assert.match(migration, /'payment',120,'REQUIRED_ACTION'/);
assert.match(migration, /'journal-month',130,'OPTIONAL_INFO'/);
assert.match(migration, /'chat',150,'OPTIONAL_INFO'/);

console.log('first-run architecture tests: OK');

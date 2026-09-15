import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../server/prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../server/prisma/migrations/20260915113000_capability_access_events/migration.sql', import.meta.url), 'utf8');
const adminService = readFileSync(new URL('../server/src/saas-admin/saas-admin.service.ts', import.meta.url), 'utf8');
const accessService = readFileSync(new URL('../server/src/saas-access/saas-access.service.ts', import.meta.url), 'utf8');

assert.match(schema, /enum CapabilityAccessChangeType[\s\S]*ENABLED[\s\S]*DISABLED/);
assert.match(schema, /model CapabilityAccessEvent/);
assert.match(migration, /CREATE TABLE "CapabilityAccessEvent"/);
assert.match(migration, /ON DELETE CASCADE/);
assert.match(adminService, /\$transaction/);
assert.match(adminService, /capabilityAccessEvent\.updateMany/);
assert.match(adminService, /cancelledAt: changedAt/);
assert.match(adminService, /batchId/);
assert.match(accessService, /pendingCapabilityChanges/);
assert.match(accessService, /summaryAcknowledgedAt/);
assert.match(accessService, /detailAcknowledgedAt/);
assert.doesNotMatch(accessService, /if \(!result\.count\)/, 'Acknowledgements must be idempotent when a stale event was already cancelled or acknowledged');

console.log('capability access event server tests: OK');

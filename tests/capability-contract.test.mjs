import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BOOK_CAPABILITIES } from '../core/capability-registry.js';

const serverCatalog = readFileSync(new URL('../server/src/master-invitation/master-invitation.service.ts', import.meta.url), 'utf8');
const accessRuntime = readFileSync(new URL('../core/access-runtime.js', import.meta.url), 'utf8');
const accessClient = readFileSync(new URL('../core/access.js', import.meta.url), 'utf8');
const accessController = readFileSync(new URL('../server/src/saas-access/saas-access.controller.ts', import.meta.url), 'utf8');
const accessService = readFileSync(new URL('../server/src/saas-access/saas-access.service.ts', import.meta.url), 'utf8');
const adminService = readFileSync(new URL('../server/src/saas-admin/saas-admin.service.ts', import.meta.url), 'utf8');
const prismaSchema = readFileSync(new URL('../server/prisma/schema.prisma', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../core/bootstrap.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const serverKeys = [...serverCatalog.matchAll(/\{\s*key:\s*'([^']+)'/g)].map((match) => match[1]).sort();
const registryKeys = Object.keys(BOOK_CAPABILITIES).sort();

assert.deepEqual(registryKeys, serverKeys, 'Capability catalog and frontend registry must contain the same keys');

for (const [key, meta] of Object.entries(BOOK_CAPABILITIES)) {
  assert.ok(meta.title, `${key}: title is required`);
  assert.ok(meta.description, `${key}: description is required for the master announcement`);
  assert.ok(meta.owner, `${key}: owner file is required`);
  const ownerUrl = new URL(`../${meta.owner}`, import.meta.url);
  assert.ok(existsSync(ownerUrl), `${key}: owner file does not exist: ${meta.owner}`);
  const ownerSource = readFileSync(ownerUrl, 'utf8');
  assert.match(ownerSource, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${key}: owner does not enforce or expose capability`);
  if (key !== 'workplaces.max') {
    assert.ok(meta.entrySelector, `${key}: first-entry selector is required`);
    assert.ok(meta.introTitle, `${key}: intro title is required`);
    assert.ok(meta.introBody, `${key}: intro body is required`);
    assert.ok(meta.introAction, `${key}: intro action is required`);
  }
}

assert.match(index, /core\/bootstrap\.js/);
assert.match(bootstrap, /import '\.\/access-runtime\.js'/);
assert.match(bootstrap, /import\('\.\.\/core\.js'\)/);
assert.match(accessClient, /cache:\s*'no-store'/);
assert.match(accessClient, /book:access-updated/);
assert.doesNotMatch(accessClient, /localStorage|sessionStorage/, 'Capability onboarding state must not depend on browser storage');
assert.match(accessRuntime, /pointerdown/);
assert.match(accessRuntime, /visibilitychange/);
assert.match(accessRuntime, /window\.addEventListener\('focus'/);
assert.match(accessRuntime, /openBlockingNotice/);
assert.match(accessRuntime, /acknowledgeCapabilitySummary/);
assert.match(accessRuntime, /acknowledgeCapabilityIntroduction/);
assert.doesNotMatch(accessRuntime, /location\.reload|window\.location\.reload/, 'Access changes must apply without a page reload');
assert.match(prismaSchema, /model CapabilityAccessEvent/);
assert.match(prismaSchema, /summaryAcknowledgedAt\s+DateTime\?/);
assert.match(prismaSchema, /detailAcknowledgedAt\s+DateTime\?/);
assert.match(prismaSchema, /cancelledAt\s+DateTime\?/);
assert.match(accessController, /@Get\('changes'\)/);
const capabilityResolveBlock = accessService.slice(accessService.indexOf('async resolveCapability'), accessService.indexOf('async resolveTenantAccess'));
assert.ok(
  capabilityResolveBlock.indexOf('access.isOwnerBook') < capabilityResolveBlock.indexOf('TenantAccessStatus.SUSPENDED'),
  'platform owner capability access must win before suspended, plan and override logic',
);
assert.match(accessController, /ack-summary/);
assert.match(accessController, /ack-detail/);
assert.match(adminService, /capabilityAccessEvent\.create/);
assert.match(adminService, /CapabilityAccessChangeType\.ENABLED/);
assert.match(adminService, /CapabilityAccessChangeType\.DISABLED/);

console.log('capability contract tests: OK');

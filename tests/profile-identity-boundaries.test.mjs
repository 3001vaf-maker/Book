import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../server/prisma/schema.prisma', import.meta.url), 'utf8');
const profileService = readFileSync(new URL('../server/src/profile/profile.service.ts', import.meta.url), 'utf8');
const authService = readFileSync(new URL('../server/src/auth/auth.service.ts', import.meta.url), 'utf8');
const invitationService = readFileSync(new URL('../server/src/invitation/invitation.service.ts', import.meta.url), 'utf8');
const workspaceService = readFileSync(new URL('../server/src/workspace/workspace.service.ts', import.meta.url), 'utf8');
const saasAdminService = readFileSync(new URL('../server/src/saas-admin/saas-admin.service.ts', import.meta.url), 'utf8');
const platformAdminGuard = readFileSync(new URL('../server/src/saas-admin/platform-admin.guard.ts', import.meta.url), 'utf8');

function modelBlock(name) {
  const marker = `model ${name} {`;
  const start = schema.indexOf(marker);
  assert.notEqual(start, -1, `Missing Prisma model: ${name}`);
  const end = schema.indexOf('\n}', start);
  assert.notEqual(end, -1, `Unclosed Prisma model: ${name}`);
  return schema.slice(start, end + 2);
}

const tenantModel = modelBlock('Tenant');
const userModel = modelBlock('User');
const membershipModel = modelBlock('Membership');
const profileModel = modelBlock('Profile');

const activeIdentitySources = [
  authService,
  invitationService,
  profileService,
  workspaceService,
  saasAdminService,
  platformAdminGuard,
].join('\n');

// Tenant is the isolated data boundary and is not a Profile alias.
assert.match(tenantModel, /memberships\s+Membership\[\]/);
assert.match(tenantModel, /profiles\s+Profile\[\]/);
assert.match(tenantModel, /documentArchive\s+TenantDocumentArchive\?/);
assert.match(tenantModel, /businessPeople\s+BusinessPerson\[\]/);

// User currently represents the login account / authentication principal.
assert.match(userModel, /email\s+String\s+@unique/);
assert.match(userModel, /passwordHash\s+String/);
assert.match(userModel, /memberships\s+Membership\[\]/);
assert.match(userModel, /profiles\s+Profile\[\]/);
assert.match(authService, /where: \{ email: normalizedEmail \}/);
assert.match(authService, /sub: user\.id/);

// Membership is the explicit link between the login account and a Tenant.
assert.match(membershipModel, /tenantId\s+String/);
assert.match(membershipModel, /userId\s+String/);
assert.match(membershipModel, /tenant\s+Tenant\s+@relation/);
assert.match(membershipModel, /user\s+User\s+@relation/);
assert.match(membershipModel, /@@unique\(\[tenantId, userId\]\)/);

// Profile is a separate entity scoped by both Tenant and account.
assert.match(profileModel, /tenantId\s+String/);
assert.match(profileModel, /userId\s+String/);
assert.match(profileModel, /tenant\s+Tenant\s+@relation/);
assert.match(profileModel, /user\s+User\s+@relation/);
assert.match(profileModel, /@@unique\(\[tenantId, userId\]\)/);
assert.match(profileService, /where: \{ tenantId_userId: \{ tenantId, userId \} \}/);

// Workspace state follows the same Tenant + account boundary and is not the Profile itself.
assert.match(workspaceService, /tenantId_userId/);
assert.match(workspaceService, /create: \{ tenantId, userId, data, revision: 1 \}/);

// Current invitation semantics: provision a Tenant first, then connect the new login account as OWNER.
// Naming can change later; this ownership behavior must not change accidentally.
assert.match(invitationService, /const tenant = await tx\.tenant\.create/);
assert.match(invitationService, /const user = await tx\.user\.create/);
assert.match(invitationService, /await tx\.membership\.create/);
assert.match(invitationService, /role: MembershipRole\.OWNER/);

// Legacy tenant roles MASTER / ADMIN are not used by the checked active identity logic.
assert.doesNotMatch(activeIdentitySources, /MembershipRole\.MASTER/);
assert.doesNotMatch(activeIdentitySources, /MembershipRole\.ADMIN/);

console.log('Profile identity boundary tests: OK');

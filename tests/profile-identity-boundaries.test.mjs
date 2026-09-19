import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../server/prisma/schema.prisma', import.meta.url), 'utf8');
const profileService = readFileSync(new URL('../server/src/profile/profile.service.ts', import.meta.url), 'utf8');
const invitationService = readFileSync(new URL('../server/src/tenant-invitation/tenant-invitation.service.ts', import.meta.url), 'utf8');
const workspaceService = readFileSync(new URL('../server/src/workspace/workspace.service.ts', import.meta.url), 'utf8');
const adminService = readFileSync(new URL('../server/src/saas-admin/saas-admin.service.ts', import.meta.url), 'utf8');
const adminController = readFileSync(new URL('../server/src/saas-admin/saas-admin.controller.ts', import.meta.url), 'utf8');

function modelBlock(name) {
  const marker = `model ${name} {`;
  const start = schema.indexOf(marker);
  assert.notEqual(start, -1, `Missing Prisma model: ${name}`);
  const end = schema.indexOf('\n}', start);
  assert.notEqual(end, -1, `Unclosed Prisma model: ${name}`);
  return schema.slice(start, end + 2);
}

const tenantModel = modelBlock('Tenant');
const platformAccountModel = modelBlock('PlatformAccount');
const membershipModel = modelBlock('Membership');
const profileModel = modelBlock('Profile');

const membershipRoleMatch = schema.match(/enum MembershipRole \{([\s\S]*?)\n\}/);
assert.ok(membershipRoleMatch, 'Missing MembershipRole enum');
assert.deepEqual(
  membershipRoleMatch[1].split('\n').map((line) => line.trim()).filter(Boolean),
  ['OWNER'],
);
const workplaceModel = modelBlock('Workplace');
const personModel = modelBlock('Person');
const membershipRoleEnum = schema.slice(
  schema.indexOf('enum MembershipRole {'),
  schema.indexOf('\n}', schema.indexOf('enum MembershipRole {')) + 2,
);

// Tenant is the persistent business/data boundary.
// It owns Profile rows and People rows, but they are different concepts.
assert.match(tenantModel, /profiles\s+Profile\[\]/);
assert.match(tenantModel, /people\s+Person\[\]/);
assert.match(tenantModel, /memberships\s+Membership\[\]/);

// Login identity is separate from Profile.
assert.match(platformAccountModel, /email\s+String\s+@unique/);
assert.match(platformAccountModel, /passwordHash\s+String/);
assert.match(platformAccountModel, /memberships\s+Membership\[\]/);
assert.match(platformAccountModel, /profiles\s+Profile\[\]/);

// Membership links the login identity to Tenant.
assert.match(membershipModel, /tenantId\s+String/);
assert.match(membershipModel, /platformAccountId\s+String/);
assert.match(membershipModel, /@@unique\(\[tenantId, platformAccountId\]\)/);

// Membership role is intentionally OWNER-only in the current PRIVATE model.
assert.match(membershipRoleEnum, /OWNER/);
assert.doesNotMatch(membershipRoleEnum, /ADMIN/);
assert.ok(!membershipRoleEnum.includes(['MA', 'STER'].join('')));

// Profile belongs to Tenant + login identity.
// Profile has no nested/sub-profile relation.
assert.match(profileModel, /tenantId\s+String/);
assert.match(profileModel, /platformAccountId\s+String/);
assert.match(profileModel, /@@unique\(\[tenantId, platformAccountId\]\)/);
assert.doesNotMatch(profileModel, /profiles\s+Profile\[\]/);
assert.doesNotMatch(profileModel, /parentProfileId|childProfileId/);

// Workplaces belong to Profile, so one private Profile can have many workplaces.
assert.match(profileModel, /workplaces\s+Workplace\[\]/);
assert.match(workplaceModel, /profileId\s+String/);
assert.match(workplaceModel, /profile\s+Profile\s+@relation/);

// People belong to Tenant, not directly to Profile.
assert.match(personModel, /tenantId\s+String/);
assert.match(personModel, /tenant\s+Tenant\s+@relation/);
assert.doesNotMatch(personModel, /profileId\s+String/);
assert.doesNotMatch(personModel, /profile\s+Profile\s+@relation/);

// Current PRIVATE provisioning path creates one Tenant and one OWNER membership.
// It does not create nested/additional Profiles during invitation acceptance.
assert.equal((invitationService.match(/tx\.tenant\.create/g) || []).length, 1);
assert.equal((invitationService.match(/tx\.platformAccount\.create/g) || []).length, 1);
assert.equal((invitationService.match(/tx\.membership\.create/g) || []).length, 1);
assert.match(invitationService, /role: MembershipRole\.OWNER/);
assert.doesNotMatch(invitationService, /tx\.profile\.create/);

// Profile bootstrap is idempotent for the current Tenant + login identity.
assert.match(profileService, /where: \{ tenantId_platformAccountId: \{ tenantId, platformAccountId \} \}/);
assert.match(profileService, /await this\.prisma\.profile\.create/);

// Platform admin manages Tenant containers and exposes the owner's Profile separately.
assert.match(adminController, /@Get\('tenants'\)/);
assert.match(adminService, /async tenants\(\)/);
assert.match(adminService, /ownerProfile: membership \? \{/);
assert.match(invitationService, /TenantInvitationStatus/);
assert.match(invitationService, /prisma\.tenantInvitation/);

// Workspace state follows Tenant + login identity and is not the Profile itself.
assert.match(workspaceService, /tenantId_platformAccountId/);
assert.match(workspaceService, /create: \{ tenantId, platformAccountId, data, revision: 1 \}/);

console.log('Profile identity boundary tests: OK');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../server/prisma/schema.prisma', import.meta.url), 'utf8');
const profileService = readFileSync(new URL('../server/src/profile/profile.service.ts', import.meta.url), 'utf8');
const authService = readFileSync(new URL('../server/src/auth/auth.service.ts', import.meta.url), 'utf8');
const invitationService = readFileSync(new URL('../server/src/master-invitation/master-invitation.service.ts', import.meta.url), 'utf8');
const workspaceService = readFileSync(new URL('../server/src/workspace/workspace.service.ts', import.meta.url), 'utf8');
function modelBlock(name) {
  const match = schema.match(new RegExp(`model ${name} \\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Missing Prisma model: ${name}`);
  return match[1];
}

const tenantModel = modelBlock('Tenant');
const userModel = modelBlock('User');
const membershipModel = modelBlock('Membership');
const profileModel = modelBlock('Profile');

const activeServerSources = [
  authService,
  invitationService,
  profileService,
  workspaceService,
  readFileSync(new URL('../server/src/saas-admin/saas-admin.service.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../server/src/saas-admin/platform-admin.guard.ts', import.meta.url), 'utf8'),
].join('\n');

// Tenant is the isolated Book data boundary, not a Profile alias.
assert.match(schema, /model Tenant \{/);
assert.match(schema, /memberships\s+Membership\[\]/);
assert.match(schema, /profiles\s+Profile\[\]/);
assert.match(schema, /documentArchive\s+TenantDocumentArchive\?/);
assert.match(schema, /businessPeople\s+BusinessPerson\[\]/);

// User currently represents the login account / authentication principal.
assert.match(schema, /model User \{/);
assert.match(schema, /email\s+String\s+@unique/);
assert.match(schema, /passwordHash\s+String/);
assert.match(authService, /findUnique\(\{\s*where: \{ email: normalizedEmail \}/);
assert.match(authService, /sub: user\.id/);

// Membership is the explicit link between a login account and a Tenant.
assert.match(schema, /model Membership \{/);
assert.match(schema, /tenantId\s+String/);
assert.match(schema, /userId\s+String/);
assert.match(schema, /@@unique\(\[tenantId, userId\]\)/);

// Profile is distinct from both Tenant and User and is scoped by both IDs.
assert.match(schema, /model Profile \{/);
assert.match(schema, /tenantId\s+String/);
assert.match(schema, /userId\s+String/);
assert.match(schema, /@@unique\(\[tenantId, userId\]\)/);
assert.match(profileService, /where: \{ tenantId_userId: \{ tenantId, userId \} \}/);

// Workspace state follows the same tenant + account boundary and is not the Profile itself.
assert.match(workspaceService, /tenantId_userId/);
assert.match(workspaceService, /create: \{ tenantId, userId, data, revision: 1 \}/);

// The current invitation flow provisions a Tenant and later connects a new account as OWNER.
// Future naming changes must preserve this behavior even when "master" terminology is removed.
assert.match(invitationService, /const tenant = await tx\.tenant\.create/);
assert.match(invitationService, /const user = await tx\.user\.create/);
assert.match(invitationService, /await tx\.membership\.create/);
assert.match(invitationService, /role: MembershipRole\.OWNER/);

// MASTER / ADMIN tenant roles are not used by the checked active identity logic.
assert.doesNotMatch(activeServerSources, /MembershipRole\.MASTER/);
assert.doesNotMatch(activeServerSources, /MembershipRole\.ADMIN/);

console.log('Profile identity boundary tests: OK');

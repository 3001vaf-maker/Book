import assert from 'node:assert/strict';
import fs from 'node:fs';

const invitation = fs.readFileSync('server/src/tenant-invitation/tenant-invitation.service.ts', 'utf8');
const invitationController = fs.readFileSync('server/src/tenant-invitation/tenant-invitation.controller.ts', 'utf8');
const adminController = fs.readFileSync('server/src/saas-admin/saas-admin.controller.ts', 'utf8');
const adminService = fs.readFileSync('server/src/saas-admin/saas-admin.service.ts', 'utf8');
const adminModule = fs.readFileSync('server/src/saas-admin/saas-admin.module.ts', 'utf8');
const adminUi = fs.readFileSync('admin/admin.js', 'utf8');
const inviteUi = fs.readFileSync('invite/invite.js', 'utf8');
const prelaunchHardDeleteMigration = fs.readFileSync('server/prisma/migrations/20260922075500_prelaunch_hard_delete_clean_start/migration.sql', 'utf8');

assert.match(invitation, /async createRegistrationLink\(/);
assert.match(invitation, /@registration\.invalid/);
assert.equal((invitation.match(/tx\.tenant\.create/g) || []).length, 1);
assert.equal((invitation.match(/tx\.platformAccount\.create/g) || []).length, 1);
assert.equal((invitation.match(/tx\.membership\.create/g) || []).length, 1);
assert.doesNotMatch(invitation, /manual-invitation|@book\.invalid/i);

assert.match(invitationController, /email\?: unknown/);
assert.match(adminController, /@Post\('invitations\/link'\)/);
assert.match(adminController, /@Post\('tenants\/:tenantId\/technical-email'\)/);
assert.doesNotMatch(adminController, /manual-invitations|registration-links/);

assert.match(adminService, /TransactionalEmailService/);
assert.match(adminService, /tag: 'platform-service'/);
assert.match(adminModule, /TransactionalEmailModule/);

assert.match(adminUi, /data-create-invite-link/);
assert.match(adminUi, /Регистрационная ссылка/);
assert.match(adminUi, /data-email-tenant/);
assert.match(adminUi, />Письмо<\/button>/);
assert.match(adminUi, /\/invitations\/link/);
assert.match(adminUi, /data-technical-email-form/);
assert.match(adminUi, /\/technical-email/);
assert.doesNotMatch(adminUi, /data-section="communications"/);

assert.match(inviteUi, /invitation\.requiresEmail/);
assert.match(inviteUi, /\/tenant-invitations\/accept/);
assert.doesNotMatch(inviteUi, /manual-invitations|\/register\//);

assert.match(adminController, /@Delete\('tenants\/:tenantId'\)/);
assert.match(adminService, /async deleteTenant\(tenantId: string\)/);
assert.match(adminService, /access\.isOwnerBook/);
assert.match(adminService, /OWNER Book нельзя удалить/);
assert.match(adminService, /prisma\.\$transaction/);
assert.match(adminService, /tx\.tenant\.delete/);
assert.match(adminService, /remainingMemberships === 0 && !platformAdmin/);
assert.doesNotMatch(adminService, /DELETE FROM "PlatformConsentEvent"/);
assert.doesNotMatch(adminService, /allow_test_tenant_delete/);
assert.doesNotMatch(adminService, /set_config\(/);
assert.doesNotMatch(prelaunchHardDeleteMigration, /DROP TABLE IF EXISTS/);
assert.doesNotMatch(prelaunchHardDeleteMigration, /DROP FUNCTION IF EXISTS/);
assert.match(prelaunchHardDeleteMigration, /DROP TRIGGER IF EXISTS "PlatformConsentEvent_append_only"/);
assert.match(prelaunchHardDeleteMigration, /DROP TRIGGER IF EXISTS "PlatformActivityEvent_append_only"/);
assert.match(prelaunchHardDeleteMigration, /PlatformConsentEvent_tenantId_fkey/);
assert.match(prelaunchHardDeleteMigration, /PlatformConsentEvent_platformAccountId_fkey/);
assert.match(prelaunchHardDeleteMigration, /ON DELETE CASCADE ON UPDATE CASCADE/);
assert.match(prelaunchHardDeleteMigration, /COALESCE\(access\."isOwnerBook", false\) = false/);
assert.match(prelaunchHardDeleteMigration, /DELETE FROM "Tenant"/);
assert.match(prelaunchHardDeleteMigration, /NOT EXISTS \([\s\S]*"PlatformAdmin"/);
assert.match(adminUi, /data-delete-tenant/);
assert.match(adminUi, /Будут полностью удалены/);
assert.match(adminUi, /openDeleteTenantModal/);
assert.doesNotMatch(adminUi, /window\.confirm|\balert\s*\(/);
assert.doesNotMatch(adminUi, /data-delete-invitation/);

console.log('Admin registration link and technical email tests passed');

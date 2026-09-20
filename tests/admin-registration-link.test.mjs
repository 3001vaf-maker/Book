import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin = fs.readFileSync('admin/admin.js', 'utf8');
const css = fs.readFileSync('admin/admin.css', 'utf8');
const appModule = fs.readFileSync('server/src/app.module.ts', 'utf8');
const manualController = fs.readFileSync('server/src/manual-invitation/manual-invitation.controller.ts', 'utf8');
const manualModule = fs.readFileSync('server/src/manual-invitation/manual-invitation.module.ts', 'utf8');
const manualService = fs.readFileSync('server/src/manual-invitation/manual-invitation.service.ts', 'utf8');
const invitationService = fs.readFileSync('server/src/tenant-invitation/tenant-invitation.service.ts', 'utf8');
const invitationController = fs.readFileSync('server/src/tenant-invitation/tenant-invitation.controller.ts', 'utf8');
const adminController = fs.readFileSync('server/src/saas-admin/saas-admin.controller.ts', 'utf8');
const registration = fs.readFileSync('register/register.js', 'utf8');

assert.match(admin, /data-create-invite-link/);
assert.match(admin, /\/manual-invitations/);
assert.match(admin, /Создать ссылку/);
assert.match(admin, /data-invite-link/);
assert.match(admin, /@registration\.invalid/);
assert.doesNotMatch(admin, /\/registration-links/);

assert.match(css, /\.admin-invite-head/);
assert.match(css, /\.admin-invite-link/);
assert.doesNotMatch(css, /manual-invite-button/);

assert.match(appModule, /ManualInvitationModule/);
assert.match(manualModule, /TenantInvitationModule/);
assert.match(manualController, /@Controller\('saas-admin\/manual-invitations'\)/);
assert.match(manualController, /@Controller\('manual-invitations'\)/);
assert.match(manualService, /createRegistrationLink/);
assert.match(manualService, /inspectRegistrationLink/);
assert.match(manualService, /acceptRegistrationLink/);

assert.match(invitationService, /async createRegistrationLink\(/);
assert.match(invitationService, /REGISTRATION_LINK_EMAIL_SUFFIX = '@registration\.invalid'/);
assert.match(invitationService, /FRONTEND_ORIGIN/);
assert.match(invitationService, /async acceptRegistrationLink\(/);
assert.match(invitationService, /private async findActiveRegistrationLink\(/);
assert.doesNotMatch(invitationService, /@book\.invalid/i);

assert.doesNotMatch(invitationController, /registration-link\/inspect|registration-link\/accept/);
assert.doesNotMatch(adminController, /@Post\('registration-links'\)/);
assert.match(registration, /manual-invitations\/inspect/);
assert.match(registration, /manual-invitations\/accept/);
assert.doesNotMatch(registration, /tenant-invitations\/registration-link/);
assert.match(registration, /name="email"/);
assert.match(registration, /name="password"/);

console.log('Admin manual registration link restoration tests passed');

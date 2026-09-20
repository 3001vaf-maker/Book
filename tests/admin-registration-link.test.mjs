import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin = fs.readFileSync('admin/admin.js', 'utf8');
const css = fs.readFileSync('admin/admin.css', 'utf8');
const service = fs.readFileSync('server/src/tenant-invitation/tenant-invitation.service.ts', 'utf8');
const controller = fs.readFileSync('server/src/tenant-invitation/tenant-invitation.controller.ts', 'utf8');
const registration = fs.readFileSync('register/register.js', 'utf8');

assert.match(admin, /data-create-registration-link/);
assert.match(admin, /\/registration-links/);
assert.match(admin, /Создать ссылку без email/);
assert.match(admin, /data-registration-link/);
assert.match(admin, /@registration\.invalid/);

assert.match(css, /\.admin-invite-head/);
assert.match(css, /\.admin-invite-link/);
assert.doesNotMatch(css, /manual-invite-button/);

assert.match(service, /async createRegistrationLink\(/);
assert.match(service, /REGISTRATION_LINK_EMAIL_SUFFIX = '@registration\.invalid'/);
assert.match(service, /FRONTEND_ORIGIN/);
assert.match(service, /async acceptRegistrationLink\(/);
assert.match(service, /private async findActiveRegistrationLink\(/);
assert.doesNotMatch(service, /@book\.invalid/i);

assert.match(controller, /registration-link\/inspect/);
assert.match(controller, /registration-link\/accept/);
assert.match(registration, /tenant-invitations\/registration-link\/inspect/);
assert.match(registration, /tenant-invitations\/registration-link\/accept/);
assert.match(registration, /name="email"/);
assert.match(registration, /name="password"/);

console.log('Admin registration link contract tests passed');

import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller = fs.readFileSync('server/src/saas-admin/saas-admin.controller.ts', 'utf8');
const moduleSource = fs.readFileSync('server/src/saas-admin/saas-admin.module.ts', 'utf8');
const service = fs.readFileSync('server/src/saas-admin/platform-communication.service.ts', 'utf8');
const admin = fs.readFileSync('admin/admin.js', 'utf8');
const migration = fs.readFileSync('server/prisma/migrations/20260920153000_platform_communications/migration.sql', 'utf8');

assert.match(controller, /@Get\('communications'\)/);
assert.match(controller, /@Post\('communications\/email'\)/);
assert.match(controller, /PlatformCommunicationService/);
assert.match(moduleSource, /TransactionalEmailModule/);
assert.match(moduleSource, /PlatformCommunicationService/);

assert.match(service, /TransactionalEmailService/);
assert.match(service, /'EMAIL', 'SERVICE'/);
assert.match(service, /tag: 'platform-service'/);
assert.match(service, /recipientPlatformAccountId/);
assert.doesNotMatch(service, /BOOK_|Book/);

assert.match(admin, /data-section="communications"/);
assert.match(admin, /Технические письма/);
assert.match(admin, /communications\/email/);
assert.match(admin, /Только сервисные и технические письма/);

assert.match(migration, /CREATE TABLE "PlatformCommunication"/);
assert.match(migration, /"purpose" TEXT NOT NULL DEFAULT 'SERVICE'/);
assert.match(migration, /"channel" TEXT NOT NULL DEFAULT 'EMAIL'/);
assert.match(migration, /PlatformCommunication_status_check/);

console.log('Platform technical email contract tests passed');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../server/prisma/migrations/20260916112000_tenant_time_zone/migration.sql', import.meta.url), 'utf8');
const timeZoneService = await readFile(new URL('../server/src/profile/tenant-time-zone.service.ts', import.meta.url), 'utf8');
const profileController = await readFile(new URL('../server/src/profile/profile.controller.ts', import.meta.url), 'utf8');
const profileModule = await readFile(new URL('../server/src/profile/profile.module.ts', import.meta.url), 'utf8');
const browserProfile = await readFile(new URL('../settings/profile/migration.js', import.meta.url), 'utf8');
const reminder = await readFile(new URL('../server/src/notification/notification-reminder.service.ts', import.meta.url), 'utf8');
const notificationModule = await readFile(new URL('../server/src/notification/notification.module.ts', import.meta.url), 'utf8');
const deployment = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
const contract = await readFile(new URL('../docs/BUSINESS_TIME_ZONE.md', import.meta.url), 'utf8');

assert.match(migration, /CREATE TABLE "TenantTimeZone"/);
assert.match(migration, /PRIMARY KEY \("tenantId"\)/);
assert.match(migration, /SELECT "id", 'Europe\/Moscow'/);
assert.match(timeZoneService, /normalizeTenantTimeZone/);
assert.match(timeZoneService, /Intl\.DateTimeFormat\('en-US', \{ timeZone \}\)/);
assert.match(timeZoneService, /BOOK_TIME_ZONE/);
assert.match(timeZoneService, /ON CONFLICT \("tenantId"\) DO NOTHING/);
assert.match(profileController, /@Body\(\) body: \{ timeZone\?: unknown \}/);
assert.match(profileController, /captureOnRegistration/);
assert.match(profileModule, /TenantTimeZoneService/);
assert.match(browserProfile, /resolvedOptions\(\)\.timeZone/);
assert.match(browserProfile, /JSON\.stringify\(\{ timeZone: deviceTimeZone\(\) \}\)/);
assert.match(reminder, /TenantTimeZoneService/);
assert.match(reminder, /this\.timeZones\.get\(tenantId\)/);
assert.match(reminder, /zonedWallClockMinute\(now, timeZone\)/);
assert.doesNotMatch(reminder, /process\.env\.BOOK_TIME_ZONE/);
assert.match(notificationModule, /ProfileModule/);
assert.match(deployment, /npx prisma migrate deploy/);
assert.match(contract, /first working-profile bootstrap/);
assert.match(contract, /Server-host time must never be treated as the business time zone/);

console.log('business time zone registration contract: OK');

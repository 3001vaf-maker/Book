import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../core/auth.js', import.meta.url), 'utf8');
const profileData = readFileSync(new URL('../settings/profile/data.js', import.meta.url), 'utf8');
const workplaceData = readFileSync(new URL('../settings/profile/workplaces/data.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../settings/profile/migration.js', import.meta.url), 'utf8');
const serverService = readFileSync(new URL('../server/src/profile/profile.service.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../server/prisma/schema.prisma', import.meta.url), 'utf8');
const workplaceTimeZoneMigration = readFileSync(new URL('../server/prisma/migrations/20260920113000_workplace_timezone/migration.sql', import.meta.url), 'utf8');
const workplaceSoftDeleteMigration = readFileSync(new URL('../server/prisma/migrations/20260927124500_workplace_soft_delete/migration.sql', import.meta.url), 'utf8');
const workplaceLimitGuard = readFileSync(new URL('../server/src/profile/workplace-limit.guard.ts', import.meta.url), 'utf8');

assert.doesNotMatch(auth, /prepareProductionWorkspace|localStorage\.removeItem/);
assert.doesNotMatch(core, /workspace-sync|syncWorkspaceBeforeRender|startWorkspaceSync/);
assert.match(core, /initializeProfileWorkplaces/);

assert.doesNotMatch(profileData, /localStorage|readLegacyProfileSnapshot/);
assert.match(profileData, /apiRequest\('\/profile'/);
assert.match(profileData, /hydrateProfileFromServer/);
assert.match(profileData, /id:\s*String\(profile\.id\s*\|\|\s*''\)/);
assert.match(profileData, /platformAccountId:\s*String\(profile\.platformAccountId\s*\|\|\s*''\)/);

assert.doesNotMatch(workplaceData, /localStorage|readLegacyWorkplacesSnapshot/);
assert.match(workplaceData, /apiRequest\(`\/profile\/workplaces\//);
assert.match(workplaceData, /hydrateWorkplacesFromServer/);

assert.match(migration, /apiRequest\('\/profile'\)/);
assert.match(migration, /apiRequest\('\/profile\/bootstrap'/);
assert.match(migration, /hydrateProfileFromServer/);
assert.match(migration, /hydrateWorkplacesFromServer/);
assert.doesNotMatch(migration, /localStorage|readLegacy|\/profile\/migrate/);

assert.match(schema, /model Profile\s*\{/);
assert.match(schema, /model Workplace\s*\{/);
assert.match(schema, /timeZone\s+String\s+@default\("Europe\/Moscow"\)/);
assert.match(workplaceData, /timeZone:\s*String\(workplace\.timeZone/);
assert.match(serverService, /resolveWorkplaceTimeZone/);
assert.match(workplaceTimeZoneMigration, /Asia\/Yekaterinburg/);
assert.match(workplaceTimeZoneMigration, /Europe\/Kaliningrad/);
assert.match(schema, /migrationVerifiedAt\s+DateTime\?/);
assert.match(serverService, /migrationVerifiedAt/);
assert.match(serverService, /id:\s*row\.id/);
assert.match(serverService, /platformAccountId:\s*row\.platformAccountId/);
assert.match(serverService, /ConflictException\('Проверка переноса Profile \+ Workplaces не пройдена'\)/);
assert.match(schema, /deletedAt\s+DateTime\?/);
assert.match(workplaceSoftDeleteMigration, /ADD COLUMN IF NOT EXISTS "deletedAt"/);
assert.match(serverService, /data: \{ deletedAt: new Date\(\) \}/);
assert.doesNotMatch(serverService, /prisma\.workplace\.delete\(/);
assert.match(serverService, /where: \{ deletedAt: null \}/);
assert.match(workplaceLimitGuard, /deletedAt: null/);

console.log('profile server owner tests: OK');

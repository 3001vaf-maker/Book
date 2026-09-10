import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../core/auth.js', import.meta.url), 'utf8');
const profileData = readFileSync(new URL('../settings/profile/data.js', import.meta.url), 'utf8');
const workplaceData = readFileSync(new URL('../settings/profile/workplaces/data.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../settings/profile/migration.js', import.meta.url), 'utf8');
const serverService = readFileSync(new URL('../server/src/profile/profile.service.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../server/prisma/schema.prisma', import.meta.url), 'utf8');

assert.doesNotMatch(auth, /prepareProductionWorkspace|localStorage\.removeItem/);
assert.doesNotMatch(core, /workspace-sync|syncWorkspaceBeforeRender|startWorkspaceSync/);
assert.match(core, /initializeProfileWorkplaces/);

assert.doesNotMatch(profileData, /localStorage\.setItem/);
assert.match(profileData, /readLegacyProfileSnapshot/);
assert.match(profileData, /apiRequest\('\/profile'/);

assert.doesNotMatch(workplaceData, /localStorage\.setItem/);
assert.match(workplaceData, /readLegacyWorkplacesSnapshot/);
assert.match(workplaceData, /apiRequest\(`\/profile\/workplaces\//);

assert.match(migration, /\/profile\/migrate/);
assert.match(migration, /\/profile\/migrate\/verify/);
assert.match(migration, /sameBundle/);
assert.match(migration, /awaiting-populated-browser/);

assert.match(schema, /model Profile\s*\{/);
assert.match(schema, /model Workplace\s*\{/);
assert.match(schema, /migrationVerifiedAt\s+DateTime\?/);
assert.match(serverService, /migrationVerifiedAt/);
assert.match(serverService, /ConflictException\('Проверка переноса Profile \+ Workplaces не пройдена'\)/);

console.log('profile server owner tests: OK');

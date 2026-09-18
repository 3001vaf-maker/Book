import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const core = readFileSync('core.js', 'utf8');
const authController = readFileSync('server/src/auth/auth.controller.ts', 'utf8');
const authService = readFileSync('server/src/auth/auth.service.ts', 'utf8');
const adminService = readFileSync('server/src/saas-admin/saas-admin.service.ts', 'utf8');
const adminUi = readFileSync('admin/admin.js', 'utf8');
const legalService = readFileSync('server/src/legal-runtime/legal-runtime.service.ts', 'utf8');

for (const stage of ['access', 'legal', 'profile', 'business', 'operational', 'documents', 'auxiliary']) {
  assert.match(core, new RegExp(stage));
}
assert.match(core, /auth\/startup-diagnostic/);
assert.match(core, /reportStartupFailure/);
assert.match(authController, /@Post\('startup-diagnostic'\)/);
assert.match(authService, /Book startup failed/);

assert.match(adminService, /startupState/);
assert.match(adminService, /startupReady/);
assert.match(adminService, /BusinessOperationalState|businessOperationalState/);
assert.match(adminService, /BusinessDocumentState|businessDocumentState/);
assert.match(adminService, /BusinessAuxiliaryState|businessAuxiliaryState/);
assert.match(adminUi, /Запуск Book/);
assert.match(adminUi, /masterStartupStateHtml/);

assert.match(legalService, /ensureTenantDemoState\(tenantId, '', 'readiness-self-heal'\)/);

console.log('startup diagnostics tests: OK');

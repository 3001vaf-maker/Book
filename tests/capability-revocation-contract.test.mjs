import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtime = readFileSync(new URL('../core/access-runtime.js', import.meta.url), 'utf8');
const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../server/src/saas-admin/saas-admin.service.ts', import.meta.url), 'utf8');

assert.match(admin, /CapabilityAccessChangeType\.DISABLED/);
assert.match(runtime, /Больше недоступны/);
assert.match(core, /workspace:access-updated/);
assert.match(core, /renderWorkspace\(\)/);
assert.doesNotMatch(runtime, /location\.reload/);

console.log('capability revocation contract tests: OK');

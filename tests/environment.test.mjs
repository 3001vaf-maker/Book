import assert from 'node:assert/strict';
import {
  LOCAL_STAGING_API_BASE,
  PRODUCTION_API_BASE,
  resolveApiBase,
  resolveRuntimeEnvironment,
} from '../core/environment.js';

assert.equal(resolveApiBase({ hostname: 'localhost' }), LOCAL_STAGING_API_BASE);
assert.equal(resolveApiBase({ hostname: '127.0.0.1' }), LOCAL_STAGING_API_BASE);
assert.equal(resolveApiBase({ hostname: '3001vaf-maker.github.io' }), PRODUCTION_API_BASE);
assert.equal(resolveApiBase({ hostname: 'example.test', override: 'https://staging-api.example.test/' }), 'https://staging-api.example.test');
assert.equal(resolveRuntimeEnvironment({ hostname: 'localhost' }), 'staging');
assert.equal(resolveRuntimeEnvironment({ hostname: '3001vaf-maker.github.io' }), 'production');

console.log('environment separation tests: OK');

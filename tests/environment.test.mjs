import assert from 'node:assert/strict';
import {
  ADMIN_APP_ORIGIN,
  BOOK_APP_ORIGIN,
  ACCOUNT_APP_ORIGIN,
  CODESPACES_STAGING_API_BASE,
  LOCAL_STAGING_API_BASE,
  PRODUCTION_API_BASE,
  resolveApiBase,
  resolveRuntimeEnvironment,
} from '../core/environment.js';

assert.equal(ADMIN_APP_ORIGIN, 'https://admin.va-tools.ru');
assert.equal(BOOK_APP_ORIGIN, 'https://book.va-tools.ru');
assert.equal(ACCOUNT_APP_ORIGIN, 'https://client.va-tools.ru');
assert.equal(PRODUCTION_API_BASE, 'https://api.va-tools.ru');
assert.equal(resolveApiBase({ hostname: 'localhost' }), LOCAL_STAGING_API_BASE);
assert.equal(resolveApiBase({ hostname: '127.0.0.1' }), LOCAL_STAGING_API_BASE);
assert.equal(resolveApiBase({ hostname: 'admin.va-tools.ru' }), PRODUCTION_API_BASE);
assert.equal(resolveApiBase({ hostname: 'book.va-tools.ru' }), PRODUCTION_API_BASE);
assert.equal(resolveApiBase({ hostname: 'client.va-tools.ru' }), PRODUCTION_API_BASE);
assert.equal(resolveApiBase({ hostname: 'api.va-tools.ru' }), PRODUCTION_API_BASE);
assert.equal(resolveApiBase({ hostname: '3001vaf-maker.github.io' }), '');
assert.equal(
  resolveApiBase({ hostname: 'ideal-spark-r7j5wxxqwqxhiv6-8080.app.github.dev' }),
  CODESPACES_STAGING_API_BASE,
);
assert.equal(resolveApiBase({ hostname: 'example.test', override: 'https://staging-api.example.test/' }), 'https://staging-api.example.test');
assert.equal(resolveRuntimeEnvironment({ hostname: 'localhost' }), 'staging');
assert.equal(resolveRuntimeEnvironment({ hostname: 'ideal-spark-r7j5wxxqwqxhiv6-8080.app.github.dev' }), 'staging');
assert.equal(resolveRuntimeEnvironment({ hostname: 'admin.va-tools.ru' }), 'production');
assert.equal(resolveRuntimeEnvironment({ hostname: 'book.va-tools.ru' }), 'production');
assert.equal(resolveRuntimeEnvironment({ hostname: '3001vaf-maker.github.io' }), 'staging');

console.log('environment separation tests: OK');

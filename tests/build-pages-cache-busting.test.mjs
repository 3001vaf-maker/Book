import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

process.env.GITHUB_SHA = 'admin-cache-test';
execFileSync(process.execPath, ['scripts/build-pages.mjs'], { stdio: 'pipe' });

try {
  const rootIndex = readFileSync('_site/index.html', 'utf8');
  const adminIndex = readFileSync('_site/admin/index.html', 'utf8');

  assert.match(rootIndex, /core\.js\?build=admin-cache-test/);
  assert.match(adminIndex, /admin\.js\?build=admin-cache-test/);
  assert.match(adminIndex, /admin\.css\?build=admin-cache-test/);
} finally {
  rmSync('_site', { recursive: true, force: true });
}

console.log('HTML asset cache-busting tests: OK');

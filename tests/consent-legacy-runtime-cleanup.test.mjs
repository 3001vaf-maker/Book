import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const roots = ['server/src', 'online-booking', 'main', 'settings', 'core'];
const extraFiles = ['core.js', 'document-migration.js'];
const forbidden = [
  'migrateLegacyConsents',
  'agreements.personalData',
  'agreements.mailings',
  'person.agreements',
  'bookingAccount.consents',
  'account.consents',
  'requiredConsentState',
  'ensureRequiredConsents',
  'consentState.allowed',
  'ensureCanonicalConsentEvents',
  'consentMigratedAt',
  'migratedFromEventId',
  'telegram-consent',
  'canSendMessages',
  'legacy-consent-migration',
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (/\.(?:js|mjs|ts)$/.test(name)) out.push(path);
  }
  return out;
}

const rootPath = decodeURIComponent(root.pathname);
const files = [
  ...roots.flatMap((dir) => walk(join(rootPath, dir))),
  ...extraFiles.map((file) => join(rootPath, file)),
];

const violations = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const token of forbidden) {
    if (source.includes(token)) violations.push(`${relative(rootPath, file)}: ${token}`);
  }
}

assert.deepEqual(violations, [], `Legacy consent runtime tails found:\n${violations.join('\n')}`);
console.log(`Consent legacy runtime cleanup tests: OK (${files.length} files)`);

import assert from 'node:assert/strict';
import fs from 'node:fs';

assert.equal(
  fs.existsSync('journal/record-payment.js'),
  false,
  'Journal View must not retain the retired Record payment subflow while the View is intentionally minimal.',
);

console.log('Retired Journal Record payment subflow is absent');

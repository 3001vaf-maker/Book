import assert from 'node:assert/strict';
import fs from 'node:fs';

const accountShell = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const profileStart = accountShell.indexOf('async function renderProfile');
const historyStart = accountShell.indexOf('async function renderHistory');
assert.ok(profileStart >= 0 && historyStart > profileStart, 'person profile render block must exist');

const profile = accountShell.slice(profileStart, historyStart);
assert.match(profile, /action:\s*\{\s*label:\s*'Записаться',\s*data:\s*'data-person-booking'\s*\}/);
assert.doesNotMatch(profile, /primaryAction:\s*button\('Записаться'/);
assert.match(profile, /\[data-person-booking\][\s\S]*?handlers\.onStartBooking/);

console.log('person profile booking action stays in header');

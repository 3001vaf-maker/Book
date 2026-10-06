import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../journal/record-view.js', import.meta.url), 'utf8');

assert.match(source, /setV2ZHeaderRows\(m, \[confirmedControl, attendanceControl\]\)/);
assert.match(source, /root\.innerHTML = `<div class="record-screen record-screen--state-view">\$\{card\}<\/div>`;/);
assert.doesNotMatch(source, /\$\{card\}\$\{statusControl\}/);
assert.match(source, /m\.querySelector\('\[data-record-view-confirmed\]'\)/);
assert.match(source, /m\.querySelectorAll\('\[data-record-view-attendance\]'\)/);

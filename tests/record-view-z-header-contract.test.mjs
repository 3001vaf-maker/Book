import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../journal/journal-view.js', import.meta.url), 'utf8');

assert.match(source, /export function openJournalView/);
assert.match(source, /mountRecordZ\(\{/);
assert.match(source, /className: 'journal-view-z'/);
assert.match(source, /recordConfirmationMiniCard\(\{/);
assert.doesNotMatch(source, /openRecordEditFlow|openRecords\(|updateRecord|moveRecord|cancelRecord|deleteRecord/);

console.log('Journal View Z contract: OK');

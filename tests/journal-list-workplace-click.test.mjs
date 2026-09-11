import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const listSource = readFileSync(new URL('../journal/список.js', import.meta.url), 'utf8');
const journalSource = readFileSync(new URL('../journal/journal.js', import.meta.url), 'utf8');

assert.match(listSource, /renderJournalList\(root, \{ mode = 'flow', workplaceId = ALL_WORKPLACES_ID \}/);
assert.match(listSource, /workplaceId === ALL_WORKPLACES_ID\s*\? allRecords\s*:\s*allRecords\.filter/);
assert.match(listSource, /interactive: Boolean\(id\)/);
assert.match(listSource, /data-journal-list-record=/);
assert.match(listSource, /openRecordView\(record\)/);
assert.match(journalSource, /renderJournalList\(viewRoot, \{ mode: listMode, workplaceId: selectedWorkplaceId \}\)/);

console.log('journal list workplace/click tests: OK');

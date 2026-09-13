import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const timelineSource = readFileSync(new URL('../ui/time/journal-day.js', import.meta.url), 'utf8');
const timelineCss = readFileSync(new URL('../ui/time/time.css', import.meta.url), 'utf8');
const journalSource = readFileSync(new URL('../journal/journal.js', import.meta.url), 'utf8');

assert.match(timelineSource, /data-journal-work-field=/);
assert.match(timelineSource, /field\.addEventListener\('click',\s*open\)/);
assert.match(timelineSource, /onWorkFieldClick\(\{\s*workplaceId\s*\}\)/);
assert.match(timelineCss, /\.journal-work-field\{[^}]*pointer-events:auto[^}]*cursor:pointer/);
assert.match(timelineCss, /\.journal-work-field__usage\{[^}]*pointer-events:none/);
assert.match(journalSource, /const recordsChangedHandler = \(\) => renderView\(\)/, 'Every active Journal view, including Month, must rerender after server record changes');
assert.match(journalSource, /const ddsChangedHandler = \(\) => renderView\(\)/, 'Every active Journal view, including Day, must rerender after payment cancellation or refund');
assert.doesNotMatch(journalSource, /activeView === 'day' \|\| activeView === 'list'\) renderView/, 'Month must not be excluded from record-change refresh');
assert.doesNotMatch(journalSource, /activeView === 'list' \|\| activeView === 'month'\) renderView/, 'Day must not be excluded from finance refresh');

console.log('journal all-records click tests: OK');

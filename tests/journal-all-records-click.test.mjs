import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const timelineSource = readFileSync(new URL('../ui/time/journal-day.js', import.meta.url), 'utf8');
const timelineCss = readFileSync(new URL('../ui/time/time.css', import.meta.url), 'utf8');

assert.match(timelineSource, /data-journal-work-field=/);
assert.match(timelineSource, /field\.addEventListener\('click',\s*open\)/);
assert.match(timelineSource, /onWorkFieldClick\(\{\s*workplaceId\s*\}\)/);
assert.match(timelineCss, /\.journal-work-field\{[^}]*pointer-events:auto[^}]*cursor:pointer/);
assert.match(timelineCss, /\.journal-work-field__usage\{[^}]*pointer-events:none/);

console.log('journal all-records click tests: OK');

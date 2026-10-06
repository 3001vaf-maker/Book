import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtime = readFileSync(new URL('../ui/record/runtime.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../ui/record/record.css', import.meta.url), 'utf8');

assert.match(runtime, /\[aria-label="Режим записи"\]/, 'Record mode switch must be explicitly classified as a Z Header control.');
assert.match(runtime, /\[data-record-person-search\]/, 'Record person search must be explicitly classified as a Z Header control.');
assert.match(runtime, /dataset\.v2ZHeaderControl/, 'Promoted controls must carry the explicit Z Header role marker.');
assert.match(runtime, /ui-search-divider[^\n]*remove\(\)/, 'The old search divider must be removed once search belongs to Z Header.');
assert.doesNotMatch(runtime, /cost|amount|price[^\n]{0,80}v2ZHeaderControl/i, 'Data-editing cost controls must never be promoted by the Record Z Header rule.');
assert.match(css, /\.record-screen\{[^}]*padding:0 18px 28px/, 'Record Body must not keep the retired 56px top spacer below Z Header.');
assert.match(css, /\.record-screen--time\{[^}]*justify-content:flex-start/, 'Time selection must start at the Z Body top instead of being vertically centered.');

console.log('record Z header role contract: OK');

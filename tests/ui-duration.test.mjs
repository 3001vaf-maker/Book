import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { durationText } from '../ui/ui.js';

assert.equal(durationText(0), '0 мин');
assert.equal(durationText(45), '45 мин');
assert.equal(durationText(60), '1 ч');
assert.equal(durationText(90), '1 ч 30 мин');
assert.equal(durationText('135'), '2 ч 15 мин');

const procedureFormSource = readFileSync(new URL('../settings/service/procedures/form.js', import.meta.url), 'utf8');
const recordCreationSource = readFileSync(new URL('../journal/record.js', import.meta.url), 'utf8');
const recordViewSource = readFileSync(new URL('../journal/record-view.js', import.meta.url), 'utf8');

assert.match(procedureFormSource, /durationPicker\(\{ label: 'Длительность'/);
assert.match(recordCreationSource, /durationPicker\(\{ name: 'recordDuration'/);
assert.match(recordViewSource, /durationPicker\(\{ name: 'recordViewProcedureDuration'/);
assert.doesNotMatch(recordViewSource, /timePicker\(\{ name: 'recordViewProcedureDuration'/);

console.log('ui-duration tests: OK');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { durationText } from '../ui/ui.js';

assert.equal(durationText(0), '0 мин');
assert.equal(durationText(45), '45 мин');
assert.equal(durationText(60), '1 ч');
assert.equal(durationText(90), '1 ч 30 мин');
assert.equal(durationText('135'), '2 ч 15 мин');

const procedureFormSource = readFileSync(new URL('../core/service/procedures/form.js', import.meta.url), 'utf8');
const recordsSource = readFileSync(new URL('../core/records.js', import.meta.url), 'utf8');
const journalViewSource = readFileSync(new URL('../journal/journal-view.js', import.meta.url), 'utf8');

assert.match(procedureFormSource, /durationPicker\(\{ label: 'Длительность'/);
assert.match(recordsSource, /durationText\(/);
assert.doesNotMatch(journalViewSource, /durationPicker\(|timePicker\(|openRecordEditFlow/);

console.log('ui-duration tests: OK');

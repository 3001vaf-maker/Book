import assert from 'node:assert/strict';
import { durationText } from '../ui/ui.js';

assert.equal(durationText(0), '0 мин');
assert.equal(durationText(45), '45 мин');
assert.equal(durationText(60), '1 ч');
assert.equal(durationText(90), '1 ч 30 мин');
assert.equal(durationText('135'), '2 ч 15 мин');

console.log('ui-duration tests: OK');

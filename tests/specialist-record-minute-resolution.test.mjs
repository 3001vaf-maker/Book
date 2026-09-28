import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const specialistCreate = readFileSync(new URL('../journal/record.js', import.meta.url), 'utf8');
const specialistEdit = readFileSync(new URL('../journal/record-view.js', import.meta.url), 'utf8');
const specialistBreak = readFileSync(new URL('../journal/break-view.js', import.meta.url), 'utf8');
const clientBooking = readFileSync(new URL('../online-booking/booking.js', import.meta.url), 'utf8');
const sharedRecord = readFileSync(new URL('../ui/record/runtime.js', import.meta.url), 'utf8');

assert.doesNotMatch(specialistCreate, /getBookingSettings\(\)\.slotStep|function\s+recordSlotStep\s*\(/);
assert.match(specialistCreate, /function\s+recordStartTimes[\s\S]*duration:\s*1[\s\S]*step:\s*1/);
assert.match(specialistCreate, /function\s+availableConfirmationTimes[\s\S]*step:\s*1/);
assert.match(specialistCreate, /function\s+blockEndValues[\s\S]*step:\s*1/);
assert.match(specialistEdit, /listAvailableStartTimes\([\s\S]*step:\s*1/);
assert.match(specialistBreak, /function\s+availableBreakStarts[\s\S]*duration:\s*1[\s\S]*step:\s*1/);
assert.match(specialistBreak, /function\s+availableBreakEnds[\s\S]*step:\s*1/);

assert.match(clientBooking, /step:\s*state\.settings\.slotStep/);

assert.match(sharedRecord, /workspaceHeaderContext\(/);
assert.match(sharedRecord, /kind:\s*'avatar'/);
assert.match(sharedRecord, /data-v2-primary-action|dataset\.v2PrimaryAction/);
assert.match(sharedRecord, /kind:\s*'chat'/);
assert.match(sharedRecord, /mountV2ZLayer/);

console.log('specialist Record minute-resolution separation: OK');

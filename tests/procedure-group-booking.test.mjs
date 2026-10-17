import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialProcedure } from '../core/service/procedures/form.js';

const fresh = initialProcedure();
assert.deepEqual(fresh.groupBooking, { enabled: false, capacity: 2 });

const existing = initialProcedure({
  id: 'p1',
  name: 'Группа',
  groupBooking: { enabled: true, capacity: 6 },
  workplaces: [],
});
assert.deepEqual(existing.groupBooking, { enabled: true, capacity: 6 });

const formSource = readFileSync(new URL('../core/service/procedures/form.js', import.meta.url), 'utf8');
assert.match(formSource, /title:\s*'Групповая запись'/);
assert.match(formSource, /data-procedure-group-toggle/);
assert.match(formSource, /name:\s*'procedureGroupCapacity'/);
assert.match(formSource, /label:\s*'Максимум людей'/);
assert.match(formSource, /groupBooking:\s*\{/);

const recordsSource = readFileSync(new URL('../core/records.js', import.meta.url), 'utf8');
assert.match(recordsSource, /function groupCapacity\(procedures = \[\]\)/);
assert.match(recordsSource, /source\?\.groupBooking\?\.enabled !== true/);
assert.match(recordsSource, /Math\.min\(\.\.\.capacities\)/);
assert.match(recordsSource, /const groupMode = capacity > 1/);
assert.match(recordsSource, /selected\.size < capacity/);
assert.match(recordsSource, /group:\s*capacity > 1 \?/);
assert.doesNotMatch(recordsSource, /data-record-group-capacity-save|openGroupCapacity|label:\s*'Количество мест'/);

const procedureServerSource = readFileSync(new URL('../server/src/procedure/procedure.service.ts', import.meta.url), 'utf8');
assert.match(procedureServerSource, /groupBooking:\s*\{/);
assert.match(procedureServerSource, /groupEnabled/);

const recordServerSource = readFileSync(new URL('../server/src/record/record.service.ts', import.meta.url), 'utf8');
assert.match(recordServerSource, /function\s+groupCapacityFromProcedures/);
assert.match(recordServerSource, /normalizeGroup\(input\.group,\s*person,\s*groupCapacityFromProcedures\(procedureSnapshots\)\)/);

console.log('procedure group booking tests: OK');

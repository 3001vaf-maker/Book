import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialProcedure } from '../settings/service/procedures/form.js';

const fresh = initialProcedure();
assert.deepEqual(fresh.groupBooking, { enabled: false, capacity: 2 });

const existing = initialProcedure({
  id: 'p1',
  name: 'Группа',
  groupBooking: { enabled: true, capacity: 6 },
  workplaces: [],
});
assert.deepEqual(existing.groupBooking, { enabled: true, capacity: 6 });

const formSource = readFileSync(new URL('../settings/service/procedures/form.js', import.meta.url), 'utf8');
assert.match(formSource, /title:\s*'Групповая запись'/);
assert.match(formSource, /data-procedure-group-toggle/);
assert.match(formSource, /name:\s*'procedureGroupCapacity'/);
assert.match(formSource, /label:\s*'Максимум людей'/);
assert.match(formSource, /groupBooking:\s*\{/);

const recordSource = readFileSync(new URL('../journal/record.js', import.meta.url), 'utf8');
assert.match(recordSource, /function\s+groupCapacityForSelectedProcedures/);
assert.match(recordSource, /catalog\?\.groupBooking\?\.enabled\s*!==\s*true/);
assert.match(recordSource, /Math\.min\(\.\.\.capacities\)/);
assert.match(recordSource, /title:\s*groupMode\s*\?\s*'Выбор участников'/);
assert.match(recordSource, /selectedPeople\.size\s*>=\s*groupCapacity/);
assert.match(recordSource, /group:\s*capacity\s*>\s*1\s*\?/);
assert.doesNotMatch(recordSource, /data-record-group-capacity-save|openGroupCapacity|label:\s*'Количество мест'/);

const procedureServerSource = readFileSync(new URL('../server/src/procedure/procedure.service.ts', import.meta.url), 'utf8');
assert.match(procedureServerSource, /groupBooking:\s*\{/);
assert.match(procedureServerSource, /groupEnabled/);

const recordServerSource = readFileSync(new URL('../server/src/record/record.service.ts', import.meta.url), 'utf8');
assert.match(recordServerSource, /function\s+groupCapacityFromProcedures/);
assert.match(recordServerSource, /normalizeGroup\(input\.group,\s*person,\s*groupCapacityFromProcedures\(procedureSnapshots\)\)/);

console.log('procedure group booking tests: OK');

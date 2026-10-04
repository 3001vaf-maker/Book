import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isGroupRecord,
  normalizeRecordGroup,
  recordAvailableSpots,
  recordCapacity,
  recordGroupIsFull,
  recordParticipantCount,
  recordParticipants,
  setRecordGroupCapacity,
  setRecordParticipants,
} from '../core/record/index.js';

const alex = { key: 'alex', name: 'Alex' };
const maria = { key: 'maria', name: 'Maria' };
const ivan = { key: 'ivan', name: 'Ivan' };

const group = normalizeRecordGroup({ capacity: 3, participants: [alex, maria] }, alex);
assert.equal(group.capacity, 3);
assert.deepEqual(group.participants.map((person) => person.key), ['alex', 'maria']);

const record = { id: 'r1', person: alex, group };
assert.equal(isGroupRecord(record), true);
assert.equal(recordCapacity(record), 3);
assert.equal(recordParticipantCount(record), 2);
assert.equal(recordAvailableSpots(record), 1);
assert.equal(recordGroupIsFull(record), false);
assert.deepEqual(recordParticipants(record).map((person) => person.key), ['alex', 'maria']);

const full = setRecordParticipants(record, [alex, maria, ivan]);
assert.ok(full);
assert.equal(recordParticipantCount(full), 3);
assert.equal(recordGroupIsFull(full), true);

assert.equal(setRecordGroupCapacity(full, 2), null, 'capacity cannot be reduced below participant count');
const expanded = setRecordGroupCapacity(full, 5);
assert.equal(recordCapacity(expanded), 5);
assert.equal(recordAvailableSpots(expanded), 2);

const individual = { id: 'r2', person: alex };
assert.equal(isGroupRecord(individual), false);
assert.equal(recordCapacity(individual), 1);
assert.equal(recordParticipantCount(individual), 1);

const creationSource = readFileSync(new URL('../journal/record.js', import.meta.url), 'utf8');
assert.match(creationSource, /label:\s*'Количество мест'/);
assert.match(creationSource, /label:\s*'Групповая запись'/);
assert.match(creationSource, /data-record-group-person/);
assert.match(creationSource, /Можно выбрать не больше/);
assert.match(creationSource, /groupText:\s*groupCapacity\s*>\s*1/);
assert.match(creationSource, /normalizeRecordGroup\(\{/);

const viewSource = readFileSync(new URL('../journal/record-view.js', import.meta.url), 'utf8');
assert.match(viewSource, /id:\s*'group-capacity'/);
assert.match(viewSource, /id:\s*'group-participants'/);
assert.match(viewSource, /recordParticipantCount/);
assert.match(viewSource, /recordCapacity/);

const serverSource = readFileSync(new URL('../server/src/record/record.service.ts', import.meta.url), 'utf8');
assert.match(serverSource, /function\s+normalizeGroup/);
assert.match(serverSource, /const\s+group\s*=\s*normalizeGroup\(input\.group,\s*person\)/);
assert.match(serverSource, /groupChanged/);

console.log('group record tests: OK');

import fs from 'node:fs';

const failures = [];
const expect = (value, message) => { if (!value) failures.push(message); };
const read = (path) => fs.readFileSync(path, 'utf8');

const recordData = read('core/record/data.js');
const recordRead = read('core/record/read.js');
const recordService = read('core/record/service.js');
const recordEvents = read('core/record/events.js');
const recordState = read('core/record/state.js');
const serverRecord = read('server/src/record/record.service.ts');
const recordsUi = read('core/records/records.js');

expect(!/availability|financial-model|getAllPeople|record-events|record-state|status\s*=|attendance|confirmed|cancelRecord|createRecord|updateRecord|moveRecord/.test(recordData), 'core/record/data.js must remain persistence-only.');
expect(/getRecordRows/.test(recordData) && /insertRecordRow/.test(recordData) && /patchRecordRow/.test(recordData) && /deleteRecordRow/.test(recordData), 'Record persistence gateway API is incomplete.');
expect(/from '.\/data\.js'/.test(recordRead) && /from '.\/events\.js'/.test(recordRead) && /from '.\/state\.js'/.test(recordRead), 'Record read model must compose storage, lifecycle and state.');
expect(/checkTimeAvailability/.test(recordService) && /appendRecordEvent/.test(recordService), 'Record command service must own mutation validation and lifecycle facts.');
expect(/appendRecordEvent/.test(recordEvents) && /RECORD_EVENT_CATEGORIES/.test(recordEvents), 'Record events owner is incomplete.');
expect(/projectRecordLifecycle/.test(recordState), 'Record state must be projected from lifecycle facts.');
expect(/export class RecordService/.test(serverRecord), 'Server RecordService must remain canonical.');
expect(fs.existsSync('core/records/records.js') && /export function openRecords/.test(recordsUi), 'Application Records flow must have one owner in core/records/records.js.');
expect(!fs.existsSync('records/records.js'), 'Root Records owner must not remain outside Core.');
expect(!fs.existsSync('core/records.js'), 'Core must not contain Records JS directly.');
expect(!fs.existsSync('journal/record.js'), 'Journal must not own a second Record flow.');
expect(!fs.existsSync('journal/record-view.js'), 'Journal View must not masquerade as a Record owner.');
expect(!fs.existsSync('journal/record-creation-x.js'), 'Journal must not own a second Record creation flow.');

if (failures.length) {
  console.error('Record ownership check failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Record ownership compatibility check passed.');

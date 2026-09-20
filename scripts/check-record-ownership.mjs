import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const errors = [];
const read = (path) => readFileSync(join(root, path), 'utf8');

function walk(dir) {
  const result = [];
  for (const name of readdirSync(join(root, dir))) {
    const path = join(root, dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...walk(relative(root, path)));
    else if (/\.(?:js|mjs)$/.test(name)) result.push(relative(root, path).replaceAll('\\', '/'));
  }
  return result;
}

const recordData = read('core/record/data.js');
const recordRead = read('core/record/read.js');
const recordService = read('core/record/service.js');
const recordEvents = read('core/record/events.js');
const recordState = read('core/record/state.js');
const serverRecord = read('server/src/record/record.service.ts');
const serverBusinessState = read('server/src/business-state/business-state.service.ts');
const serverBooking = read('server/src/online-booking/online-booking.service.ts');
const accountShell = read('online-booking/account-shell.js');
const prismaSchema = read('server/prisma/schema.prisma');

if (/availability|financial-model|getAllPeople|record-events|record-state|status\s*=|attendance|confirmed|cancelRecord|createRecord|updateRecord|moveRecord/.test(recordData)) {
  errors.push('core/record/data.js: Record data must remain persistence-only');
}
if (!/getRecordRows/.test(recordData)
  || !/insertRecordRow/.test(recordData)
  || !/patchRecordRow/.test(recordData)
  || !/deleteRecordRow/.test(recordData)
  || !/getRecordEventRows/.test(recordData)
  || !/insertRecordEventRow/.test(recordData)
  || !/deleteRecordEventRows/.test(recordData)) {
  errors.push('core/record/data.js: persistence gateway API is incomplete');
}

if (!/from '.\/data\.js'/.test(recordRead)
  || !/from '.\/events\.js'/.test(recordRead)
  || !/from '.\/state\.js'/.test(recordRead)
  || !/hydrateRecordSettlement/.test(recordRead)) {
  errors.push('core/record/read.js: read model must compose storage + lifecycle + finance');
}

if (!/from '.\/data\.js'/.test(recordService)
  || !/from '.\/read\.js'/.test(recordService)
  || !/from '.\/events\.js'/.test(recordService)
  || !/checkTimeAvailability/.test(recordService)) {
  errors.push('core/record/service.js: command service must own Record mutations');
}
if (!/appendRecordEvent/.test(recordService) || !/RECORD_EVENT_TYPES\.CANCELLED/.test(recordService) || !/RECORD_EVENT_TYPES\.RESCHEDULED/.test(recordService)) {
  errors.push('core/record/service.js: Record commands must append immutable create/reschedule/cancel and lifecycle history facts');
}
if (!/actor:\s*\{/.test(recordService) || !/profileId/.test(recordService) || !/accountId/.test(recordService) || !/subject:\s*recordSubject/.test(recordService)) {
  errors.push('core/record/service.js: Record history must preserve actor and Person subject context');
}

if (!/from '.\/data\.js'/.test(recordEvents)
  || !/appendRecordEvent/.test(recordEvents)
  || !/RESCHEDULED:\s*'rescheduled'/.test(recordEvents)
  || !/RECORD_EVENT_CATEGORIES/.test(recordEvents)
  || !/insertRecordEventRow/.test(recordEvents)
  || /localStorage/.test(recordEvents)) {
  errors.push('core/record/events.js: Record Events must own lifecycle meaning while persistence stays in core/record/data.js');
}
if (!/projectRecordLifecycle/.test(recordState) || !/RECORD_EVENT_TYPES/.test(recordState)) {
  errors.push('core/record/state.js: Record State must be projected from lifecycle facts');
}

if (!/export class RecordService/.test(serverRecord)
  || !/this\.time\.checkAvailability/.test(serverRecord)
  || !/this\.procedures\.snapshots/.test(serverRecord)
  || !/this\.finance\.calculateSettlement/.test(serverRecord)
  || !/async listForPeople/.test(serverRecord)) {
  errors.push('server RecordService must compose through Time, Procedure and Finance Settlement owners');
}
if (/createOnlineBookingRecord|publicBookingOccupancy|bookingRecordSnapshot/.test(serverBusinessState)) {
  errors.push('BusinessState must not own Record creation, occupancy or Booking snapshot adapters');
}
if (/recordSnapshot|manualRecordViews|initialRequestSnapshot|function\s+rangesOverlap|function\s+procedureCost/.test(serverBooking)) {
  errors.push('Online Booking must not own Record lifecycle, Finance, Procedure price or Time algorithms');
}
if (!/this\.records\.create/.test(serverBooking) || !/this\.records\.publicOccupancy/.test(serverBooking)) {
  errors.push('Online Booking must call canonical RecordService');
}
if (/recordSnapshot/.test(accountShell) || !/getAccountRecords/.test(accountShell)) {
  errors.push('Account history must consume canonical Records, never BookingRequest snapshots');
}
if (!/model Record\s*\{/.test(prismaSchema)
  || !/model RecordEvent\s*\{/.test(prismaSchema)
  || /model BusinessRecord\s*\{/.test(prismaSchema)
  || /model BusinessRecordEvent\s*\{/.test(prismaSchema)) {
  errors.push('Prisma must expose canonical Record / RecordEvent model names');
}
if (!/@@map\("BusinessRecord"\)/.test(prismaSchema) || !/@@map\("BusinessRecordEvent"\)/.test(prismaSchema)) {
  errors.push('Record Prisma rename must remain non-destructive until the physical-table migration is explicitly released');
}
if (/recordEvent\.upsert/.test(serverBusinessState)
  || !/recordEvent\.findUnique/.test(serverBusinessState)
  || !/recordEvent\.create/.test(serverBusinessState)
  || !/Событие Record неизменяемо/.test(serverBusinessState)) {
  errors.push('RecordEvent persistence must be append-only and idempotent');
}

const directDataImport = /(?:from\s+['"][^'"]*core\/record\/data\.js['"]|import\s*\(\s*['"][^'"]*core\/record\/data\.js['"]\s*\))/;
for (const path of [...walk('journal'), ...walk('main'), ...walk('settings'), ...walk('tests')]) {
  const source = read(path);
  if (directDataImport.test(source)) {
    errors.push(`${path}: must use core/record/index.js instead of the private data atom`);
  }
}

if (errors.length) {
  console.error('record ownership check: FAILED');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('record ownership check: OK');

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
const onlineBookingUi = read('online-booking/booking.js');
const peopleUi = read('main/people/people.js');
const coreUi = read('core.js');
const prismaSchema = read('server/prisma/schema.prisma');
const journalRecordUi = read('journal/record.js');
const journalRecordViewUi = read('journal/record-view.js');
const journalBreakViewUi = read('journal/break-view.js');
const sharedRecordUi = read('ui/record/runtime.js');


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
if (/finance\/index\.js/.test(recordService) || /calculateSettlement|repriceSettlement|normalizeRecordSettlement/.test(recordService)) {
  errors.push('core/record/service.js: Record commands must not calculate or persist Settlement');
}
if (!/['"]finance['"]/.test(recordService) || !/dataPatchFrom/.test(recordService)) {
  errors.push('core/record/service.js: Finance projection fields must be filtered from Record persistence');
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
  || !/this\.finance\.upsertSettlement/.test(serverRecord)
  || !/this\.finance\.settlementForSource/.test(serverRecord)
  || !/async listForPeople/.test(serverRecord)) {
  errors.push('server RecordService must compose through Time, Procedure and Finance Settlement owners without owning Settlement persistence');
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
if (/recordSnapshot/.test(accountShell)
  || !/globalAccountRecords\(accountId/.test(serverBooking)
  || !/const rows = await this\.getMyRecords\(link\.tenantId, accountId\)/.test(serverBooking)
  || !/return this\.records\.listForPeople\(tenantId, people\)/.test(serverBooking)) {
  errors.push('Account history must consume canonical Records through the global account Record projection, never BookingRequest snapshots');
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

if (!/mountRecordZ/.test(journalRecordUi)
  || !/setRecordPrimaryAction/.test(journalRecordUi)
  || !/bindRecordSettings/.test(journalRecordUi)
  || !/mountRecordZ/.test(journalRecordViewUi)
  || !/mountRecordZ/.test(journalBreakViewUi)) {
  errors.push('Specialist Record surfaces must consume the canonical Shared Record Z/A/C owner');
}

if (!/recordTimeRows/.test(journalRecordUi)
  || /class=["'`](?:record-time-option|record-time-chip)/.test(journalRecordUi)) {
  errors.push('journal/record.js must consume Shared Record time-row UI instead of drawing local time buttons');
}

for (const [path, source] of [
  ['journal/record.js', journalRecordUi],
  ['journal/record-view.js', journalRecordViewUi],
  ['journal/break-view.js', journalBreakViewUi],
]) {
  if (/record-modal-actions|record-modal--flow/.test(source)) {
    errors.push(`${path}: Record Z must not own local action rows or a parallel large modal flow`);
  }
}

if (!/data-record-owner-settings/.test(sharedRecordUi)
  || !/(?:data-v2-primary-action|dataset\.v2PrimaryAction)/.test(sharedRecordUi)
  || !/mountV2ZLayer/.test(sharedRecordUi)) {
  errors.push('ui/record/runtime.js must remain the canonical Record Z/A/C presentation owner');
}

const sharedV2Runtime = read('ui/v2/index.js');
if (!/mountV2ZLayer/.test(sharedV2Runtime)
  || !/stack\s*=\s*false/.test(sharedV2Runtime)
  || !/initV2Swipe\(node,\s*\{\s*onRight:\s*close,\s*revealDeck:\s*false\s*\}\)/.test(sharedV2Runtime)
  || !/book:v2-context-changed/.test(sharedV2Runtime)) {
  errors.push('Shared Record Z stack must close one top sheet on right swipe and resync Header context after close');
}

const directDataImport = /(?:from\s+['"][^'"]*core\/record\/data\.js['"]|import\s*\(\s*['"][^'"]*core\/record\/data\.js['"]\s*\))/;
for (const path of [...walk('journal'), ...walk('main'), ...walk('settings'), ...walk('tests')]) {
  const source = read(path);
  if (directDataImport.test(source)) {
    errors.push(`${path}: must use core/record/index.js instead of the private data atom`);
  }
}


const recordStartTimesSource = journalRecordUi.slice(
  journalRecordUi.indexOf('function recordStartTimes'),
  journalRecordUi.indexOf('function openRecordTimeNotice')
);
if (!/duration:\s*recordSlotStep\(\)/.test(recordStartTimesSource)
  || !/step:\s*recordSlotStep\(\)/.test(recordStartTimesSource)
  || !/getBookingSettings\(\)\.slotStep/.test(journalRecordUi)) {
  errors.push('Journal Record start-time selection must consume the canonical bookingSettings.slotStep owner');
}

if (!/kind:\s*'avatar'/.test(sharedRecordUi)
  || !/d:\s*chatPersonKey\s*\?/.test(sharedRecordUi)
  || !/settings\s*\?\s*\{/.test(sharedRecordUi)) {
  errors.push('Shared Record Header must always own A as avatar/photo, expose settings only by context, and show D only after a person is fixed');
}

if (!/lines:\s*\[/.test(sharedRecordUi)
  || !/subtitle:\s*'Время'/.test(sharedRecordUi)
  || !/subtitle:\s*'Скидка'/.test(sharedRecordUi)
  || !/subtitle:\s*'Сумма'/.test(sharedRecordUi)) {
  errors.push('Shared Record confirmation must use the Mini Card data-line owner and the canonical Время / Скидка / Сумма metrics');
}

if (!/recordWorkplaceCards\(/.test(onlineBookingUi)
  || !/recordProcedureList\(/.test(onlineBookingUi)
  || !/recordTimeRows\(/.test(onlineBookingUi)
  || !/recordConfirmationMiniCard\(/.test(onlineBookingUi)) {
  errors.push('Online booking must consume the same canonical Shared Record step owners as specialist booking');
}

if (/bookingChoiceCards\(|bookingTimeGroups\(|v2ServiceStickers\(|v2-confirmation/.test(onlineBookingUi)) {
  errors.push('Online booking must not restore parallel visual owners for canonical booking steps');
}

const bookingHeaderSource = onlineBookingUi.slice(
  onlineBookingUi.indexOf('function bookingHeaderMarkup'),
  onlineBookingUi.indexOf('function bookingActionForStep')
);
if (!/image:\s*representativePhoto\(state\)/.test(bookingHeaderSource)
  || !/b:\s*'Запись'/.test(bookingHeaderSource)
  || !/d:\s*null/.test(bookingHeaderSource)) {
  errors.push('Online booking Header must use the professional photo in A, Запись in B, and no D chat on booking steps');
}

if (!/workplaceCardAppearance\(workplace\)/.test(onlineBookingUi)
  || !/workplaceCardFields\(workplace, workplace\.cardProfile \|\| profile\)/.test(onlineBookingUi)
  || !/entityVisualCard\(/.test(sharedRecordUi)
  || !/v2-profile-workplaces/.test(sharedRecordUi)) {
  errors.push('Booking workplace selection must render the exact saved workplace business-card owner used by Profile');
}

if (!/listEntry\(/.test(sharedRecordUi)
  || !/listEntries\(/.test(sharedRecordUi)
  || !/miniCard\(/.test(sharedRecordUi)
  || !/v2RailCard\(/.test(sharedRecordUi)
  || !/timeSlots\(/.test(sharedRecordUi)) {
  errors.push('Record UI must reuse the existing History list, Mini Card, metric cubes and Shared Time owners');
}

if (errors.length) {
  console.error('record ownership check: FAILED');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('record ownership check: OK');

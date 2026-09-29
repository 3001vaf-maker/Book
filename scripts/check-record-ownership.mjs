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
const sharedRecordCss = read('ui/record/record.css');
const sharedInputsCss = read('ui/inputs/inputs.css');


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

const sharedProcedureListSource = sharedRecordUi.slice(
  sharedRecordUi.indexOf('export function recordProcedureList'),
  sharedRecordUi.indexOf('export function recordPersonList')
);
if (!/v2-sticker-list/.test(sharedProcedureListSource)
  || !/v2-service-sticker/.test(sharedProcedureListSource)
  || !/v2-service-sticker__selector/.test(sharedProcedureListSource)
  || !/aria-pressed/.test(sharedProcedureListSource)
  || !/\.v2-sticker-list\{[^}]*gap:\s*10px/.test(sharedRecordCss)
  || !/--record-procedure-name-size/.test(sharedProcedureListSource)
  || !/\.v2-service-sticker\{[^}]*background:#fff/.test(sharedRecordCss)
  || /\.v2-service-sticker\{[^}]*background:var\(--v2-beige\)/.test(sharedRecordCss)
  || !/\.v2-service-sticker__text strong\{[^}]*white-space:\s*nowrap[^}]*text-overflow:\s*clip/.test(sharedRecordCss)
  || !/\.v2-service-sticker\.is-selected \.v2-service-sticker__selector::after\{content:'✓'\}/.test(sharedRecordCss)) {
  errors.push('Shared Record procedure selection must use a neutral white sticker surface, keep full procedure names on one line without ellipsis, preserve spacing, and show the selected checkmark');
}

const procedureSettingsSource = journalRecordUi.slice(
  journalRecordUi.indexOf('bindRecordSettings(modalRoot, () => {', journalRecordUi.indexOf('function renderProceduresStep')),
  journalRecordUi.indexOf('function openProcedureSettings')
);
if (!/button\('Добавить из прайса',[\s\S]*variant:\s*'secondary'/.test(procedureSettingsSource)
  || !/button\('\+ Добавить процедуру'/.test(procedureSettingsSource)
  || /const menu = list\(/.test(procedureSettingsSource)) {
  errors.push('Record procedure settings must use the canonical white "Добавить из прайса" button and black "+ Добавить процедуру" button');
}

const recordPricePickerSource = journalRecordUi.slice(
  journalRecordUi.indexOf('function openPriceProcedurePicker'),
  journalRecordUi.indexOf('function renderProceduresStep')
);
const recordConfirmationProcedurePickerSource = journalRecordUi.slice(
  journalRecordUi.indexOf('function openConfirmationProcedurePicker'),
  journalRecordUi.indexOf('function renderConfirmationStep')
);
const existingRecordProcedurePickerSource = journalRecordViewUi.slice(
  journalRecordViewUi.indexOf('function openAddProcedurePicker'),
  journalRecordViewUi.indexOf('function openSalePicker')
);
const onlineBookingProcedureSource = onlineBookingUi.slice(
  onlineBookingUi.indexOf('function renderProcedures'),
  onlineBookingUi.indexOf('function renderDates')
);

for (const [name, source] of [
  ['Record workplace price picker', recordPricePickerSource],
  ['Record confirmation add-procedure picker', recordConfirmationProcedurePickerSource],
  ['Existing Record add-procedure picker', existingRecordProcedurePickerSource],
  ['Online booking procedure picker', onlineBookingProcedureSource],
]) {
  if (!/recordProcedureList\(/.test(source)) {
    errors.push(`${name} must consume the Shared Record procedure sticker owner`);
  }
}

if (!/recordTimeRows\(values,\s*\{\s*data:\s*'data-record-time'/.test(journalRecordUi)
  || !/recordTimeRows\(values,\s*\{[\s\S]*?data:\s*'data-block-end'/.test(journalRecordUi)
  || /recordTimeRows\(\{\s*items:/.test(journalRecordUi)) {
  errors.push('journal/record.js must call Shared recordTimeRows(items, options) with the canonical positional contract');
}

const sharedPersonListSource = sharedRecordUi.slice(
  sharedRecordUi.indexOf('export function recordPersonList'),
  sharedRecordUi.indexOf('function timeValue')
);
if (!/overline:\s*item\.uei/.test(sharedPersonListSource)
  || !/title:\s*item\.name/.test(sharedPersonListSource)
  || !/subtitle:\s*item\.phone/.test(sharedPersonListSource)
  || !/className:\s*'list-entry--record-person'/.test(sharedPersonListSource)
  || /columns:\s*\[/.test(sharedPersonListSource)
  || !/\.list-entry--record-person \.list-entry__background\{background:#fff;background-image:none\}/.test(sharedRecordCss)
  || !/\.list-entry--record-person \.list-entry__content\{background:#fff\}/.test(sharedRecordCss)) {
  errors.push('Shared Record person selection must keep UEI / name / phone as three readable stacked lines on a plain white card with no gradient');
}

const recordPersonStepSource = journalRecordUi.slice(
  journalRecordUi.indexOf('function renderPersonStep'),
  journalRecordUi.indexOf('function openConfirmationWorkplaceModal')
);
if (!/button\('\+ Добавить клиента',\s*\{\s*data:\s*'data-record-settings-add-person'\s*\}\)/.test(recordPersonStepSource)
  || !/bindRecordSettings\(modalRoot/.test(recordPersonStepSource)
  || /variant:\s*'secondary'[^\n]*data-record-settings-add-person/.test(recordPersonStepSource)) {
  errors.push('Record person-step A settings must expose one canonical black "+ Добавить клиента" button');
}

const existingRecordPersonPickerSource = journalRecordViewUi.slice(
  journalRecordViewUi.indexOf('function openPersonPicker'),
  journalRecordViewUi.indexOf('function openAddProcedurePicker')
);
for (const [name, source] of [
  ['Record person selection', recordPersonStepSource],
  ['Existing Record person picker', existingRecordPersonPickerSource],
]) {
  if (!/ui-search-field/.test(source)
    || !/field\(\{[\s\S]*type:\s*'search'[\s\S]*placeholder:\s*'Поиск по имени или UEI'/.test(source)
    || /record-person-toolbar|class=["'][^"']*record-person-search/.test(source)) {
    errors.push(`${name} must consume the same Shared search field presentation as the People folder`);
  }
}
if (!/ui-search-field/.test(peopleUi)
  || !/placeholder:\s*'Поиск по имени или UEI'/.test(peopleUi)
  || !/\.ui-search-field\{[^}]*padding:\s*0 0 12px/.test(sharedInputsCss)
  || !/\.ui-search-divider\{[^}]*height:\s*1px/.test(sharedInputsCss)) {
  errors.push('People and Record search must share one canonical search-field presentation');
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
if (!/duration:\s*5\b/.test(recordStartTimesSource)
  || !/step:\s*5\b/.test(recordStartTimesSource)
  || /getBookingSettings\(\)\.slotStep/.test(journalRecordUi)
  || /function\s+recordSlotStep\s*\(/.test(journalRecordUi)) {
  errors.push('Journal Record first-step quick choices must preserve the proven specialist 5-minute helper and must not consume online-booking slotStep');
}

const confirmationTimeSource = journalRecordUi.slice(
  journalRecordUi.indexOf('function openConfirmationTimeModal'),
  journalRecordUi.indexOf('function openPhoneActions')
);
if (!/openTimePickerAction\(/.test(confirmationTimeSource)
  || !/minuteStep:\s*1\b/.test(confirmationTimeSource)
  || !/checkTimeAvailability\(/.test(confirmationTimeSource)) {
  errors.push('Journal Record final time correction must use the canonical Shared Time picker at exact-minute resolution and validate the resulting interval');
}

const existingRecordTimeSource = journalRecordViewUi.slice(
  journalRecordViewUi.indexOf('function openTimePicker'),
  journalRecordViewUi.indexOf('function openPersonPicker')
);
if (!/openTimePickerAction\(/.test(existingRecordTimeSource)
  || !/minuteStep:\s*1\b/.test(existingRecordTimeSource)
  || !/checkRecordTime\(/.test(existingRecordTimeSource)
  || /getBookingSettings\(\)\.slotStep/.test(journalRecordViewUi)) {
  errors.push('Existing specialist Record time editing must use the canonical Shared Time picker at exact-minute resolution and stay independent from online-booking slotStep');
}

if (!/kind:\s*'avatar'/.test(sharedRecordUi)
  || !/hideD:\s*!chatPersonKey/.test(sharedRecordUi)
  || !/d:\s*chatPersonKey\s*\?/.test(sharedRecordUi)
  || !/settings\s*\?\s*\{/.test(sharedRecordUi)) {
  errors.push('Shared Record Header must always own A as avatar/photo, expose settings only by context, and show D only after a person is fixed');
}

const sharedConfirmationSource = sharedRecordUi.slice(
  sharedRecordUi.indexOf('export function recordConfirmationMiniCard'),
  sharedRecordUi.indexOf('export function mountRecordZ')
);
if (!/miniCard\(\{/.test(sharedConfirmationSource)
  || !/className:\s*'record-confirmation-mini-card'/.test(sharedConfirmationSource)
  || /record-confirmation-card__|record-confirmation-view__metrics|v2RailCard\(/.test(sharedConfirmationSource)
  || !/\.record-confirmation-view\{[^}]*gap:\s*20px/.test(sharedRecordCss)
  || !/\.record-confirmation-mini-card\.mini-card--lines\{[^}]*width:var\(--mini-card-width\)[^}]*height:var\(--mini-card-height\)/.test(sharedRecordCss)
  || !/\.record-confirmation-mini-card \.mini-card__line:nth-child\(2\)\{grid-column:2;grid-row:1\}/.test(sharedRecordCss)
  || !/\.record-confirmation-mini-card \.mini-card__line:nth-child\(8\)\{grid-column:1;grid-row:5\}/.test(sharedRecordCss)
  || !/\.record-confirmation-mini-card \.mini-card__line:nth-child\(9\)\{grid-column:2;grid-row:5\}/.test(sharedRecordCss)) {
  errors.push('Shared Record confirmation must keep the approved standard Mini Card dimensions, place discount top right, duration bottom left, total bottom right, and keep procedures separated below');
}

if (!/step:\s*state\.settings\.slotStep/.test(onlineBookingUi)) {
  errors.push('Online booking may keep its configured display slot step; specialist Record timing must remain independent from it');
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
  || !/disabled:\s*true/.test(bookingHeaderSource)
  || !/b:\s*'Запись'/.test(bookingHeaderSource)
  || !/d:\s*null/.test(bookingHeaderSource)
  || /data-record-owner-settings/.test(bookingHeaderSource)) {
  errors.push('Online booking Header must keep A as a disabled professional avatar only, use Запись in B, and expose no D chat or specialist settings');
}

if (!/workplaceCardAppearance\(workplace\)/.test(onlineBookingUi)
  || !/workplaceCardFields\(workplace, workplace\.cardProfile \|\| profile\)/.test(onlineBookingUi)
  || !/entityVisualCard\(/.test(sharedRecordUi)
  || !/v2-profile-workplaces/.test(sharedRecordUi)) {
  errors.push('Booking workplace selection must render the exact saved workplace business-card owner used by Profile');
}

if (!/v2ListEntry\(/.test(sharedRecordUi)
  || !/v2ListEntries\(/.test(sharedRecordUi)
  || !/miniCard\(/.test(sharedRecordUi)
  || !/timeSlots\(/.test(sharedRecordUi)
  || !/recordConfirmationMiniCard\(/.test(onlineBookingUi)) {
  errors.push('Record UI must reuse the existing History list and Shared Time owners while keeping one Shared confirmation-card owner for specialist and online booking');
}

if (errors.length) {
  console.error('record ownership check: FAILED');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('record ownership check: OK');

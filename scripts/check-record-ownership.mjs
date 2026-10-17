import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
const peopleUi = read('core/people/people.js');
const prismaSchema = read('server/prisma/schema.prisma');
const journalRecordUi = read('journal/record.js');
const journalRecordEditUi = read('journal/record-edit.js');
const journalRecordProcedureUi = read('journal/record-procedure-correction.js');
const journalRecordViewUi = read('journal/record-view.js');
const journalBreakViewUi = read('journal/break-view.js');
const journalDayUi = read('journal/день.js');
const creationOwnerUi = read('ui/record/creation-flow.js');
const sharedRecordUi = read('ui/record/runtime.js');
const sharedRecordCss = read('ui/record/record.css');
const sharedInputsCss = read('ui/inputs/inputs.css');
const sharedListEntryUi = read('ui/lists/list-entry.js');
const sharedListEntryCss = read('ui/lists/list-entry.css');

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
  errors.push('core/record/service.js: Record commands must append immutable lifecycle facts');
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
  errors.push('server RecordService must compose through Time, Procedure and Finance owners');
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
  errors.push('Account history must consume canonical Records through the global account projection');
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

// Journal creation has one owner and one active module. It is Q, not a second Z/X flow.
if (existsSync(join(root, 'journal/record-creation-x.js'))) {
  errors.push('Journal Record creation must not keep a second record-creation-x.js flow');
}
if (!/import\('\.\/record\.js'\)/.test(journalDayUi)) {
  errors.push('Journal Day must launch the single journal/record.js creation flow');
}
if (!/openRecordCreationOwner\(/.test(journalRecordUi)
  || /mountRecordZ|bindRecordSettings|setRecordPrimaryAction/.test(journalRecordUi)) {
  errors.push('Journal Record creation must use the canonical Q owner and must not restore Z/A/C ownership');
}
if (!/variant:\s*'q'/.test(creationOwnerUi)
  || !/data-record-creation-body/.test(creationOwnerUi)
  || !/data-record-creation-action/.test(creationOwnerUi)
  || !/footer\s*=\s*''/.test(creationOwnerUi)) {
  errors.push('Shared RecordCreation owner must remain one Q with body plus fixed footer/action row');
}
if (!/record-creation-flow__body\{[^}]*overflow:auto/.test(sharedRecordCss)
  || !/record-creation-flow__action\{[^}]*display:grid/.test(sharedRecordCss)) {
  errors.push('RecordCreation list/body must scroll independently above fixed actions');
}
if (!/recordCreationTimeRows\(/.test(journalRecordUi)
  || /class=["'`](?:record-time-option|record-time-chip)/.test(journalRecordUi)) {
  errors.push('Journal Record creation must consume Shared RecordCreation time rows instead of local time buttons');
}

const sharedProcedureListSource = sharedRecordUi.slice(
  sharedRecordUi.indexOf('export function recordProcedureList'),
  sharedRecordUi.indexOf('export function recordPersonList'),
);
if (!/v2ListEntry\(\{/.test(sharedProcedureListSource)
  || !/v2ListEntries\(rows\)/.test(sharedProcedureListSource)
  || !/selectable:\s*true/.test(sharedProcedureListSource)
  || !/rightTop:/.test(sharedProcedureListSource)
  || /v2-service-sticker|v2-sticker-list--services/.test(sharedProcedureListSource + sharedRecordCss)
  || !/selectable\s*=\s*false/.test(sharedListEntryUi)
  || !/list-entry__selector/.test(sharedListEntryUi)
  || !/\.list-entry\{[^}]*min-height:78px[^}]*border:0[^}]*box-shadow:-9px 8px 14px -11px/.test(sharedListEntryCss)
  || !/\.list-entry__selector\{[^}]*width:24px[^}]*height:24px/.test(sharedListEntryCss)
  || !/\.list-entry\.is-selectable\.is-selected \.list-entry__selector::after\{content:'✓'\}/.test(sharedListEntryCss)) {
  errors.push('Shared Record procedure selection must consume canonical V2 List Entry presentation');
}

const procedureStepSource = journalRecordUi.slice(
  journalRecordUi.indexOf('const renderProcedures ='),
  journalRecordUi.indexOf('const renderBreakConfirmation ='),
);
if (!/recordProcedureList\(/.test(procedureStepSource)
  || !/button\('Добавить из прайса',[\s\S]*data:\s*'data-record-create-from-price'/.test(procedureStepSource)
  || !/button\('\+ Добавить процедуру',[\s\S]*data:\s*'data-record-create-add-procedure'/.test(procedureStepSource)
  || !/openPriceProcedurePicker/.test(procedureStepSource)
  || !/openProcedureEditor/.test(procedureStepSource)
  || !/assignProceduresToWorkplace/.test(procedureStepSource)) {
  errors.push('Procedure Q must expose Add from price / Add procedure and reuse existing Procedure + workplace assignment logic');
}

const recordPricePickerSource = journalRecordUi.slice(
  journalRecordUi.indexOf('function openPriceProcedurePicker'),
  journalRecordUi.indexOf('export function openRecordCreation'),
);
if (!/recordProcedureList\(/.test(recordPricePickerSource)
  || !/assignProceduresToWorkplace/.test(recordPricePickerSource)) {
  errors.push('Record workplace price picker must reuse Shared procedure list and canonical workplace assignment');
}

const sharedPersonListSource = sharedRecordUi.slice(
  sharedRecordUi.indexOf('export function recordPersonList'),
  sharedRecordUi.indexOf('function timeValue'),
);
if (!/overline:\s*item\.uei/.test(sharedPersonListSource)
  || !/title:\s*item\.name/.test(sharedPersonListSource)
  || !/subtitle:\s*item\.phone/.test(sharedPersonListSource)
  || !/className:\s*'list-entry--record-person'/.test(sharedPersonListSource)
  || /columns:\s*\[/.test(sharedPersonListSource)
  || !/\.list-entry--record-person \.list-entry__background\{background:#fff;background-image:none\}/.test(sharedRecordCss)
  || !/\.list-entry--record-person \.list-entry__content\{background:#fff\}/.test(sharedRecordCss)) {
  errors.push('Shared Record person selection must keep UEI / name / phone on a plain white card');
}

const personStepSource = journalRecordUi.slice(
  journalRecordUi.indexOf('const renderPerson ='),
  journalRecordUi.indexOf('const renderProcedures ='),
);
if (!/recordPersonList\(/.test(personStepSource)
  || !/button\('\+ Добавить клиента',[\s\S]*data:\s*'data-record-create-add-person'/.test(personStepSource)
  || !/openPersonCreate\(/.test(personStepSource)
  || !/ui-search-field/.test(personStepSource)
  || !/placeholder:\s*'Поиск по имени или UEI'/.test(personStepSource)) {
  errors.push('Person Q must expose Add person, reuse existing PersonCreate and Shared search/list presentation');
}
if (!/ui-search-field/.test(peopleUi)
  || !/placeholder:\s*'Поиск по имени или UEI'/.test(peopleUi)
  || !/\.ui-search-field\{[^}]*padding:\s*0 0 12px/.test(sharedInputsCss)
  || !/\.ui-search-divider\{[^}]*height:\s*1px/.test(sharedInputsCss)) {
  errors.push('People and Record search must share one canonical search-field presentation');
}

// Confirmation stays confirmation only; creation does not expose correction navigation.
const confirmationSource = journalRecordUi.slice(
  journalRecordUi.indexOf('const renderConfirmation ='),
  journalRecordUi.indexOf('const renderPerson ='),
);
if (!/label:\s*'Подтвердить'/.test(confirmationSource)
  || /recordConfirmationEditStep|openRecordEditFlow|Пространство[\s\S]*Дата[\s\S]*Время[\s\S]*Процедура/.test(confirmationSource)) {
  errors.push('Creation confirmation must contain only confirmation, not correction navigation');
}

// Existing Record and Break remain Z surfaces; their correction logic is not a second creation flow.
if (!/mountRecordZ/.test(journalRecordViewUi) || !/mountRecordZ/.test(journalBreakViewUi)) {
  errors.push('Existing Record and Break surfaces must keep the canonical Shared Record Z owner');
}
if (!/openRecordEditFlow\(/.test(journalRecordViewUi)
  || !/openRecordProcedureCorrection\(/.test(journalRecordViewUi)) {
  errors.push('Existing Record must delegate schedule and procedure correction to their shared correction owners');
}
if (!/export function openRecordEditFlow/.test(journalRecordEditUi)
  || !/timePicker\(\{[\s\S]*name:\s*'recordEditExactTime'[\s\S]*minuteStep:\s*1\b/.test(journalRecordEditUi)
  || !/initTimePickers\(host\)/.test(journalRecordEditUi)
  || !/checkTimeAvailability\(\{[\s\S]*excludeId/.test(journalRecordEditUi)
  || !/workplaceCardAppearance\(workplace\)/.test(journalRecordEditUi)
  || !/workplaceCardFields\(workplace,\s*profile\)/.test(journalRecordEditUi)
  || !/workplaceCardPhoto\(workplace\)/.test(journalRecordEditUi)) {
  errors.push('Shared specialist Record edit flow must preserve canonical workplace/date/exact-time correction');
}
if (!/chatPersonKey/.test(journalRecordEditUi)
  || !/chatPersonKeys/.test(journalRecordEditUi)
  || !/chatKeysForState/.test(journalRecordViewUi)) {
  errors.push('Record correction must preserve current person/group chat context');
}
if (!/export function openRecordProcedureCorrection/.test(journalRecordProcedureUi)
  || !/checkTimeAvailability/.test(journalRecordProcedureUi)
  || !/excludeId/.test(journalRecordProcedureUi)) {
  errors.push('Procedure correction must remain one canonical owner and validate through Availability');
}

if (/function\s+openPersonPicker/.test(journalRecordViewUi)) {
  errors.push('Existing Record must not restore a second person picker; rescheduling skips Person by design');
}
if (/function\s+openConfirmationProcedurePicker|function\s+openAddProcedurePicker/.test(journalRecordUi + journalRecordViewUi)) {
  errors.push('Record must not keep parallel confirmation/existing-record procedure pickers');
}

for (const [path, source] of [
  ['journal/record.js', journalRecordUi],
  ['journal/record-view.js', journalRecordViewUi],
  ['journal/break-view.js', journalBreakViewUi],
]) {
  if (/record-modal-actions|record-modal--flow/.test(source)) {
    errors.push(`${path}: must not restore retired local Record modal flows`);
  }
}

if (/\.record-modal--|\.record-editor-|\.record-card-|\.entity-card--record|\.record-setting-|\.record-time-slot|\.record-confirm-(?:card|summary|actions|procedure)|\.record-view(?:\{|-(?:card|actions|services))|\.record-record-services|\.record-reset|\.record-delete-button|\.record-modal-(?:next|actions)|\.record-next-top|\.record-procedure-row|\.record-screen--(?:confirmation|settings)/.test(sharedRecordCss)) {
  errors.push('Retired Record modal/editor CSS must not return');
}
if (/journal-list-(?:mode-navigation|viewport|anchor)/.test(sharedRecordCss) || /\.segment-control--two\{/.test(sharedRecordCss)) {
  errors.push('Record CSS must not own Journal List or SegmentControl geometry');
}

if (!/data-record-owner-settings/.test(sharedRecordUi)
  || !/(?:data-v2-primary-action|dataset\.v2PrimaryAction)/.test(sharedRecordUi)
  || !/mountV2ZLayer/.test(sharedRecordUi)) {
  errors.push('ui/record/runtime.js must remain the canonical existing-Record Z/A/C presentation owner');
}

const sharedV2Runtime = [read('ui/v2/index.js'), read('ui/v2/z-stack.js'), read('ui/v2/swipe.js')].join('\n');
if (!/mountV2ZLayer/.test(sharedV2Runtime)
  || !/stack\s*=\s*false/.test(sharedV2Runtime)
  || !/initV2Swipe\(node,\s*\{\s*onRight:\s*close,\s*revealDeck:\s*false,\s*threshold:\s*28,\s*edgeWidth:\s*36\s*\}\)/.test(sharedV2Runtime)
  || !/book:v2-context-changed/.test(sharedV2Runtime)) {
  errors.push('Shared Record Z stack must close one top sheet on right swipe and resync Header context after close');
}

const directDataImport = /(?:from\s+['"][^'"]*core\/record\/data\.js['"]|import\s*\(\s*['"][^'"]*core\/record\/data\.js['"]\s*\))/;
for (const path of [...walk('journal'), ...walk('core/people'), ...walk('core/finance'), ...walk('settings'), ...walk('tests')]) {
  const source = read(path);
  if (directDataImport.test(source)) errors.push(`${path}: must use core/record/index.js instead of the private data atom`);
}

const sharedConfirmationSource = sharedRecordUi.slice(
  sharedRecordUi.indexOf('export function recordConfirmationMiniCard'),
  sharedRecordUi.indexOf('export function mountRecordZ'),
);
if (!/miniCard\(\{/.test(sharedConfirmationSource)
  || !/className:\s*'record-confirmation-mini-card'/.test(sharedConfirmationSource)
  || /record-confirmation-card__|record-confirmation-view__metrics|v2RailCard\(/.test(sharedConfirmationSource)
  || !/\.record-confirmation-view\{[^}]*gap:\s*20px/.test(sharedRecordCss)
  || !/\.record-confirmation-mini-card\.mini-card--lines\{[^}]*width:var\(--mini-card-width\)[^}]*height:var\(--mini-card-height\)/.test(sharedRecordCss)) {
  errors.push('Shared Record confirmation must keep the approved standard Mini Card owner');
}

if (!/step:\s*state\.settings\.slotStep/.test(onlineBookingUi)) {
  errors.push('Online booking may keep its configured display slot step; specialist Record timing must remain independent from it');
}
if (!/recordWorkplaceCards\(/.test(onlineBookingUi)
  || !/recordProcedureList\(/.test(onlineBookingUi)
  || !/recordTimeRows\(/.test(onlineBookingUi)
  || !/recordConfirmationMiniCard\(/.test(onlineBookingUi)) {
  errors.push('Online booking must consume the canonical Shared Record step owners');
}
if (/bookingChoiceCards\(|bookingTimeGroups\(|v2ServiceStickers\(|v2-confirmation/.test(onlineBookingUi)) {
  errors.push('Online booking must not restore parallel visual owners for canonical booking steps');
}

if (errors.length) {
  console.error('record ownership check: FAILED');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('record ownership check: OK');
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const errors = [];

function walk(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...walk(path));
    else if (/\.js$/.test(name)) result.push(path);
  }
  return result;
}

function walkCss(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...walkCss(path));
    else if (/\.css$/.test(name)) result.push(path);
  }
  return result;
}

function text(file) {
  return readFileSync(file, 'utf8');
}

function rel(file) {
  return relative(root, file).replaceAll('\\', '/');
}

function report(file, rule) {
  errors.push(`${relative(root, file)}: ${rule}`);
}

const mainFiles = walk(join(root, 'main'));
const settingsFiles = walk(join(root, 'settings'));
const timetableFiles = walk(join(root, 'timetable'));
const journalFiles = walk(join(root, 'journal'));
const timetableController = join(root, 'timetable/timetable.js');
const journalController = join(root, 'journal/journal.js');
const referenceFiles = [...mainFiles, ...settingsFiles, ...timetableFiles, ...journalFiles];
const uiFiles = walk(join(root, 'ui'));
const coreFiles = walk(join(root, 'core'));
const allFiles = [...mainFiles, ...settingsFiles, ...timetableFiles, ...journalFiles, ...uiFiles, ...coreFiles, join(root, 'core.js')];
const cssFiles = [...walkCss(join(root, 'css')), ...walkCss(join(root, 'ui'))];

for (const file of referenceFiles) {
  const source = text(file);
  if (/<select\b/i.test(source)) report(file, 'native <select> is forbidden in reference branches; use shared select()');
  if (/<datalist\b/i.test(source)) report(file, 'native <datalist> is forbidden in reference branches; use shared searchableSelect()');
}

for (const file of uiFiles) {
  const source = text(file);
  if (source.includes('🗑')) report(file, 'trash glyph is forbidden in shared UI; ordinary removal uses ×');
  if (/\blocalStorage\b/.test(source)) report(file, 'shared UI must not own persistence/localStorage');
}

for (const file of coreFiles) {
  const source = text(file);
  if (/from\s+['"][^'"]*(?:settings|main|journal)\//.test(source)) report(file, 'core domain module must not import feature/entity folders');
}

const buttonSizeClass = /\bui-button--(?:full|small|compact)\b/;
const buttonSizeOption = /\bbutton\s*\([^)]*\bvariant\s*:\s*['"](?:full|small|compact)['"]/;
for (const file of allFiles) {
  const source = text(file);
  if (buttonSizeClass.test(source) || buttonSizeOption.test(source)) report(file, 'ordinary button() has one geometry; size variants full/small/compact are forbidden');
}
const buttonsCss = join(root, 'ui/buttons/buttons.css');
if (buttonSizeClass.test(text(buttonsCss))) {
  report(buttonsCss, 'ordinary button has one geometry; size modifier classes are forbidden');
}
const buttonGeometryProperty = /\b(?:width|min-width|max-width|height|min-height|max-height|padding|padding-top|padding-right|padding-bottom|padding-left)\s*:/;
for (const file of cssFiles) {
  if (file === buttonsCss) continue;
  const source = text(file);
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1] || '';
    const body = match[2] || '';
    if (/\.ui-button(?![-\w])/.test(selector) && buttonGeometryProperty.test(body)) {
      report(file, 'ordinary button geometry belongs only to ui/buttons/buttons.css');
      break;
    }
  }
}
const buttonOwner = join(root, 'ui/buttons/index.js');
const manualOrdinaryButton = /<button\b[^>]*class=["'][^"']*(?:^|\s)ui-button(?:\s|["'])/i;
for (const file of allFiles) {
  if (file === buttonOwner) continue;
  if (manualOrdinaryButton.test(text(file))) report(file, 'ordinary action buttons must be rendered by shared button() from ui/buttons');
}

const headerControlOwner = join(root, 'ui/header/index.js');
const headerControlCss = join(root, 'ui/header/header.css');
const workplaceUi = join(root, 'ui/workplaces/index.js');
const workplaceCss = join(root, 'ui/workplaces/workplaces.css');
for (const file of allFiles) {
  const source = text(file);
  if (file !== headerControlOwner && /<button\b[^>]*class=["'][^"']*\bheader-control\b/i.test(source)) {
    report(file, 'Header Control shell belongs only to ui/header/index.js');
  }
  if (/\bworkplaceHeaderButton\b/.test(source)) {
    report(file, 'workplaceHeaderButton is forbidden; use generic headerControl() with workplaceContent()');
  }
  if (/\bworkplaceHeaderContent\b/.test(source)) {
    report(file, 'Workplace content must be container-neutral; use workplaceContent()');
  }
}
for (const file of cssFiles) {
  const source = text(file);
  if (file !== headerControlCss && /\.header-control\b/.test(source)) report(file, 'Header Control presentation belongs only to ui/header/header.css');
  if (/\.workplace-header-content\b/.test(source)) report(file, 'Workplace content must not be coupled to Header; use .workplace-content');
}
const headerSource = text(headerControlOwner);
if (!/export\s+function\s+openHeaderControl\b/.test(headerSource) || !/variant:\s*['"]medium['"]/.test(headerSource)) {
  report(headerControlOwner, 'Header Control must own one canonical medium modal manifestation through openHeaderControl()');
}
const workplaceSource = text(workplaceUi);
if (!/\bopenHeaderControl\s*\(/.test(workplaceSource)) {
  report(workplaceUi, 'Workplace main manifestation must use the shared openHeaderControl() shell');
}
if (/variant:\s*['"]medium['"]/.test(workplaceSource)) {
  report(workplaceUi, 'Workplace must not choose Header Control modal size; medium belongs to ui/header');
}
for (const controller of [timetableController, journalController]) {
  const source = text(controller);
  if (/\bopenWorkplace(?:Picker|Time)?Modal\b/.test(source)) {
    report(controller, 'sections must not own Workplace modal manifestations; use shared openWorkplaceControl()');
  }
  if (!/\bheaderControl\s*\(/.test(source) || !/\bworkplaceContent\s*\(/.test(source)) {
    report(controller, 'Graph and Journal must compose neutral Workplace content inside the shared Header Control');
  }
  if (!/\bopenWorkplaceControl\s*\(/.test(source)) {
    report(controller, 'Graph and Journal must use the shared Workplace manifestation');
  }
}

const workplaceOwner = 'settings/profile/workplaces/data.js';
for (const file of allFiles) {
  const source = text(file);
  if (!source.includes('book.workplaces')) continue;
  if (rel(file) !== workplaceOwner) report(file, 'book.workplaces may only be accessed by the Workplace data owner');
}

const clientsUi = join(root, 'main/clients/clients.js');
if (/\blocalStorage\b/.test(text(clientsUi))) report(clientsUi, 'Clients screen must use data/view-state owners instead of direct localStorage');

if (/\blocalStorage\b/.test(text(timetableController))) {
  report(timetableController, 'Graph controller must use the canonical data owner instead of direct localStorage');
}

const journalDataOwners = new Set(['journal/record-data.js', 'journal/break-data.js']);
for (const file of journalFiles) {
  if (/\blocalStorage\b/.test(text(file)) && !journalDataOwners.has(rel(file))) {
    report(file, 'Journal runtime must use entity data owners instead of direct localStorage');
  }
}

const storageOwners = new Map([
  ['book.records', 'journal/record-data.js'],
  ['book.journalBreaks', 'journal/break-data.js'],
]);
for (const file of allFiles) {
  const source = text(file);
  for (const [key, owner] of storageOwners) {
    if (source.includes(key) && rel(file) !== owner) report(file, `${key} may only be accessed by ${owner}`);
  }
}

const journalCreation = join(root, 'journal/record.js');
if (/export\s+function\s+openRecordView\b/.test(text(journalCreation))) {
  report(journalCreation, 'Record creation must not contain a duplicate Record View; journal/record-view.js is the single view implementation');
}
if (/from\s+['"][^'"]*core\/record\.js['"]/.test(text(journalCreation))) {
  report(journalCreation, 'Record creation must use the Journal Record data owner directly, not a Core compatibility bridge');
}

const legacyTimetableCss = join(root, 'timetable/timetable.css');
if (existsSync(legacyTimetableCss)) {
  report(legacyTimetableCss, 'Graph must not own a parallel functional CSS file; shared presentation belongs to common UI');
}

const legacyTimeWorkBridge = join(root, 'core/time-work.js');
if (existsSync(legacyTimeWorkBridge)) {
  report(legacyTimeWorkBridge, 'legacy TimeWork compatibility bridge is forbidden; Day is the canonical working-time owner');
}
const legacyRecordBridge = join(root, 'core/record.js');
if (existsSync(legacyRecordBridge)) {
  report(legacyRecordBridge, 'legacy Record compatibility bridge is forbidden; journal/record-data.js is the canonical Record owner');
}
const misplacedJournalBreaks = join(root, 'core/journal-breaks.js');
if (existsSync(misplacedJournalBreaks)) {
  report(misplacedJournalBreaks, 'Journal Break is Journal-owned and must not have a parallel Core owner');
}

for (const file of allFiles) {
  const source = text(file);

  if (/from\s+['"][^'"]*time-work\.js['"]/.test(source)) {
    report(file, 'runtime code must not import the removed TimeWork compatibility bridge');
  }
  if (/from\s+['"][^'"]*core\/record\.js['"]/.test(source)) {
    report(file, 'runtime code must not import the removed Record compatibility bridge');
  }
  if (/from\s+['"][^'"]*core\/journal-breaks\.js['"]/.test(source)) {
    report(file, 'runtime code must not import the removed Core Journal Break owner');
  }

  if (/\b(?:getTimeWorks|saveTimeWorks|getTimeWork|ensureTimeWork|correctTimeWork|resolveTimeWork|createTimeWork)\b/.test(source)) {
    report(file, 'legacy TimeWork compatibility API is forbidden');
  }

  if (/\bmigrateLegacyWorkingDates\b/.test(source)) {
    report(file, 'legacy workingDates migration is forbidden');
  }

  if (source.includes('book.timeWorks')) {
    report(file, 'legacy book.timeWorks storage is forbidden');
  }
}

const dayOwner = join(root, 'core/day.js');
if (/\bworkingDates\b/.test(text(dayOwner)) || text(dayOwner).includes('book.timeWorks')) {
  report(dayOwner, 'Day must contain only the canonical workingDays model and no legacy schedule storage');
}

const settingsControllers = [
  'settings/profile/profile.js',
  'settings/service/service.js',
  'settings/warehouse/warehouse.js',
  'settings/documents/documents.js',
  'settings/loyalty/loyalty.js',
  'settings/tags/tags.js',
  'settings/wallets/wallets.js',
  'settings/service/procedures/procedures.js',
  'settings/service/products/products.js',
];
for (const controller of settingsControllers) {
  const file = join(root, controller);
  const source = text(file);
  if (!/export\s+function\s+render\b|export\s*\{[^}]*\bas\s+render\b[^}]*\}/s.test(source)) {
    report(file, 'Settings folder controller must expose the shared render(root, navigateBack) contract');
  }
}

const settingsRoot = join(root, 'settings/settings.js');
if (/module\.render\s*\|\|/.test(text(settingsRoot))) {
  report(settingsRoot, 'Settings must call the shared render() contract without fallback render names');
}

for (const file of allFiles) {
  if (rel(file) === 'ui/duration/index.js') continue;
  if (/\b(?:const|let|var|function)\s+durationText\b/.test(text(file))) {
    report(file, 'durationText() belongs only to ui/duration and must be imported through ui/ui.js');
  }
}

const uiFacade = join(root, 'ui/ui.js');
if (/export\s+function\b/.test(text(uiFacade))) report(uiFacade, 'ui/ui.js must remain a pure import/re-export facade');

const profileController = join(root, 'settings/profile/profile.js');
if (!/\bworkplaceAddButton\(\)/.test(text(profileController))) {
  report(profileController, 'Profile must use the shared workplace add button from ui/workplaces');
}
if (/iconButton\('\+'[^)]*data-add-workplace/.test(text(profileController))) {
  report(profileController, 'Profile must not recreate the workplace add button locally');
}

const walletsController = join(root, 'settings/wallets/wallets.js');
if (/Системный кошелёк/.test(text(walletsController))) {
  report(walletsController, 'The internal system-wallet flag must not be exposed as a visible label');
}

if (errors.length) {
  console.error('reference architecture check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`reference architecture check: OK (${referenceFiles.length} reference files, ${uiFiles.length} UI files)`);

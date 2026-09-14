import fs from 'node:fs';

const reference = fs.readFileSync('ui/reference/reference.js', 'utf8');
const referenceHtml = fs.readFileSync('ui/reference/index.html', 'utf8');
const facade = fs.readFileSync('ui/ui.js', 'utf8');
const style = fs.readFileSync('css/style.css', 'utf8');
const modalCss = fs.readFileSync('ui/modals/modal.css', 'utf8');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(style.includes('--app-max-width:390px'), 'Book UI reference requires the shared 390px Book width.');
expect(facade.includes('segmentControl') && facade.includes('initSegmentControls'), 'Segmented control must be owned by Shared UI.');
expect(facade.includes('columnLayout'), 'One-to-three column geometry must be owned by Shared UI.');
expect(modalCss.includes('var(--app-max-width)') && !modalCss.includes('430px'), 'Modal variants must stay inside the shared Book width.');

for (const css of ['../layout/layout.css', '../accordion/accordion.css', '../calendar/calendar.css', '../lists/list.css', '../lists/list-entry.css']) {
  expect(referenceHtml.includes(css), `UI reference must load ${css}.`);
}

for (const marker of [
  "['fields', 'Поля и телефон']",
  "['blocks', 'Блоки 1–3']",
  "['lists', 'List / Entry List']",
  "['receipt', 'Отчётный лист']",
  "['date', 'День / календарь']",
  "['folders', 'Папки']",
  "['controls', 'Аккордеон / переключатель']",
  "['modals', 'Модальные окна']",
]) expect(reference.includes(marker), `UI reference is missing screen ${marker}.`);

expect(reference.includes("repeatedField({ label: 'Телефон'") && reference.includes("type: 'tel'"), 'Reference must show the canonical [+код][телефон][×] phone row.');
expect(reference.includes("repeatedField({ label: 'Поле'") && reference.includes('initRepeatedFields(app)'), 'Reference must show the canonical [поле][×] repeated row.');
expect(reference.includes('listEntry({ columns:') && reference.includes('listEntries(['), 'Reference must show canonical Entry List columns.');
expect(reference.includes('readOnlyReceipt({'), 'Reference must show the canonical report/receipt sheet.');
expect(reference.includes('monthDayPicker({') && reference.includes('initCalendar(calendarHost'), 'Reference must show both day field and calendar.');
expect(reference.includes('folderList(['), 'Reference must show canonical folders.');
expect(reference.includes("iconButton('ⓘ'"), 'Reference must show the information icon.');
expect(reference.includes('accordion([') && reference.includes('initAccordions(app)'), 'Reference must show the shared accordion.');
expect(reference.includes('segmentControl([') && reference.includes('initSegmentControls(app)'), 'Reference must show two- and three-value segmented controls.');
expect(reference.includes('columnLayout([') && reference.includes('columns: 3'), 'Reference must show shared 1–3 column layouts.');
for (const variant of ['compact', 'medium', 'large', 'list']) {
  expect(reference.includes(`data-reference-modal=\\"${variant}\\"`) || reference.includes(`data-reference-modal="${variant}"`), `Reference must expose ${variant} modal.`);
}

expect(!reference.includes('apiRequest(') && !reference.includes('fetch(') && !reference.includes('localStorage') && !reference.includes('sessionStorage'), 'UI reference must remain free of API and persistence.');
expect(!reference.includes("from '../../core/") && !reference.includes("from '../core/"), 'UI reference must not import business/core modules.');

if (failures.length) {
  failures.forEach((message) => console.error(`ui reference architecture: ${message}`));
  process.exit(1);
}

console.log('ui reference architecture check: OK');

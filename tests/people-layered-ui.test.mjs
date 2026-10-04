import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const people = readFileSync(new URL('../core/people/people.js', import.meta.url), 'utf8');
const v2 = readFileSync(new URL('../ui/v2/index.js', import.meta.url), 'utf8');
const v2Css = readFileSync(new URL('../ui/v2/v2.css', import.meta.url), 'utf8');
const selectors = readFileSync(new URL('../ui/selectors/index.js', import.meta.url), 'utf8');
const selectorCss = readFileSync(new URL('../ui/selectors/selectors.css', import.meta.url), 'utf8');
const calendar = readFileSync(new URL('../ui/calendar/calendar.js', import.meta.url), 'utf8');
const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const miniCard = readFileSync(new URL('../ui/cards/mini-card.js', import.meta.url), 'utf8');
const miniCardCss = readFileSync(new URL('../ui/cards/mini-card.css', import.meta.url), 'utf8');

assert.match(people, /title:\s*'Клиенты'/);
assert.match(people, /Поиск по имени или UEI/);
assert.match(people, /data-people-list-settings/);
assert.match(people, /return v2ListEntries\(items\.map/);
assert.match(people, /v2ListEntry\(\{/);
assert.match(people, /overline:\s*display\.uei/);
assert.match(people, /title:\s*display\.name/);
assert.match(people, /subtitle:\s*display\.phone/);
assert.match(people, /className:\s*'list-entry--record-person'/);

assert.match(people, /Из контактов/);
assert.match(people, /Ввести вручную/);
assert.match(people, /navigator\.contacts\.select\(\['name', 'tel'\]/);
assert.match(people, /button\('Из контактов', \{ variant: 'secondary'/);
assert.match(people, /button\('Ввести вручную', \{ variant: 'secondary'/);
assert.match(people, /personCreateForm\(preset\)/);

assert.match(people, /variant:\s*'x'/);
assert.match(people, /Выгрузить/);
assert.match(people, /Загрузить/);
assert.match(people, /Шаблон/);

assert.match(people, /mountV2ZLayer\([\s\S]*stack:\s*true/);
assert.match(people, /people-overview-layer/);
assert.match(people, /people-edit-layer/);
assert.match(people, /data-person-card/);
assert.match(people, /data-person-z3-action/);
assert.match(people, /dirty \? 'Сохранить' : 'Удалить'/);
assert.match(people, /layer\.v2Close\?\.\(\);[\s\S]*callbacks\.onSaved/);
assert.doesNotMatch(people, /data-workspace-back-source/);

assert.match(people, /openSharedProfileSettingsMenu\(\{/);
assert.match(people, /id: 'code', label: 'Код'/);
assert.match(people, /id: 'documents', label: 'Документы \/ согласия'/);
assert.match(people, /id: 'history', label: 'История'/);
assert.match(people, /variant: 'x'/);
assert.match(people, /variant: 'q'/);
assert.match(people, /documentTiles\(documents\.map/);
assert.match(people, /variant: 's'/);
assert.match(people, /openEntityCardAppearanceQ\(root/);
assert.match(people, /allowPhoto: false/);
assert.match(people, /entityVisualCard\(\{/);
assert.doesNotMatch(people, /openPersonPhotoEditor/);
assert.doesNotMatch(people, /data-person-photo-card/);
assert.doesNotMatch(people, /metricRail\(/);
assert.match(people, /showApply:\s*false/);
assert.match(people, /data-person-direct-chat/);

const dataFieldsStart = people.indexOf('function personDataFields');
const dataFieldsEnd = people.indexOf('function formSnapshot', dataFieldsStart);
const dataFields = people.slice(dataFieldsStart, dataFieldsEnd);
assert.match(dataFields, /v2Section\('Персональные данные'/);
assert.match(dataFields, /v2Section\('Контактные данные'/);
assert.doesNotMatch(dataFields, /photoField\(/);

const saveStart = people.indexOf('function savePersonData');
const saveEnd = people.indexOf('function deletePersonByKey', saveStart);
const saveBlock = people.slice(saveStart, saveEnd);
assert.doesNotMatch(saveBlock, /person\.photo\s*=/);


assert.match(miniCard, /export function miniCardRail/);
assert.match(miniCardCss, /--mini-card-width:238px/);
assert.match(miniCardCss, /--mini-card-height:144px/);
assert.match(miniCardCss, /border:2px solid #111/);
assert.match(miniCardCss, /border-radius:16px/);
assert.match(miniCardCss, /padding:16px/);
assert.match(miniCardCss, /word-break:normal/);
assert.match(miniCardCss, /overflow-wrap:normal/);
assert.match(miniCardCss, /mini-card--surface-photo/);
assert.match(miniCardCss, /mini-card__context-action/);
assert.match(miniCard, /surface = 'default'/);
assert.match(miniCard, /actionLabel = ''/);
assert.doesNotMatch(people, /surface:\s*'photo'/);
assert.doesNotMatch(people, /actionLabel:\s*person\.photo/);

assert.match(selectors, /import \{ modal, mountModal \} from '\.\.\/modals\/index\.js'/);
assert.match(selectors, /variant: 'quick'/);
assert.doesNotMatch(selectors, /document\.body\.appendChild\(surface\)/);
assert.doesNotMatch(selectorCss, /\.ui-selector\{[^}]*position:fixed/s);

assert.match(v2, /mountV2ZLayer\(root, html, \{ onClose = null, stack = false \}/);
assert.match(v2, /const front = app\?\.querySelector\?\.\('\[data-v2-front\]'\)/);
assert.match(v2, /const host = front \|\| stage/);
assert.match(v2, /if \(!stack\) host\.querySelectorAll/);
assert.match(v2, /host\.appendChild\(node\)/);
assert.match(v2, /isTopmost/);
assert.match(v2, /function initV2LayerDismissGesture/);
assert.match(v2, /kind === 'top' \? Math\.min\(0, raw\) : Math\.max\(0, raw\)/);
assert.match(v2, /stopPointerPropagation/);
assert.match(v2, /resolved === 'technical'/);
assert.match(v2Css, /--v2-z-layer-shift/);
assert.match(calendar, /modalRoot\.v2Close\?\.\(\)/);

assert.match(core, /chatPersonKey/);
assert.match(core, /onDirectChat/);
assert.match(core, /data-workspace-d-action/);

console.log('People layered UI architecture: OK');

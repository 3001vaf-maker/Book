import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assignProceduresToWorkplace } from '../settings/service/procedures/service.js';
import { getProcedures } from '../settings/service/procedures/data.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

store.set('book.procedures', JSON.stringify([
  {
    id: 'air-touch',
    name: 'Air Touch',
    duration: 180,
    cost: { mode: 'amount', amount: 12000, free: false },
    workplaces: [{ workplaceId: 'salon-a', name: 'Салон А' }],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'cut',
    name: 'Стрижка',
    duration: 60,
    cost: { mode: 'amount', amount: 5000, free: false },
    workplaces: [{ workplaceId: 'salon-b', name: 'Салон Б' }],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
]));

const changed = assignProceduresToWorkplace({
  procedureIds: ['air-touch', 'cut'],
  workplaceId: 'salon-b',
  workplaceName: 'Салон Б',
});

assert.equal(changed.length, 1);
assert.equal(changed[0].id, 'air-touch');

const procedures = getProcedures();
const airTouch = procedures.find((item) => item.id === 'air-touch');
const cut = procedures.find((item) => item.id === 'cut');
assert.deepEqual(airTouch.workplaces, [
  { workplaceId: 'salon-a', name: 'Салон А' },
  { workplaceId: 'salon-b', name: 'Салон Б' },
]);
assert.deepEqual(airTouch.cost, { mode: 'amount', amount: 12000, free: false });
assert.equal(cut.workplaces.length, 1);

const history = JSON.parse(localStorage.getItem('book.procedures.history') || '[]');
assert.equal(history.length, 1);
assert.equal(history[0].id, 'air-touch');
assert.equal(history[0].historyAction, 'updated');

const repeated = assignProceduresToWorkplace({
  procedureIds: ['air-touch'],
  workplaceId: 'salon-b',
  workplaceName: 'Салон Б',
});
assert.equal(repeated.length, 0);
assert.equal(JSON.parse(localStorage.getItem('book.procedures.history') || '[]').length, 1);

const recordSource = readFileSync(new URL('../journal/record.js', import.meta.url), 'utf8');
const recordCss = readFileSync(new URL('../ui/record/record.css', import.meta.url), 'utf8');
const buttonSource = readFileSync(new URL('../ui/buttons/index.js', import.meta.url), 'utf8');
const buttonCss = readFileSync(new URL('../ui/buttons/buttons.css', import.meta.url), 'utf8');
assert.match(recordSource, /assignProceduresToWorkplace/);
assert.match(recordSource, /button\('Из прайса'/);
assert.match(recordSource, /data-record-from-price/);
assert.match(recordSource, /iconButton\('\+', \{ className: 'icon-button--primary', data: 'data-record-add', aria: 'Добавить процедуру' \}\)/);
assert.match(buttonSource, /export function sheetIconButton/);
assert.match(buttonSource, /iconButton\('▤', \{ className: 'sheet-icon-button'/);
assert.match(buttonCss, /\.sheet-icon-button,.ui-button\[data-record-from-price\]\{[^}]*width:48px[^}]*height:48px/s);
assert.match(buttonCss, /\.ui-button\[data-record-from-price\]::before\{content:"▤"/);
assert.doesNotMatch(recordCss, /data-record-from-price|sheet-icon-button/);
assert.doesNotMatch(recordSource, /saveProcedure/);

console.log('procedure workplace assignment tests: OK');

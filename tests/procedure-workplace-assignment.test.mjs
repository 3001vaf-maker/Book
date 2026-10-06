import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assignProceduresToWorkplace } from '../core/service/procedures/service.js';
import { getProcedures, hydrateProceduresFromServer } from '../core/service/procedures/data.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

hydrateProceduresFromServer({
  procedures: [
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
  ],
  procedureHistory: [],
});

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
assert.equal(localStorage.getItem('book.procedures'), null);
assert.equal(localStorage.getItem('book.procedures.history'), null);

const repeated = assignProceduresToWorkplace({
  procedureIds: ['air-touch'],
  workplaceId: 'salon-b',
  workplaceName: 'Салон Б',
});
assert.equal(repeated.length, 0);
assert.equal(localStorage.getItem('book.procedures.history'), null);

const procedureServiceSource = readFileSync(new URL('../core/service/procedures/service.js', import.meta.url), 'utf8');
assert.match(procedureServiceSource, /pushProcedureHistory\(previous, 'updated'\)/);

const recordSource = readFileSync(new URL('../journal/record.js', import.meta.url), 'utf8');
const recordRuntimeSource = readFileSync(new URL('../ui/record/runtime.js', import.meta.url), 'utf8');
const recordCss = readFileSync(new URL('../ui/record/record.css', import.meta.url), 'utf8');
const buttonCss = readFileSync(new URL('../ui/buttons/buttons.css', import.meta.url), 'utf8');
assert.match(recordSource, /assignProceduresToWorkplace/);
assert.match(recordSource, /bindRecordSettings/);
assert.match(recordSource, /data-record-settings-from-price/);
assert.match(recordSource, /data-record-settings-add-procedure/);
assert.doesNotMatch(recordSource, /button\('Из прайса'/);
assert.doesNotMatch(recordSource, /data-record-from-price/);
assert.doesNotMatch(recordSource, /iconButton\('\+'/);
assert.match(recordRuntimeSource, /data-record-owner-settings/);
assert.match(recordRuntimeSource, /(?:data-v2-primary-action|dataset\.v2PrimaryAction)/);
assert.doesNotMatch(buttonCss, /data-record-from-price/);
assert.doesNotMatch(recordCss, /data-record-from-price/);
assert.doesNotMatch(recordSource, /saveProcedure/);

console.log('procedure workplace assignment tests: OK');

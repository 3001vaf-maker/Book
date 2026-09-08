import assert from 'node:assert/strict';
import { saveDays } from '../core/day.js';
import { getActiveDayWorkplaces, getAvailableDayWorkplaces, getDayWorkplaceDraft, saveDayWorkplaceTime } from '../core/day-workplaces.js';

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
  clear() { storage.clear(); },
};

const workplaces = [
  { key: 'beauty', name: 'Beauty Toria', from: '09:00', to: '18:00', color: '#111111' },
  { key: 'fairy', name: 'Фея', from: '09:00', to: '18:00', color: '#222222' },
  { key: 'studio', name: 'Studio 1', from: '12:00', to: '21:00', color: '#333333' },
];

saveDays([{ date: '2026-09-08', workplaceId: 'beauty', from: '12:00', to: '13:00' }]);

const active = getActiveDayWorkplaces('2026-09-08', workplaces);
assert.equal(active.length, 1);
assert.equal(active[0].workplaceId, 'beauty');
assert.equal(active[0].name, 'Beauty Toria');
assert.equal(active[0].from, '12:00');
assert.equal(active[0].to, '13:00');

const available = getAvailableDayWorkplaces('2026-09-08', workplaces);
assert.deepEqual(available.map((item) => item.key), ['fairy', 'studio']);

const draft = getDayWorkplaceDraft('2026-09-08', 'fairy', workplaces);
assert.equal(draft.existing, false);
assert.equal(draft.from, '13:00');
assert.equal(draft.to, '18:00');
assert.equal(draft.occupied.length, 1);

const saved = saveDayWorkplaceTime({ date: '2026-09-08', workplaceId: 'fairy', from: '13:00', to: '18:00' }, workplaces);
assert.equal(saved.ok, true);
assert.equal(getActiveDayWorkplaces('2026-09-08', workplaces).length, 2);

const conflict = saveDayWorkplaceTime({ date: '2026-09-08', workplaceId: 'studio', from: '12:30', to: '14:00' }, workplaces);
assert.equal(conflict.ok, false);
assert.equal(conflict.reason, 'schedule-conflict');

const edited = saveDayWorkplaceTime({ date: '2026-09-08', workplaceId: 'beauty', from: '10:00', to: '12:30' }, workplaces);
assert.equal(edited.ok, true);
const beauty = getActiveDayWorkplaces('2026-09-08', workplaces).find((item) => item.workplaceId === 'beauty');
assert.equal(beauty.from, '10:00');
assert.equal(beauty.to, '12:30');

console.log('day workplace tests: OK');

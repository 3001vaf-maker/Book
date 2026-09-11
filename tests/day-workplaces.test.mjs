import assert from 'node:assert/strict';
import { saveDays } from '../core/day.js';
import { getActiveDayWorkplaces, getAvailableDayWorkplaces } from '../core/day-workplaces.js';
import { getWorkplaceWorkingDates } from '../core/workplace-time.js';

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

saveDays([
  { date: '2026-09-10', workplaceId: 'beauty', from: '12:00', to: '13:00' },
  { date: '2026-09-08', workplaceId: 'beauty', from: '12:00', to: '13:00' },
]);

assert.deepEqual(getWorkplaceWorkingDates('beauty'), ['2026-09-08', '2026-09-10']);
assert.deepEqual(getWorkplaceWorkingDates('fairy'), []);

const active = getActiveDayWorkplaces('2026-09-08', workplaces);
assert.equal(active.length, 1);
assert.equal(active[0].workplaceId, 'beauty');
assert.equal(active[0].name, 'Beauty Toria');
assert.equal(active[0].from, '12:00');
assert.equal(active[0].to, '13:00');

const available = getAvailableDayWorkplaces('2026-09-08', workplaces);
assert.deepEqual(available.map((item) => item.key), ['fairy', 'studio']);

console.log('day workplace tests: OK');

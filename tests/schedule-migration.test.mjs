import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const { migrateScheduleV1 } = await import('../core/migrations/schedule-v1.js');
const { getDays, getDayTime } = await import('../core/day.js');

const workplaces = [
  { key: 'salon-a', name: 'Салон A', from: '09:00', to: '18:00' },
  { key: 'salon-b', name: 'Салон B', from: '11:00', to: '20:00' },
];

store.set('book:timetable-state', JSON.stringify({
  workingDates: ['2026-09-10', '2026-09-11'],
  workingDays: [
    { workplaceId: 'salon-b', date: '2026-09-12' },
  ],
}));
store.set('book.timeWorks', JSON.stringify([
  { workplaceId: 'salon-a', date: '2026-09-10', from: '10:00', to: '16:00' },
  { workplaceId: 'salon-b', date: '2026-09-12', from: '12:00', to: '17:00' },
]));

const result = migrateScheduleV1(workplaces);
assert.equal(result.migrated, true);

const days = getDays();
assert.deepEqual(
  days.find((day) => day.workplaceId === 'salon-a' && day.date === '2026-09-10'),
  { workplaceId: 'salon-a', date: '2026-09-10', from: '10:00', to: '16:00' },
);
assert.deepEqual(
  days.find((day) => day.workplaceId === 'salon-a' && day.date === '2026-09-11'),
  { workplaceId: 'salon-a', date: '2026-09-11', from: '09:00', to: '18:00' },
);
assert.deepEqual(
  days.find((day) => day.workplaceId === 'salon-b' && day.date === '2026-09-12'),
  { workplaceId: 'salon-b', date: '2026-09-12', from: '12:00', to: '17:00' },
);

assert.equal(store.has('book.timeWorks'), false);
const canonicalState = JSON.parse(store.get('book:timetable-state'));
assert.deepEqual(Object.keys(canonicalState), ['workingDays']);
assert.equal(Array.isArray(canonicalState.workingDays), true);

const second = migrateScheduleV1(workplaces);
assert.equal(second.migrated, false);
assert.equal(second.reason, 'already-canonical');

store.set('book.timeWorks', JSON.stringify([
  { workplaceId: 'salon-a', date: '2026-09-20', from: '01:00', to: '02:00' },
]));
const fallback = getDayTime({ workplaceId: 'salon-a', date: '2026-09-20' }, workplaces);
assert.deepEqual(fallback, { from: '09:00', to: '18:00' });

console.log('schedule migration tests: OK');

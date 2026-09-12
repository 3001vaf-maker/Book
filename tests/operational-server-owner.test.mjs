import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.sessionStorage = { getItem: () => 'test-token', setItem: () => {}, removeItem: () => {} };
globalThis.window = { dispatchEvent: () => {} };
globalThis.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };

localStorage.setItem('book:timetable-state', JSON.stringify({ workingDays: [{ date: '2026-09-01', workplaceId: 'legacy', from: '09:00', to: '10:00' }] }));
localStorage.setItem('book.journalBreaks', JSON.stringify([{ id: 'legacy-break', workplaceId: 'legacy', date: '2026-09-01', from: '09:30', to: '09:45' }]));
localStorage.setItem('book.procedures', JSON.stringify([{ id: 'legacy-procedure', name: 'Legacy' }]));
localStorage.setItem('book.procedures.history', JSON.stringify([]));
localStorage.setItem('book.booking-settings.v1', JSON.stringify({ welcomeTitle: 'Legacy', slotStep: 10 }));

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || 'GET', body: options.body || '' });
  return { ok: true, status: 200, json: async () => ({}) };
};

const persistence = await import('../core/business-persistence.js');
await import('../operational-migration.js');
const day = await import('../core/day/index.js');
const breaks = await import('../journal/break-data.js');
const procedures = await import('../settings/service/procedures/data.js');
const booking = await import('../core/booking-settings/index.js');

const legacyDaysRaw = localStorage.getItem('book:timetable-state');
const legacyBreaksRaw = localStorage.getItem('book.journalBreaks');
const legacyProceduresRaw = localStorage.getItem('book.procedures');
const legacyBookingRaw = localStorage.getItem('book.booking-settings.v1');

persistence.setBusinessServerReady(true);
day.hydrateDaysFromServer([{ date: '2026-10-01', workplaceId: 'server', from: '10:00', to: '18:00' }]);
breaks.hydrateBreaksFromServer([{ id: 'server-break', workplaceId: 'server', date: '2026-10-01', from: '13:00', to: '13:30' }]);
procedures.hydrateProceduresFromServer({ procedures: [{ id: 'server-procedure', name: 'Стрижка' }], procedureHistory: [] });
booking.hydrateBookingSettingsFromServer({ welcomeTitle: 'Server', welcomeText: 'Text', slotStep: 15, theme: {} });

assert.equal(day.getDays()[0].workplaceId, 'server');
assert.equal(breaks.getBreakRows()[0].id, 'server-break');
assert.equal(procedures.getProcedures()[0].id, 'server-procedure');
assert.equal(booking.getBookingSettings().welcomeTitle, 'Server');

day.saveDays([{ date: '2026-10-02', workplaceId: 'server', from: '11:00', to: '18:00' }]);
breaks.insertBreakRow({ id: 'server-break-2', workplaceId: 'server', date: '2026-10-02', from: '14:00', to: '14:30' });
procedures.saveProcedure({ id: 'server-procedure-2', name: 'Окрашивание' });
booking.saveBookingSettings({ welcomeTitle: 'Updated', welcomeText: 'Text', slotStep: 10, theme: {} });
await persistence.flushBusinessPersistence({ timeoutMs: 2000 });

assert.equal(localStorage.getItem('book:timetable-state'), legacyDaysRaw);
assert.equal(localStorage.getItem('book.journalBreaks'), legacyBreaksRaw);
assert.equal(localStorage.getItem('book.procedures'), legacyProceduresRaw);
assert.equal(localStorage.getItem('book.booking-settings.v1'), legacyBookingRaw);
assert.ok(calls.some((call) => call.url.endsWith('/business-state/operational/days') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.endsWith('/business-state/operational/breaks') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.endsWith('/business-state/operational/procedures') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.endsWith('/business-state/operational/bookingSettings') && call.method === 'PUT'));

console.log('operational server owner tests: OK');

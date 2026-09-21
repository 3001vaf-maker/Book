import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const persistence = source('core/business-persistence.js');
const serverSync = source('online-booking/server-sync.js');
const payment = source('journal/record-payment.js');
const recordView = source('journal/record-view.js');
const journal = source('journal/journal.js');
const timetable = source('timetable/timetable.js');
const profile = source('settings/profile/data.js');
const workplaces = source('settings/profile/workplaces/data.js');

const frontendSources = [
  persistence,
  serverSync,
  payment,
  recordView,
  journal,
  timetable,
  profile,
  workplaces,
];

frontendSources.forEach((text) => {
  assert.doesNotMatch(text, /location\.reload\s*\(/);
});

assert.match(persistence, /book:server-mutation-completed/);
assert.match(persistence, /markMutationCompleted\(item\.path\)/);
assert.match(persistence, /reportCompletedMutationBatch\(\)/);
assert.match(persistence, /item\.resolve\?\.\(result\)/);

assert.match(serverSync, /apiRequest\('\/business-state'\)/);
assert.match(serverSync, /apiRequest\('\/business-state\/operational'\)/);
assert.match(serverSync, /apiRequest\('\/tenant-document-archive'\)/);
assert.match(serverSync, /apiRequest\('\/profile'\)/);
assert.match(serverSync, /apiRequest\('\/auxiliary-state'\)/);
assert.match(serverSync, /apiRequest\('\/finance'\)/);
assert.match(serverSync, /hydrateRecordStateFromServer/);
assert.match(serverSync, /hydrateDaysFromServer/);
assert.match(serverSync, /hydrateProceduresFromServer/);
assert.match(serverSync, /hydrateProductsFromServer/);
assert.match(serverSync, /hydrateWalletsFromServer/);
assert.match(serverSync, /hydrateProfileFromServer/);
assert.match(serverSync, /hydrateWorkplacesFromServer/);
assert.match(serverSync, /hydrateFinanceFromServer/);
assert.match(serverSync, /book:server-mutation-completed/);
assert.match(serverSync, /event\?\.detail\?\.scopes/);
assert.match(serverSync, /book:records-changed/);
assert.match(serverSync, /book:time-usage-changed/);
assert.match(serverSync, /book:people-changed/);
assert.match(serverSync, /book:documents-changed/);
assert.match(serverSync, /book:procedures-changed/);
assert.match(serverSync, /book:products-changed/);
assert.match(serverSync, /book:wallets-changed/);
assert.match(serverSync, /book:profile-changed/);
assert.match(serverSync, /book:workplaces-changed/);
assert.match(serverSync, /book:dds-changed/);

assert.match(payment, /refreshPaidStateForPayment/);
assert.match(payment, /event\?\.detail\?\.action === 'server-refresh'/);
assert.match(recordView, /book:people-changed/);
assert.match(journal, /book:products-changed/);
assert.match(journal, /book:workplaces-changed/);
assert.match(timetable, /book:time-usage-changed/);
assert.match(timetable, /book:workplaces-changed/);
assert.match(profile, /book:profile-changed/);
assert.match(workplaces, /book:workplaces-changed/);

console.log('post mutation sync tests: OK');

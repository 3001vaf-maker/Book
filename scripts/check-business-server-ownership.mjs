import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const failures = [];
const core = read('core.js');
const clients = read('main/clients/data.js');
const uei = read('core/uei.js');
const records = read('core/record/data.js');
const online = read('server/src/online-booking/online-booking.service.ts');
const app = read('server/src/app.module.ts');
const schema = read('server/prisma/schema.prisma');

if (!core.includes('await initializeBusinessState(authenticatedAccount)')) failures.push('Authenticated Book must hydrate Clients/UEI/Record from server before rendering.');
if (!clients.includes('hydrateClientsFromServer') || !clients.includes('queuePersonUpsert')) failures.push('Person owner must use server-hydrated runtime state and server writes.');
if (!uei.includes('hydrateUEIFromServer') || !uei.includes('queueUEIStore')) failures.push('UEI owner must use server-hydrated runtime state and server writes.');
if (!records.includes('hydrateRecordStateFromServer') || !records.includes('queueRecordUpsert') || !records.includes('queueRecordEventUpsert')) failures.push('Record persistence gateway must use server-hydrated rows and server writes.');
if (!online.includes('upsertBookingPersonFromAccount') || !online.includes('createOnlineBookingRecord')) failures.push('Online booking must write canonical Person/Record facts directly on the server.');
if (!app.includes('BusinessStateModule')) failures.push('Nest application must register BusinessStateModule.');
for (const model of ['BusinessStateMeta', 'BusinessPerson', 'BusinessIdentityState', 'BusinessRecord', 'BusinessRecordEvent']) {
  if (!schema.includes(`model ${model}`)) failures.push(`Prisma schema is missing ${model}.`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('business server ownership check: OK');

import fs from 'node:fs';

function read(path) { return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'); }
const failures = [];
const core = read('core.js');
const day = read('core/day/data.js');
const breaks = read('journal/break-data.js');
const procedures = read('settings/service/procedures/data.js');
const booking = read('core/booking-settings/index.js');
const online = read('server/src/online-booking/online-booking.service.ts');
const migration = read('operational-migration.js');
const server = read('server/src/business-state/business-state.service.ts');
const schema = read('server/prisma/schema.prisma');

if (!core.includes('await initializeOperationalState(authenticatedAccount)')) failures.push('Book must hydrate operational booking facts before rendering.');
if (!day.includes('hydrateDaysFromServer') || !day.includes("queueOperationalDataset('days'")) failures.push('Day must become server-owned after migration.');
if (!breaks.includes('hydrateBreaksFromServer') || !breaks.includes('configureBreakPersistence') || !migration.includes("queueOperationalDataset('breaks'")) failures.push('Break must become server-owned after migration.');
if (!procedures.includes('hydrateProceduresFromServer') || !procedures.includes("queueOperationalDataset('procedures'")) failures.push('Procedures must become server-owned after migration.');
if (!booking.includes('hydrateBookingSettingsFromServer') || !booking.includes("queueOperationalDataset('bookingSettings'")) failures.push('Booking settings must become server-owned after migration.');
if (!online.includes('this.businessState.publicOperational(tenantId)')) failures.push('Public online booking must consume canonical server operational facts directly.');
if (!server.includes('businessOperationalState') || !server.includes('verifyOperationalMigration')) failures.push('Server must own verified operational migration.');
if (!schema.includes('model BusinessOperationalState')) failures.push('Prisma must define BusinessOperationalState.');

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('operational server ownership check: OK');

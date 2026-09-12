import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const failures = [];
const journal = read('journal/record.js');
const metadata = read('main/clients/metadata.js');
const business = read('server/src/business-state/business-state.service.ts');
const server = read('server/src/online-booking/online-booking.service.ts');

if (!journal.includes("import { getClients } from '../main/clients/data.js';") || journal.includes('getAllClients')) {
  failures.push('Journal must select the canonical visible Clients projection, not raw UEI members.');
}
if (!metadata.includes('getIdentityMemberKeys') || !metadata.includes('identityKeys.has')) {
  failures.push('Client metadata must aggregate Record history across current UEI members.');
}
if (!business.includes('bookingIdentityForAccount') || !business.includes('memberPeople') || !business.includes('accountIds')) {
  failures.push('Server BusinessState must resolve Account identity through canonical UEI members.');
}
if (!server.includes('const accountIds = identity?.accountIds') || !server.includes('accountId: { in: accountIds }')) {
  failures.push('Booking Account history must resolve all Accounts from canonical UEI identity.');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('UEI identity architecture check: OK');

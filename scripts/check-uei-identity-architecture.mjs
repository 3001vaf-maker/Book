import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const failures = [];
const journal = read('journal/record.js');
const metadata = read('main/clients/metadata.js');
const bridge = read('online-booking/owner-bridge.js');
const server = read('server/src/online-booking/online-booking.service.ts');

if (!journal.includes("import { getClients } from '../main/clients/data.js';") || journal.includes('getAllClients')) {
  failures.push('Journal must select the canonical visible Clients projection, not raw UEI members.');
}
if (!metadata.includes('getIdentityMemberKeys') || !metadata.includes('identityKeys.has')) {
  failures.push('Client metadata must aggregate Record history across current UEI members.');
}
if (!bridge.includes('findIdentityOwnerByAccountId') || !bridge.includes('getClientMetadata(current.key)')) {
  failures.push('Owner bridge must synchronize one canonical master fact set to every Account in the UEI.');
}
if (!server.includes('accountId: { in: accountIds }') || !server.includes('where: { tenantId, uei }')) {
  failures.push('Booking Account history must resolve all Accounts sharing the current UEI.');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('UEI identity architecture check: OK');

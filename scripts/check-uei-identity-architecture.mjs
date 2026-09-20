import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const failures = [];
const journal = read('journal/record.js');
const metadata = read('main/people/metadata.js');
const business = read('server/src/business-state/business-state.service.ts');
const server = read('server/src/online-booking/online-booking.service.ts');

if (!journal.includes("import { getPeople } from '../main/people/data.js';") || journal.includes('getAllPeople')) {
  failures.push('Journal must select the canonical visible People projection, not raw UEI members.');
}
if (!metadata.includes('getIdentityMemberKeys') || !metadata.includes('identityKeys.has')) {
  failures.push('Person metadata must aggregate Record history across current UEI members.');
}
if (!business.includes('bookingIdentityForAccount') || !business.includes('memberPeople') || !business.includes('accountIds')) {
  failures.push('Server BusinessState must resolve Account identity through canonical UEI members.');
}
if (!server.includes('identity?.memberPeople') || !server.includes('this.records.listForPeople(tenantId, people)')) {
  failures.push('Account Record history must resolve all canonical UEI member People before reading Records.');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('UEI identity architecture check: OK');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertNoNewPersonContactConflicts } from '../core/person-contact/index.js';

const person = (key, values = {}) => ({ key, name: key, phones: [], emails: [], telegrams: [], ...values });

assert.throws(() => assertNoNewPersonContactConflicts(
  [person('a', { phones: ['+7 903 000-00-01'] })],
  [person('a', { phones: ['+7 903 000-00-01'], uei: '0020' }), person('b', { phones: ['8 903 000 00 01'] })],
), /Телефон уже принадлежит клиенту 0020/);

assert.doesNotThrow(() => assertNoNewPersonContactConflicts(
  [person('a', { phones: ['+7 903 000-00-01'] }), person('b', { phones: ['8 903 000 00 01'] })],
  [person('a', { phones: ['+7 903 000-00-01'] }), person('b', { phones: ['8 903 000 00 01'] })],
));

assert.throws(() => assertNoNewPersonContactConflicts(
  [person('a', { emails: ['Client@Example.com'] })],
  [person('a', { emails: ['Client@Example.com'] }), person('b', { emails: ['client@example.com'] })],
), /Email уже принадлежит клиенту/);

assert.throws(() => assertNoNewPersonContactConflicts(
  [person('a', { telegrams: ['@Example_User'] })],
  [person('a', { telegrams: ['@Example_User'] }), person('b', { telegrams: ['example_user'] })],
), /Telegram уже принадлежит клиенту/);

const peopleData = await readFile(new URL('../main/people/data.js', import.meta.url), 'utf8');
const peopleUi = await readFile(new URL('../main/people/clients.js', import.meta.url), 'utf8');
const personCreate = await readFile(new URL('../main/people/create.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../server/src/business-state/person-contact-rules.service.ts', import.meta.url), 'utf8');
const controller = await readFile(new URL('../server/src/business-state/business-state.controller.ts', import.meta.url), 'utf8');
const personLink = await readFile(new URL('../server/src/online-booking/person-card-link.service.ts', import.meta.url), 'utf8');
const booking = await readFile(new URL('../server/src/online-booking/online-booking.service.ts', import.meta.url), 'utf8');
const bookingController = await readFile(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const personThread = await readFile(new URL('../server/src/communication/person-profile-thread.service.ts', import.meta.url), 'utf8');
const route = await readFile(new URL('../server/src/communication/person-contact-route.service.ts', import.meta.url), 'utf8');
const dispatch = await readFile(new URL('../server/src/communication/communication-dispatch.service.ts', import.meta.url), 'utf8');
const broadcast = await readFile(new URL('../server/src/communication/communication-broadcast.service.ts', import.meta.url), 'utf8');

assert.match(peopleData, /assertNoNewPersonContactConflicts\(peopleState, validationPeople\)/);
assert.match(peopleData, /uei: getUEI\('person', person\.key\) \|\| ''/);
assert.match(peopleData, /contactViaUei:/);
assert.match(peopleUi, /label:'Связь через'/);
assert.match(peopleUi, /label:option\.value/);
assert.doesNotMatch(peopleUi, /linkValue&&!hasContact/);
assert.match(personCreate, /phoneField\(\{ label: 'Телефон', name: 'phone'/);
assert.doesNotMatch(personCreate, /phoneField\(\{[^}]*required:\s*true/);

assert.match(rules, /Телефон/);
assert.match(rules, /Email/);
assert.match(rules, /Telegram/);
assert.match(rules, /validateUeiUpdate/);
assert.match(controller, /validatePersonUpsert/);
assert.match(controller, /validateUeiUpdate/);
assert.match(personLink, /assertUnambiguousPhone/);
assert.match(personThread, /canonicalKeys\.size > 1/);
assert.match(personLink, /validateNewAccountContacts/);
assert.match(personLink, /validateAccountContactUpdate/);
assert.match(bookingController, /validateNewAccountContacts/);
assert.match(bookingController, /validateAccountContactUpdate/);
assert.ok(
  booking.includes("if (!/^\\+\\d{8,15}$/.test(phone)) throw new BadRequestException('Введите телефон полностью')"),
  'Client self-registration must keep phone mandatory',
);

assert.match(route, /contactViaUei/);
assert.match(route, /accessibleProfilesForAccount/);
assert.match(dispatch, /profileKey: input\?\.profileKey/);
assert.match(broadcast, /profileKey: recipient\.personKey/);
assert.doesNotMatch(broadcast, /filter\(\(person\) => person\.personKey && person\.phone\)/, 'Clients without their own phone must remain eligible through Связь через');

console.log('person-contact-link.test.mjs: ok');

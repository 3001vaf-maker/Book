import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertNoNewClientContactConflicts } from '../core/client-contact/index.js';

const person = (key, values = {}) => ({ key, name: key, phones: [], emails: [], telegrams: [], ...values });

assert.throws(() => assertNoNewClientContactConflicts(
  [person('a', { phones: ['+7 903 000-00-01'] })],
  [person('a', { phones: ['+7 903 000-00-01'] }), person('b', { phones: ['8 903 000 00 01'] })],
), /Телефон уже принадлежит клиенту/);

assert.doesNotThrow(() => assertNoNewClientContactConflicts(
  [person('a', { phones: ['+7 903 000-00-01'] }), person('b', { phones: ['8 903 000 00 01'] })],
  [person('a', { phones: ['+7 903 000-00-01'] }), person('b', { phones: ['8 903 000 00 01'] })],
));

assert.throws(() => assertNoNewClientContactConflicts(
  [person('a', { emails: ['Client@Example.com'] })],
  [person('a', { emails: ['Client@Example.com'] }), person('b', { emails: ['client@example.com'] })],
), /Email уже принадлежит клиенту/);

assert.throws(() => assertNoNewClientContactConflicts(
  [person('a', { telegrams: ['@Example_User'] })],
  [person('a', { telegrams: ['@Example_User'] }), person('b', { telegrams: ['example_user'] })],
), /Telegram уже принадлежит клиенту/);

const clientData = await readFile(new URL('../main/clients/data.js', import.meta.url), 'utf8');
const clientUi = await readFile(new URL('../main/clients/clients.js', import.meta.url), 'utf8');
const clientCreate = await readFile(new URL('../main/clients/create.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../server/src/business-state/client-contact-rules.service.ts', import.meta.url), 'utf8');
const controller = await readFile(new URL('../server/src/business-state/business-state.controller.ts', import.meta.url), 'utf8');
const cardLink = await readFile(new URL('../server/src/online-booking/client-card-link.service.ts', import.meta.url), 'utf8');
const booking = await readFile(new URL('../server/src/online-booking/online-booking.service.ts', import.meta.url), 'utf8');
const bookingController = await readFile(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const route = await readFile(new URL('../server/src/communication/client-contact-route.service.ts', import.meta.url), 'utf8');
const dispatch = await readFile(new URL('../server/src/communication/communication-dispatch.service.ts', import.meta.url), 'utf8');
const broadcast = await readFile(new URL('../server/src/communication/communication-broadcast.service.ts', import.meta.url), 'utf8');

assert.match(clientData, /assertNoNewClientContactConflicts\(peopleState, normalized\)/);
assert.match(clientData, /contactViaUei:/);
assert.match(clientUi, /label:'Связь через'/);
assert.match(clientUi, /label:option\.value/);
assert.match(clientCreate, /phoneField\(\{ label: 'Телефон', name: 'phone'/);
assert.doesNotMatch(clientCreate, /phoneField\(\{[^}]*required:\s*true/);

assert.match(rules, /Телефон/);
assert.match(rules, /Email/);
assert.match(rules, /Telegram/);
assert.match(controller, /validatePersonUpsert/);
assert.match(cardLink, /assertUnambiguousPhone/);
assert.match(cardLink, /validateNewAccountContacts/);
assert.match(cardLink, /validateAccountContactUpdate/);
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

console.log('client-contact-link.test.mjs: ok');

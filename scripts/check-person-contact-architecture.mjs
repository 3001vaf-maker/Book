import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const failures = [];
const peopleData = read('main/people/data.js');
const peopleUi = read('main/people/clients.js');
const rules = read('server/src/business-state/person-contact-rules.service.ts');
const controller = read('server/src/business-state/business-state.controller.ts');
const personLink = read('server/src/online-booking/person-card-link.service.ts');
const booking = read('server/src/online-booking/online-booking.service.ts');
const bookingController = read('server/src/online-booking/online-booking.controller.ts');
const personThread = read('server/src/communication/person-profile-thread.service.ts');
const route = read('server/src/communication/person-contact-route.service.ts');
const resolver = read('server/src/communication/communication-channel-resolver.service.ts');
const broadcast = read('server/src/communication/communication-broadcast.service.ts');

if (!peopleData.includes('assertNoNewPersonContactConflicts(peopleState, validationPeople)')) {
  failures.push('Client state must reject newly introduced duplicate Contact Points.');
}
if (!peopleData.includes("uei: getUEI('person', person.key) || ''")) {
  failures.push('Duplicate Contact Point errors must retain the master UEI code for the existing client.');
}
if (!peopleData.includes('contactViaUei')) {
  failures.push('Client Person data must retain the contact-via relation.');
}
if (!peopleUi.includes("label:'Связь через'") || !peopleUi.includes('label:option.value')) {
  failures.push('Client UI must expose Связь через using UEI code as the primary selector label.');
}
if (peopleUi.includes('linkValue&&!hasContact')) {
  failures.push('A contactless client is a full Person and must never be deleted when linked by UEI.');
}
if (!rules.includes('validatePersonUpsert') || !controller.includes('validatePersonUpsert')) {
  failures.push('Server must enforce Contact Point uniqueness independently of the UI.');
}
if (!rules.includes('validateUeiUpdate') || !controller.includes('validateUeiUpdate')) {
  failures.push('UEI updates must stay separate from the contact-via relation and reject self/cyclic routing.');
}
if (!personLink.includes('assertUnambiguousPhone') || !personThread.includes('canonicalKeys.size > 1')) {
  failures.push('Legacy duplicate phones must never silently choose the first Person.');
}
if (!personLink.includes('validateNewAccountContacts') || !bookingController.includes('validateNewAccountContacts')) {
  failures.push('Client registration must validate Contact Point uniqueness before BookingAccount creation.');
}
if (!personLink.includes('validateAccountContactUpdate') || !bookingController.includes('validateAccountContactUpdate')) {
  failures.push('Client account contact changes must be validated before BookingAccount update.');
}
if (!booking.includes("if (!/^\\+\\d{8,15}$/.test(phone)) throw new BadRequestException('Введите телефон полностью')")) {
  failures.push('Client self-registration must keep phone mandatory.');
}
if (!route.includes('contactViaUei') || !resolver.includes('contactRoutes.resolve')) {
  failures.push('Communication delivery must resolve through the separate contact-via relation.');
}
if (!broadcast.includes('profileKey: recipient.personKey')) {
  failures.push('Broadcast delivery must preserve the subject Person while resolving another delivery contact.');
}
if (broadcast.includes('.filter((person) => person.personKey && person.phone)')) {
  failures.push('Clients without their own phone must remain eligible for delivery through Связь через.');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('Client contact architecture check: OK');

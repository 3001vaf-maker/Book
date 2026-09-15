import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const failures = [];
const clientData = read('main/clients/data.js');
const clientUi = read('main/clients/clients.js');
const rules = read('server/src/business-state/client-contact-rules.service.ts');
const controller = read('server/src/business-state/business-state.controller.ts');
const cardLink = read('server/src/online-booking/client-card-link.service.ts');
const booking = read('server/src/online-booking/online-booking.service.ts');
const bookingController = read('server/src/online-booking/online-booking.controller.ts');
const profileThread = read('server/src/communication/client-profile-thread.service.ts');
const route = read('server/src/communication/client-contact-route.service.ts');
const resolver = read('server/src/communication/communication-channel-resolver.service.ts');
const broadcast = read('server/src/communication/communication-broadcast.service.ts');

if (!clientData.includes('assertNoNewClientContactConflicts(peopleState, validationPeople)')) {
  failures.push('Client state must reject newly introduced duplicate Contact Points.');
}
if (!clientData.includes("uei: getUEI('person', person.key) || ''")) {
  failures.push('Duplicate Contact Point errors must retain the master UEI code for the existing client.');
}
if (!clientData.includes('contactViaUei')) {
  failures.push('Client Person data must retain the contact-via relation.');
}
if (!clientUi.includes("label:'Связь через'") || !clientUi.includes('label:option.value')) {
  failures.push('Client UI must expose Связь через using UEI code as the primary selector label.');
}
if (!rules.includes('validatePersonUpsert') || !controller.includes('validatePersonUpsert')) {
  failures.push('Server must enforce Contact Point uniqueness independently of the UI.');
}
if (!rules.includes('validateUeiUpdate') || !controller.includes('validateUeiUpdate')) {
  failures.push('UEI updates must stay separate from the contact-via relation and reject self/cyclic routing.');
}
if (!cardLink.includes('assertUnambiguousPhone') || !profileThread.includes('canonicalKeys.size > 1')) {
  failures.push('Legacy duplicate phones must never silently choose the first Person.');
}
if (!cardLink.includes('validateNewAccountContacts') || !bookingController.includes('validateNewAccountContacts')) {
  failures.push('Client registration must validate Contact Point uniqueness before BookingAccount creation.');
}
if (!cardLink.includes('validateAccountContactUpdate') || !bookingController.includes('validateAccountContactUpdate')) {
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

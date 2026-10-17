import fs from 'node:fs';

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const read = (path) => fs.readFileSync(path, 'utf8');

const account = read('online-booking/account.js');
const booking = read('online-booking/booking.js');
const userEntry = read('online-booking/user-entry.js');
const accountShell = read('online-booking/account-shell.js');
const records = read('records/records.js');
const bookingModel = read('online-booking/model.js');
const bookingSettings = read('settings/online-booking/online-booking.js');
const notificationSettings = read('settings/notifications/notifications.js');
const accountApi = read('core/account/index.js');

expect(!fs.existsSync('online-booking/booking-x.js'), 'booking-x.js must not exist.');
expect(account.includes('export async function renderGlobalClient'), 'Account must own the global end-user account entry.');
expect(account.includes("from './account-shell.js'"), 'Account must render through the canonical account shell.');
expect(!account.includes("from '../records/records.js'"), 'Account must not own Records.');
expect(!account.includes('createBookingRequest('), 'Account must not create booking records directly.');
expect(account.includes("params.set('booking', id)"), 'Account Booking action must route by tenant identity.');
expect(account.includes("params.set('workplace', workplaceKey)"), 'Workplace Booking action must preserve the selected workplace.');
expect(account.includes("params.set('procedures', procedureIds.join(','))"), 'Repeat Booking must preserve procedures.');

expect(booking.includes("from '../records/records.js'"), 'Booking must call canonical Records.');
expect(booking.includes('openRecords({'), 'Booking must hand the flow to Records.');
expect(!booking.includes('function renderWorkplaces('), 'Booking must not own a second workplace Record step.');
expect(!booking.includes('function renderProcedures('), 'Booking must not own a second procedure Record step.');
expect(!booking.includes('function renderDates('), 'Booking must not own a second date Record step.');
expect(!booking.includes('function renderTimes('), 'Booking must not own a second time Record step.');
expect(!booking.includes('function renderConfirmation('), 'Booking must not own a second confirmation Record step.');
expect(booking.includes('getBookingTimeRows(state.context'), 'Booking provider must use canonical online availability.');
expect(booking.includes('createBookingRequest(state.tenantId'), 'Booking provider must write through the canonical booking API.');
expect(booking.includes('lockedWorkplaceKey'), 'Booking must accept an already selected workplace.');
expect(booking.includes('workplaceId: initialWorkplace'), 'Booking must pass a locked workplace to Records.');
expect(booking.includes('professionalActions: false'), 'End-user Booking must not expose professional Record actions.');
expect(booking.includes('getAccountPlatformState(state.tenantId)') && booking.includes('getAccountConsentState(state.tenantId)'), 'Booking must preserve platform and tenant legal gates.');
expect(booking.includes('registerAccount(state.tenantId') && booking.includes('loginAccount(state.tenantId'), 'Online Booking must preserve registration/login when required.');

expect(records.includes('export function openRecords'), 'Records must remain the single Record creation owner.');
expect(records.includes('const renderWorkplaces = () =>') && records.includes('const renderProcedures = () =>') && records.includes('const renderDates = () =>') && records.includes('const renderTimes = () =>') && records.includes('const renderConfirmation = () =>'), 'Records must own the complete Record step sequence.');

expect(userEntry.includes("params.get('booking')"), 'End-user entry must resolve Booking started from Account.');
expect(userEntry.includes('async function onlineBookingRoute()'), 'End-user entry must resolve public online links separately.');
expect(userEntry.includes("resolveBookingPublicRoute(pathRoute.profileSlug, pathRoute.workplaceSlug)"), 'Online link must resolve professional/workplace identity.');
expect(userEntry.includes("from './account.js'"), 'End-user entry must load Account separately.');
expect(userEntry.includes("from './booking.js'"), 'End-user entry must load Booking separately.');
expect(userEntry.includes('if (accountBooking)'), 'Account Booking must be handled before public online routing.');

expect(accountShell.includes("data: 'data-global-contact-booking'"), 'Contact must expose Booking.');
expect(accountShell.includes("handlers.onStartBooking?.(tenantId"), 'Contact Booking button must call the Booking route.');
expect(accountShell.includes("bindContactHeaderActions(root, state, handlers, relationship, { workplaceKey: key })"), 'Workplace Booking button must preserve workplace identity.');
expect(accountShell.includes("handlers.onStartBooking?.(tenantId, request)"), 'History repeat Booking must call the same Booking route.');
expect(accountShell.includes("data: 'data-global-contact-chat'"), 'Contact chat button must remain bound.');
expect(accountShell.includes('openGlobalContactSettings'), 'Contact settings button must remain bound.');

expect(bookingModel.includes('getBookingTimeRows'), 'Online availability model must remain canonical.');
expect(accountApi.includes('resolveBookingPublicRoute') && accountApi.includes('createBookingRequest'), 'Account API must expose route resolution and booking creation.');
expect(bookingSettings.includes("from '../../core/booking-settings/index.js'"), 'Online booking settings must use canonical settings.');
expect(notificationSettings.includes('Push — всегда'), 'Notification delivery contract must remain intact.');

if (failures.length) {
  console.error('Booking/account architecture check failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Booking/account architecture check passed.');

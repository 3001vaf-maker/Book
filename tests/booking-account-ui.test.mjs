import assert from 'node:assert/strict';
import fs from 'node:fs';

const account = fs.readFileSync('online-booking/account.js', 'utf8');
const booking = fs.readFileSync('online-booking/booking.js', 'utf8');
const userEntry = fs.readFileSync('online-booking/user-entry.js', 'utf8');
const accountShell = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const records = fs.readFileSync('records/records.js', 'utf8');
const accountApi = fs.readFileSync('core/account/index.js', 'utf8');

assert.equal(fs.existsSync('online-booking/booking-x.js'), false);

// Account is the end-user profile/contacts owner. It does not own Records.
assert.match(account, /export async function renderGlobalClient/);
assert.match(account, /renderGlobalAccount\(root, state/);
assert.doesNotMatch(account, /from '\.\.\/records\/records\.js'/);
assert.doesNotMatch(account, /createBookingRequest\(/);
assert.match(account, /params\.set\('booking', id\)/);
assert.match(account, /params\.set\('workplace', workplaceKey\)/);
assert.match(account, /params\.set\('procedures', procedureIds\.join\(','\)\)/);

// Booking is one adapter into canonical Records.
assert.match(booking, /from '\.\.\/records\/records\.js'/);
assert.match(booking, /openRecords\(\{/);
assert.match(booking, /context: 'online'/);
assert.match(booking, /professionalActions: false/);
assert.match(booking, /workplaceId: initialWorkplace/);
assert.match(booking, /getBookingTimeRows\(state\.context/);
assert.match(booking, /createBookingRequest\(state\.tenantId/);
assert.doesNotMatch(booking, /function renderWorkplaces\(/);
assert.doesNotMatch(booking, /function renderProcedures\(/);
assert.doesNotMatch(booking, /function renderDates\(/);
assert.doesNotMatch(booking, /function renderTimes\(/);
assert.doesNotMatch(booking, /function renderConfirmation\(/);

// Records owns the actual Record workflow.
assert.match(records, /export function openRecords/);
assert.match(records, /const renderWorkplaces = \(\) =>/);
assert.match(records, /const renderProcedures = \(\) =>/);
assert.match(records, /const renderDates = \(\) =>/);
assert.match(records, /const renderTimes = \(\) =>/);
assert.match(records, /const renderConfirmation = \(\) =>/);

// Internal Booking and external Online entry are different routes into the same Booking.
assert.match(userEntry, /function accountBookingRoute\(\)/);
assert.match(userEntry, /params\.get\('booking'\)/);
assert.match(userEntry, /async function onlineBookingRoute\(\)/);
assert.match(userEntry, /resolveBookingPublicRoute\(pathRoute\.profileSlug, pathRoute\.workplaceSlug\)/);
assert.match(userEntry, /if \(accountBooking\)/);
assert.match(userEntry, /renderBookingRoute\(accountBooking\)/);
assert.match(userEntry, /renderBookingRoute\(onlineBooking\)/);

// Every end-user Booking button feeds the same route.
assert.match(accountShell, /data-global-contact-booking/);
assert.match(accountShell, /handlers\.onStartBooking\?\.\(tenantId/);
assert.match(accountShell, /bindContactHeaderActions\(root, state, handlers, relationship, \{ workplaceKey: key \}\)/);
assert.match(accountShell, /handlers\.onStartBooking\?\.\(tenantId, request\)/);
assert.match(accountShell, /data-global-contact-chat/);
assert.match(accountShell, /openGlobalContactSettings/);

// Registration/auth and public link resolution remain server-backed.
assert.match(booking, /registerAccount\(state\.tenantId/);
assert.match(booking, /loginAccount\(state\.tenantId/);
assert.match(booking, /getAccountPlatformState\(state\.tenantId\)/);
assert.match(booking, /getAccountConsentState\(state\.tenantId\)/);
assert.match(accountApi, /export async function resolveBookingPublicRoute/);
assert.match(accountApi, /export async function createBookingRequest/);

console.log('Booking/account UI routing test passed');

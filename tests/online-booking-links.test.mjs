import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBookingLink } from '../core/booking-link/index.js';

assert.equal(
  buildBookingLink({ origin: 'https://example.com', pathname: '/Book/', tenantId: 'tenant-1' }),
  'https://example.com/Book/?booking=tenant-1',
);
assert.equal(
  buildBookingLink({ origin: 'https://example.com', pathname: '/Book/', tenantId: 'tenant-1', workplaceKey: 'piter' }),
  'https://example.com/Book/?booking=tenant-1&workplace=piter',
);
assert.equal(buildBookingLink({ origin: 'https://example.com', pathname: '/Book/' }), '');

const settingsSource = readFileSync(new URL('../settings/settings.js', import.meta.url), 'utf8');
const bookingSource = readFileSync(new URL('../settings/online-booking/online-booking.js', import.meta.url), 'utf8');
const buttonsSource = readFileSync(new URL('../ui/buttons/index.js', import.meta.url), 'utf8');

assert.match(settingsSource, /'online-booking', 'Онлайн-запись'/);
assert.match(bookingSource, /getWorkplaces/);
assert.match(bookingSource, /Общая ссылка/);
assert.match(bookingSource, /Ссылка рабочего пространства/);
assert.match(bookingSource, /copyIconButton/);
assert.match(bookingSource, /copyTextToClipboard/);
assert.doesNotMatch(bookingSource, /workplaces\.map\(.*copyLinkField/s);
assert.match(buttonsSource, /export function copyIconButton/);
assert.match(buttonsSource, /<svg viewBox="0 0 24 24"/);
assert.match(buttonsSource, /export async function copyTextToClipboard/);

console.log('online booking links tests: OK');

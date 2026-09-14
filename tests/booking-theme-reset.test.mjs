import assert from 'node:assert/strict';
import fs from 'node:fs';

const settingsUi = fs.readFileSync('settings/online-booking/online-booking.js', 'utf8');
const colorsUi = fs.readFileSync('ui/colors/index.js', 'utf8');
const settingsCore = fs.readFileSync('core/booking-settings/index.js', 'utf8');

assert.match(settingsCore, /export const DEFAULT_BOOKING_SETTINGS/);
assert.match(settingsCore, /backgroundStart: '#F5F5F3'/);
assert.match(settingsCore, /dark: '#3B302B'/);
assert.match(settingsCore, /light: '#E7E1DB'/);
assert.match(settingsCore, /shape: 'soft'/);
assert.match(settingsCore, /choiceStyle: 'cards'/);

assert.match(settingsUi, /DEFAULT_BOOKING_SETTINGS/);
assert.match(settingsUi, /Вернуть стандартное оформление/);
assert.match(settingsUi, /data-booking-settings-reset-theme/);
assert.match(settingsUi, /\.\.\.settingsDraft\(form\),\s*theme: \{ \.\.\.DEFAULT_BOOKING_SETTINGS\.theme \}/s);
assert.match(settingsUi, /onResetTheme: \(draft\) => renderReady\(root, navigateBack, tenantId, draft\)/);
assert.match(settingsUi, /onCancel: \(\) => renderReady\(root, navigateBack, tenantId\)/);
assert.match(settingsUi, /saveBookingSettings\(settingsDraft\(form\)\)/);

assert.match(colorsUi, /function exactHex/);
assert.match(colorsUi, /\^#\[0-9A-F\]\{6\}\$/);
assert.match(colorsUi, /const requested = exactHex\(value\)/);
assert.match(colorsUi, /const selected = requested \|\| \(required \? '' : palette\[0\]\)/);

console.log('booking theme reset regression test passed');

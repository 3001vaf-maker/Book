import assert from 'node:assert/strict';
import {
  BOOKING_SLOT_STEPS,
  DEFAULT_BOOKING_SETTINGS,
  normalizeBookingSettings,
} from '../core/booking-settings/index.js';

assert.deepEqual(BOOKING_SLOT_STEPS, [5, 10, 15, 30, 60]);
assert.equal(DEFAULT_BOOKING_SETTINGS.slotStep, 15);

const settings = normalizeBookingSettings({
  welcomeTitle: 'Привет',
  welcomeText: 'Буду рад встрече',
  slotStep: 60,
});

assert.equal(settings.welcomeTitle, 'Привет');
assert.equal(settings.slotStep, 60);
assert.equal('theme' in settings, false);

const invalid = normalizeBookingSettings({ slotStep: 7 });
assert.equal(invalid.slotStep, 15);

console.log('booking settings tests passed');

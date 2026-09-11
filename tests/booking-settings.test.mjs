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
  theme: {
    backgroundMode: 'gradient',
    backgroundStart: '#112233',
    backgroundEnd: '#445566',
    dark: '#001122',
    light: '#DDEEFF',
    shape: 'cut',
    choiceStyle: 'compact',
  },
});

assert.equal(settings.welcomeTitle, 'Привет');
assert.equal(settings.slotStep, 60);
assert.equal(settings.theme.backgroundMode, 'gradient');
assert.equal(settings.theme.shape, 'cut');
assert.equal(settings.theme.choiceStyle, 'compact');
assert.equal(settings.theme.dark, '#001122');

const invalid = normalizeBookingSettings({ slotStep: 7, theme: { shape: 'broken', dark: 'red' } });
assert.equal(invalid.slotStep, 15);
assert.equal(invalid.theme.shape, 'soft');
assert.equal(invalid.theme.dark, '#3B302B');

console.log('booking settings tests passed');

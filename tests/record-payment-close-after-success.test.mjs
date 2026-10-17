import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('journal/record-payment.js', 'utf8');

assert.doesNotMatch(source, /mountV2ZLayer|v2ZLayer|record-payment-z|record-payment-allocation-z|record-payment-correction-z/,
  'record payment flow must not create Z layers');
assert.match(source, /function mountPaymentQ[\s\S]*variant: 'q'/,
  'record payment actions must use the shared Q modal contract');
assert.match(source, /className: 'record-payment-q'/,
  'payment calculation and correction surface must be Q1');
assert.match(source, /className: 'record-payment-allocation-q'/,
  'payment allocation surface must be Q2');
assert.match(source, /modalTitle: 'Проведение оплаты'/,
  'Q2 must have a distinct application-modal key from Q1 so the shared Q owner does not reject it as a duplicate');
assert.doesNotMatch(source, /setRecordPrimaryAction|openSharedProfileSettingsMenu/,
  'payment Q must not hide actions in Header C or Header A settings');
assert.match(source, /data-record-payment-allocation-submit/,
  'Q2 payment confirmation must be visible in the Q body');
assert.match(source, /data-record-payment-correction-save/,
  'payment correction Save must be visible in the Q body');

for (const action of [
  'data-record-payment-correct',
  'data-record-payment-refund',
  'data-record-payment-cancel',
  'data-record-payment-delete',
]) assert.ok(source.includes(action), `payment operation action must stay visible in Q body: ${action}`);

const allocationStart = source.indexOf('async function openPaymentAllocationLayer');
const correctionStart = source.indexOf('async function openPaymentCorrection');
assert.ok(allocationStart >= 0 && correctionStart > allocationStart, 'payment allocation flow must exist');
const allocation = source.slice(allocationStart, correctionStart);

const completedGuard = allocation.indexOf('if (!completed) return;');
const closeQ2 = allocation.indexOf('layer.v2Close?.();', completedGuard);
const closeQContour = allocation.indexOf('onCompleted?.();', closeQ2);
const persist = allocation.indexOf('await flushBusinessPersistence();', closeQContour);

assert.ok(completedGuard >= 0, 'successful payment must be confirmed before closing');
assert.ok(closeQ2 > completedGuard, 'Q2 must close immediately after confirmed payment');
assert.ok(closeQContour > closeQ2, 'Q1 completion must run immediately after Q2 closes');
assert.ok(persist > closeQContour, 'persistence and refresh must not block Q closing');

assert.match(source, /openPaymentAllocationLayer\(layer, current, formState\.settlement, \(\) => \{\s*layer\.v2Close\?\.\(\);\s*\}\)/,
  'successful payment must close Q1 and return to the existing record Z');
assert.doesNotMatch(source, /openPaymentAllocationLayer\(layer, current, formState\.settlement, \(\) => \{\s*if \(layer\.isConnected\) renderPaymentLayer/,
  'successful payment must not rerender and keep Q1 open');

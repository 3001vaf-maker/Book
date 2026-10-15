import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('journal/record-payment.js', 'utf8');

const allocationStart = source.indexOf('async function openPaymentAllocationLayer');
const correctionStart = source.indexOf('async function openPaymentCorrection');
assert.ok(allocationStart >= 0 && correctionStart > allocationStart, 'payment allocation flow must exist');
const allocation = source.slice(allocationStart, correctionStart);

const completedGuard = allocation.indexOf('if (!completed) return;');
const closeChild = allocation.indexOf('layer.v2Close?.();', completedGuard);
const completeParent = allocation.indexOf('onCompleted?.();', closeChild);
const persist = allocation.indexOf('await flushBusinessPersistence();', completeParent);

assert.ok(completedGuard >= 0, 'successful payment must be confirmed before closing');
assert.ok(closeChild > completedGuard, 'allocation Z must close immediately after payment success');
assert.ok(completeParent > closeChild, 'parent completion must run immediately after child close');
assert.ok(persist > completeParent, 'record persistence must not block payment Z closing');

assert.match(source, /openPaymentAllocationLayer\(layer, current, formState\.settlement, \(\) => \{\s*layer\.v2Close\?\.\(\);\s*\}\)/,
  'successful payment must close the parent payment Z instead of rerendering it');
assert.doesNotMatch(source, /openPaymentAllocationLayer\(layer, current, formState\.settlement, \(\) => \{\s*if \(layer\.isConnected\) renderPaymentLayer/,
  'successful payment must not keep the payment Z open by rerendering it');

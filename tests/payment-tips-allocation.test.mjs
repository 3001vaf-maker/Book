import test from 'node:test';
import assert from 'node:assert/strict';

import { paymentAllocationState } from '../ui/payment/methods.js';

test('payment amount above amount due is accepted and excess becomes Tips', () => {
  const state = paymentAllocationState([
    { walletId: 'cash', walletName: 'Наличные', amount: 1200 },
  ], 1000);

  assert.equal(state.valid, true);
  assert.equal(state.received, 1200);
  assert.equal(state.applied, 1000);
  assert.equal(state.tips, 200);
  assert.equal(state.remaining, 0);
});

test('payment split across wallets preserves the same Tips rule', () => {
  const state = paymentAllocationState([
    { walletId: 'cash', walletName: 'Наличные', amount: 700 },
    { walletId: 'card', walletName: 'Безналичные', amount: 500 },
  ], 1000);

  assert.equal(state.valid, true);
  assert.equal(state.received, 1200);
  assert.equal(state.applied, 1000);
  assert.equal(state.tips, 200);
  assert.equal(state.remaining, 0);
});

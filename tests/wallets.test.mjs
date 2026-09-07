import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
};

const { deleteWallet, getWallets, saveWallet } = await import('../settings/wallets/data.js');

assert.deepEqual(getWallets().map((wallet) => wallet.name), ['Наличные', 'Безналичные']);
assert.equal(deleteWallet('cash'), false);
assert.equal(deleteWallet('cashless'), false);
assert.deepEqual(getWallets().map((wallet) => wallet.name), ['Наличные', 'Безналичные']);

saveWallet({ id: 'custom', name: 'Мой кошелёк', photo: '', system: false });
assert.equal(deleteWallet('custom'), true);
assert.deepEqual(getWallets().map((wallet) => wallet.name), ['Наличные', 'Безналичные']);

console.log('wallet tests: OK');

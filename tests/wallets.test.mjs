import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
};

const { deleteWallet, getWalletTotalBalance, getWallets, saveWallet } = await import('../settings/wallets/data.js');

assert.deepEqual(getWallets().map((wallet) => wallet.name), ['Наличные', 'Безналичные']);
assert.equal(deleteWallet('cash'), false);
assert.equal(deleteWallet('cashless'), false);
assert.deepEqual(getWallets().map((wallet) => wallet.name), ['Наличные', 'Безналичные']);

saveWallet({ id: 'custom', name: 'Мой кошелёк', photo: '', system: false });
assert.equal(deleteWallet('custom'), true);
assert.deepEqual(getWallets().map((wallet) => wallet.name), ['Наличные', 'Безналичные']);

localStorage.setItem('book.dds', JSON.stringify({
  version: 5,
  income: [
    { id: 'payment-1', status: 'completed', movementType: 'income', incomeType: 'payment', total: 150, allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 100 }, { walletId: 'cashless', walletName: 'Безналичные', amount: 50 }] },
    { id: 'payment-cancelled', status: 'cancelled', movementType: 'income', incomeType: 'payment', total: 1000, allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 1000 }] },
  ],
  expense: [
    { id: 'refund-1', status: 'refund', movementType: 'expense', expenseType: 'refund', walletId: 'cash', walletName: 'Наличные', total: 20 },
  ],
}));
assert.equal(getWalletTotalBalance(), 130);

const mainSource = readFileSync(new URL('../main/main.js', import.meta.url), 'utf8');
const financeSource = readFileSync(new URL('../main/finance/finance.js', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../settings/settings.js', import.meta.url), 'utf8');
const walletSource = readFileSync(new URL('../settings/wallets/wallets.js', import.meta.url), 'utf8');

assert.match(mainSource, /title: 'Финансы'/);
assert.match(mainSource, /\.\/finance\/finance\.js/);
assert.match(financeSource, /getDDSMovements/);
assert.match(financeSource, /getWalletTotalBalance/);
assert.match(financeSource, /title: 'Касса'/);
assert.match(financeSource, /renderWallets/);
assert.match(financeSource, /status === 'cancelled'/);
assert.doesNotMatch(settingsSource, /\['wallets', 'Кошелёк'/);
assert.match(walletSource, /pageHeader\('Касса'\)/);

console.log('wallet tests: OK');

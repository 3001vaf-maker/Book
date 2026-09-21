import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateSettlement, hydrateFinanceFromServer } from '../core/finance/index.js';
import { deleteWallet, getWalletTotalBalance, getWallets, hydrateWalletsFromServer, saveWallet } from '../settings/wallets/data.js';
import {
  canonicalFinanceState,
  paymentFixture,
  refundFixture,
  reversalFixture,
} from './helpers/finance-canonical.mjs';

hydrateWalletsFromServer([]);
assert.deepEqual(getWallets().map((wallet) => wallet.name), ['Наличные', 'Безналичные']);
assert.equal(deleteWallet('cash'), false);
assert.equal(deleteWallet('cashless'), false);
assert.deepEqual(getWallets().map((wallet) => wallet.name), ['Наличные', 'Безналичные']);

saveWallet({ id: 'custom', name: 'Мой кошелёк', photo: '', system: false });
assert.equal(deleteWallet('custom'), true);
assert.deepEqual(getWallets().map((wallet) => wallet.name), ['Наличные', 'Безналичные']);

const settlement = calculateSettlement([{ sourceId: 'wallet-test', name: 'Услуга', price: 150 }]);
const payment = paymentFixture({
  id: 'payment-1',
  recordId: 'wallet-record',
  settlement,
  allocations: [
    { walletId: 'cash', walletName: 'Наличные', amount: 100 },
    { walletId: 'cashless', walletName: 'Безналичные', amount: 50 },
  ],
  serviceAmount: 150,
});
const refund = refundFixture({
  id: 'refund-1',
  paymentId: 'payment-1',
  recordId: 'wallet-record',
  settlement,
  walletId: 'cash',
  walletName: 'Наличные',
  serviceAmount: 20,
});
const cancelledSettlement = calculateSettlement([{ sourceId: 'cancel-test', name: 'Услуга', price: 1000 }]);
const cancelled = paymentFixture({
  id: 'payment-cancelled',
  recordId: 'wallet-cancelled-record',
  settlement: cancelledSettlement,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 1000 }],
  serviceAmount: 1000,
  status: 'cancelled',
});
const reversal = reversalFixture({
  id: 'cancel-payment-cancelled',
  originalOperationId: 'payment-cancelled',
  recordId: 'wallet-cancelled-record',
  entries: cancelled.ledger,
});

hydrateFinanceFromServer(canonicalFinanceState({
  payments: [payment, cancelled],
  refunds: [refund],
  reversals: [reversal],
}));
assert.equal(getWalletTotalBalance(), 130);

const mainSource = readFileSync(new URL('../main/main.js', import.meta.url), 'utf8');
const financeSource = readFileSync(new URL('../main/finance/finance.js', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../settings/settings.js', import.meta.url), 'utf8');
const walletSource = readFileSync(new URL('../settings/wallets/wallets.js', import.meta.url), 'utf8');
const folderSource = readFileSync(new URL('../ui/cards/folder-card.js', import.meta.url), 'utf8');

assert.match(mainSource, /title: 'Финансы'/);
assert.match(mainSource, /\.\/finance\/finance\.js/);
assert.match(financeSource, /getLedgerEntries/);
assert.match(financeSource, /getWalletTotalBalance/);
assert.match(financeSource, /title: 'Касса'/);
assert.match(financeSource, /title: 'ДДС'/);
assert.match(financeSource, /variant: 'compact'/);
assert.match(financeSource, /renderWallets/);
assert.match(financeSource, /operationStatus === 'cancelled'/);
assert.match(financeSource, /list\(\{ items: movements\.map\(movementListItem\) \}\)/);
assert.doesNotMatch(financeSource, /listEntr(?:y|ies)/);
assert.match(financeSource, /button\('Excel'/);
assert.match(financeSource, /Book-ДДС\.csv/);
assert.match(folderSource, /variant === 'compact'/);
assert.doesNotMatch(settingsSource, /\['wallets', 'Кошелёк'/);
assert.match(walletSource, /pageHeader\('Касса'\)/);

console.log('wallet tests: OK');

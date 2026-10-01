import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateSettlement, deleteWallet, getWalletTotalBalance, getWallets, hydrateFinanceFromServer, hydrateWalletsFromServer, saveWallet } from '../core/finance/index.js';
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

const coreSource = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const financeSource = readFileSync(new URL('../core/finance/finance.js', import.meta.url), 'utf8');
const ddsSource = readFileSync(new URL('../core/finance/dds/index.js', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../settings/settings.js', import.meta.url), 'utf8');
const walletSource = readFileSync(new URL('../core/finance/cash/cash.js', import.meta.url), 'utf8');
const folderSource = readFileSync(new URL('../ui/cards/folder-card.js', import.meta.url), 'utf8');

assert.match(coreSource, /from '\.\/core\/finance\/index\.js'/);
assert.match(coreSource, /section === 'finance'.*renderFinanceSection/s);
assert.match(ddsSource, /getLedgerEntries/);
assert.match(financeSource, /label: 'Касса'/);
assert.match(financeSource, /label: 'ДДС'/);
assert.match(financeSource, /renderWallets/);
assert.match(ddsSource, /operationStatus === 'cancelled'/);
assert.match(ddsSource, /list\(\{ items: movements\.map\(movementListItem\) \}\)/);
assert.doesNotMatch(ddsSource, /listEntr(?:y|ies)/);
assert.match(ddsSource, /button\('Excel'/);
assert.match(ddsSource, /ДДС\.csv/);
assert.match(folderSource, /variant === 'compact'/);
assert.doesNotMatch(settingsSource, /\['wallets', 'Кошелёк'/);
assert.match(walletSource, /workspaceHeaderContext\(\{[\s\S]*title: 'Касса'/);
assert.match(walletSource, /data-add-wallet data-v2-primary-action data-v2-primary-label="\+"/);
assert.match(walletSource, /entityVisualCard/);
assert.match(walletSource, /mountEntityCardConstructor/);
assert.match(walletSource, /mountV2ZLayer/);
assert.match(walletSource, /v2ListEntry/);
assert.match(walletSource, /readOnlyReceipt/);
assert.doesNotMatch(walletSource, /paymentReceipt/);
assert.match(walletSource, /data-wallet-operation-settings/);
assert.match(walletSource, /cancelFinanceOperation/);
assert.doesNotMatch(walletSource, /entityCard--hero/);
assert.doesNotMatch(walletSource, /Внесено в систему/);
assert.doesNotMatch(walletSource, /Конечный пользователь/);
assert.doesNotMatch(walletSource, /За что/);
assert.match(ddsSource, /data-finance-operation/);
assert.match(ddsSource, /const interactive = Boolean\(item\?\.operationId\)/);

console.log('wallet tests: OK');

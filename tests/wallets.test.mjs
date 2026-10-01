import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateSettlement,
  deleteWallet,
  getInvestmentEntities,
  getLoanEntities,
  getWalletTotalBalance,
  getWallets,
  hydrateCashEntitiesFromServer,
  hydrateFinanceFromServer,
  hydrateWalletsFromServer,
  saveInvestmentEntity,
  saveLoanEntity,
  saveWallet,
} from '../core/finance/index.js';
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

hydrateCashEntitiesFromServer({ investments: [], loans: [] });
assert.deepEqual(getInvestmentEntities(), []);
assert.deepEqual(getLoanEntities(), []);
saveInvestmentEntity({ id: 'investment-1', name: 'Инвестиция 1' });
saveLoanEntity({ id: 'loan-1', name: 'Займ 1' });
assert.deepEqual(getInvestmentEntities().map((item) => item.name), ['Инвестиция 1']);
assert.deepEqual(getLoanEntities().map((item) => item.name), ['Займ 1']);

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
const listEntryCss = readFileSync(new URL('../ui/lists/list-entry.css', import.meta.url), 'utf8');
const receiptCss = readFileSync(new URL('../ui/receipt/receipt.css', import.meta.url), 'utf8');
const v2Css = readFileSync(new URL('../ui/v2/v2.css', import.meta.url), 'utf8');

assert.match(coreSource, /from '\.\/core\/finance\/index\.js'/);
assert.match(coreSource, /section === 'finance'.*renderFinanceSection/s);
assert.match(ddsSource, /getLedgerEntries/);
assert.match(financeSource, /label: 'Касса'/);
assert.match(financeSource, /label: 'ДДС'/);
assert.match(financeSource, /renderWallets/);
assert.match(ddsSource, /operationStatus === 'cancelled'/);
assert.match(ddsSource, /operationGroupsFromLedger/);
assert.match(ddsSource, /v2ListEntries\(groupedOperations\.map\(operationListEntry\)\)/);
assert.match(ddsSource, /v2ListEntry\(/);
assert.match(ddsSource, /readOnlyReceipt/);
assert.match(ddsSource, /openSharedProfileSettingsMenu/);
assert.match(ddsSource, /hardDeleteFinanceOperation/);
assert.match(ddsSource, /correctFinanceOperation/);
assert.match(ddsSource, /id:\s*'correct-operation'/);
assert.match(ddsSource, /id:\s*'cancel-operation',[\s\S]*variant:\s*'danger'/);
assert.match(ddsSource, /paymentReceiptGroups/);
assert.match(ddsSource, /groups:\s*paymentReceiptGroups\(entries\)/);
assert.doesNotMatch(ddsSource, /details\s*\(/);
assert.match(ddsSource, /title: 'Движения денежных средств'/);
assert.match(ddsSource, /id: 'excel', label: 'Эксель'/);
assert.match(ddsSource, /id: 'operations', label: 'Финансовые операции'/);
assert.match(ddsSource, /id: 'articles', label: 'Статьи'/);
assert.match(ddsSource, /title: 'Выгрузка ДДС'/);
assert.match(ddsSource, /data-finance-dds-export-submit/);
assert.match(ddsSource, /title: 'Доход \/ Расход'/);
assert.match(ddsSource, /title: 'Займы'/);
assert.match(ddsSource, /title: 'Инвестиции'/);
assert.match(ddsSource, /title: 'Переводы'/);
assert.match(ddsSource, /mountV2ZLayer/);
assert.match(ddsSource, /variant: 'quick'/);
assert.match(ddsSource, /ДДС\.csv/);
assert.match(folderSource, /variant === 'compact'/);
assert.doesNotMatch(settingsSource, /\['wallets', 'Кошелёк'/);
assert.match(walletSource, /workspaceHeaderContext\(\{[\s\S]*title: 'Касса'/);
assert.match(walletSource, /v2Section\('Кошельки'/);
assert.match(walletSource, /v2Section\('Инвестиции'/);
assert.match(walletSource, /v2Section\('Займ'/);
assert.match(walletSource, /v2HorizontalRail/);
assert.match(walletSource, /data-cash-create/);
assert.match(walletSource, /\+ Добавить кошелек/);
assert.match(walletSource, /\+ Добавить инвестицию/);
assert.match(walletSource, /\+ Добавить займ/);
assert.doesNotMatch(walletSource, /entityCardStack/);
assert.match(walletSource, /title:\s*label/);
assert.match(walletSource, /rightTop:\s*formatMoney\(operation\.total\)/);
assert.match(walletSource, /rightBottom:\s*operationMoment\(operation\)/);
assert.match(walletSource, /\[name \|\| counterparty, workplace\]\.filter\(Boolean\)\.join\(' · '\)/);
assert.match(walletSource, /entityVisualCard/);
assert.match(walletSource, /mountEntityCardConstructor/);
assert.match(walletSource, /mountV2ZLayer/);
assert.match(walletSource, /v2ListEntry/);
assert.match(walletSource, /readOnlyReceipt/);
assert.match(walletSource, /title:\s*operationName\(operation\)/);
assert.match(walletSource, /date:\s*when\.date/);
assert.match(walletSource, /time:\s*when\.time/);
assert.doesNotMatch(walletSource, /paymentReceipt/);
assert.doesNotMatch(listEntryCss, /linear-gradient/);
assert.doesNotMatch(receiptCss, /border-radius/);
assert.match(receiptCss, /\.read-only-sheet__group\+\.read-only-sheet__group\{border-top:1px solid var\(--border\)/);
assert.match(v2Css, /\.v2-header__title\{[^}]*white-space:normal[^}]*text-overflow:clip[^}]*word-break:normal/);
assert.doesNotMatch(v2Css, /\.v2-header__title\{[^}]*text-overflow:ellipsis/);
assert.match(walletSource, /data-wallet-operation-settings/);
assert.match(walletSource, /cancelFinanceOperation/);
assert.doesNotMatch(walletSource, /entityCard--hero/);
assert.doesNotMatch(walletSource, /Внесено в систему/);
assert.doesNotMatch(walletSource, /Конечный пользователь/);
assert.doesNotMatch(walletSource, /За что/);
assert.match(ddsSource, /data-finance-operation/);
assert.match(ddsSource, /data-finance-operation-cancel-confirm/);
assert.match(ddsSource, /className:\s*'modal--form-sheet'/);
assert.match(ddsSource, /button\('Отменить',\s*\{\s*variant:\s*'danger'/);
assert.match(ddsSource, /data-finance-operation-delete-confirm/);
assert.match(ddsSource, /actionOnly:\s*true/);
assert.match(ddsSource, /datePicker/);
assert.match(ddsSource, /initDatePickers/);
assert.doesNotMatch(ddsSource, /datetime-local|type:\s*'date'|type:\s*'time'/);

console.log('wallet tests: OK');

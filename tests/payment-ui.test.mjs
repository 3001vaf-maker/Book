import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paymentForm, paymentMethods } from '../ui/payment/index.js';
import { paymentAllocationState } from '../ui/payment/methods.js';
import { calculateSettlement } from '../core/finance/index.js';
import { shortDate } from '../ui/utils/date-time.js';
import { zonedDateTimeParts, zonedDateTimeToDate } from '../core/time/index.js';

const html = paymentForm({
  workplace: 'Рабочее пространство',
  date: '11.09.26',
  time: '12:00 - 13:00',
  person: { uei: '0278', name: 'Наталья Гусева' },
  procedures: [
    { id: 'p1', name: 'Стрижка - Женская', cost: 7000, pricePercent: 0 },
    { id: 'p2', name: 'Очень длинное название процедуры без сокращения', cost: 2500, pricePercent: 10 },
  ],
  total: 9250,
});

assert.match(html, /data-payment-sections/);
assert.match(html, /data-v2-z-body-sections/);
assert.match(html, /payment-summary-mini-card/);
assert.doesNotMatch(html, /payment-record-summary|payment-procedure__|payment-methods__/);
assert.match(html, /Рабочее пространство/);
assert.match(html, />11\.09\.26</);
assert.match(html, />12:00 - 13:00</);
assert.match(html, /0278 Наталья Гусева/);
assert.match(html, />К оплате</);
assert.match(html, />9 250 ₽</);
assert.equal((html.match(/data-payment-procedure="/g) || []).length, 2);
assert.match(html, /Очень длинное название процедуры без сокращения/);
assert.match(html, /payment-item-head/);
assert.match(html, /data-payment-price/);
assert.match(html, /data-payment-price-condition/);
assert.match(html, /data-payment-correction-percent/);
assert.match(html, /data-payment-correction-money/);
assert.match(html, /Ручная коррекция цены, %/);
assert.match(html, /Ручная коррекция цены, ₽/);
assert.match(html, /data-payment-remove/);
assert.match(html, /data-payment-save/);
assert.match(html, /data-payment-submit/);
assert.doesNotMatch(html, /payment-person-uei|payment-entry|payment-history-item/);
assert.doesNotMatch(html, /text-overflow:ellipsis/);

const embeddedHtml = paymentForm({
  workplace: 'Тест',
  date: '11.09.26',
  time: '12:00 - 13:00',
  person: { uei: 'U1', name: 'Тест' },
  procedures: [{ id: 'p1', name: 'Процедура', cost: 1000 }],
  total: 1000,
  showActions: false,
});
assert.doesNotMatch(embeddedHtml, /data-payment-save|data-payment-submit/);

const automaticPercent = calculateSettlement([
  { sourceId: 'p1', name: 'Стрижка', price: 5000 },
], { pricePercent: 20 });
assert.equal(automaticPercent.serviceTotal, 5000);
assert.equal(automaticPercent.correctionTotal, 0);
assert.equal(automaticPercent.pricePercentTotal, 1000);
assert.equal(automaticPercent.planTotal, 4000);
assert.equal(automaticPercent.items[0].pricePercent, 20);
assert.equal(automaticPercent.items[0].planAmount, 4000);

const correctedThenAutomatic = calculateSettlement([
  { sourceId: 'p1', name: 'Стрижка', price: 5000, correctionMode: 'percent', correctionPercent: 10 },
], { pricePercent: 20 });
assert.equal(correctedThenAutomatic.serviceTotal, 5000);
assert.equal(correctedThenAutomatic.correctionTotal, 500);
assert.equal(correctedThenAutomatic.items[0].correctedPrice, 4500);
assert.equal(correctedThenAutomatic.pricePercentTotal, 900);
assert.equal(correctedThenAutomatic.correctionTotal + correctedThenAutomatic.pricePercentTotal, 1400);
assert.equal(correctedThenAutomatic.planTotal, 3600);

const correctedWithoutProgram = calculateSettlement([
  { sourceId: 'p1', name: 'Стрижка', price: 5000, correctionMode: 'percent', correctionPercent: 10 },
]);
assert.equal(correctedWithoutProgram.correctionTotal, 500);
assert.equal(correctedWithoutProgram.pricePercentTotal, 0);
assert.equal(correctedWithoutProgram.planTotal, 4500);

const methodsHtml = paymentMethods({
  wallets: [{ id: 'cash', name: 'Наличные' }, { id: 'card', name: 'СберБанк' }],
  deposits: [{ depositId: 'dep-1', programName: 'Депозит 10%', balance: 3500 }],
  personalAccount: { personKey: 'person-1', balance: 2400, availableAmount: 1800, spendLimitPercent: 50 },
  total: 7000,
});
assert.match(methodsHtml, /К оплате/);
assert.match(methodsHtml, /7 000 ₽/);
assert.match(methodsHtml, /Депозит 10% · остаток 3 500 ₽/);
assert.match(methodsHtml, /Личный счёт · доступно 1 800 ₽/);
assert.match(methodsHtml, /data-payment-personal-account/);
assert.match(methodsHtml, /data-payment-allocation-row="0"/);
assert.match(methodsHtml, /data-payment-allocation-row="1"/);
assert.match(methodsHtml, /data-payment-allocation-amount="0"/);
assert.match(methodsHtml, /data-payment-allocation-amount="1"/);
assert.match(methodsHtml, /data-payment-tips-row hidden/);
assert.match(methodsHtml, />Сохранить</);
assert.doesNotMatch(methodsHtml, /data-payment-mode|Разделить/);
assert.doesNotMatch(methodsHtml, /type="number"[^>]*data-payment-allocation-amount/);

const depositOnly = paymentAllocationState([], 5000, [
  { depositId: 'dep-1', name: 'Депозит', balance: 3500, amount: 3000 },
]);
assert.equal(depositOnly.applied, 3000);
assert.equal(depositOnly.remaining, 2000);
assert.equal(depositOnly.tips, 0);
assert.equal(depositOnly.valid, true);

const mixed = paymentAllocationState([
  { walletId: 'cash', walletName: 'Наличные', amount: 1500 },
], 5000, [
  { depositId: 'dep-1', name: 'Депозит', balance: 3500, amount: 2500 },
], {
  amount: 1500,
  availableAmount: 1800,
});
assert.equal(mixed.applied, 5000);
assert.equal(mixed.remaining, 0);
assert.equal(mixed.tips, 500);
assert.equal(mixed.cashReceived, 1500);
assert.equal(mixed.depositReceived, 2500);
assert.equal(mixed.personalAccountAmount, 1500);
assert.equal(mixed.personalAccountReceived, 1500);
assert.equal(mixed.valid, true);

const personalAccountOverflow = paymentAllocationState([], 2000, [], {
  amount: 1900,
  availableAmount: 1800,
});
assert.equal(personalAccountOverflow.valid, false);

const depositOverflow = paymentAllocationState([], 2000, [
  { depositId: 'dep-1', name: 'Депозит', balance: 3500, amount: 2500 },
]);
assert.equal(depositOverflow.valid, false);
assert.equal(depositOverflow.tips, 0);

const embeddedMethods = paymentMethods({
  wallets: [{ id: 'cash', name: 'Наличные' }],
  total: 7000,
  showAction: false,
  showTotal: false,
});
assert.doesNotMatch(embeddedMethods, /data-payment-remaining/);
assert.doesNotMatch(embeddedMethods, /data-payment-allocation-submit/);

assert.equal(shortDate('2026-09-11'), '11.09.26');
const moscowMoment = zonedDateTimeToDate('2026-09-21T14:30', 'Europe/Moscow');
assert.ok(moscowMoment instanceof Date);
assert.equal(moscowMoment.toISOString(), '2026-09-21T11:30:00.000Z');
assert.deepEqual(
  { date: zonedDateTimeParts(moscowMoment, 'Europe/Moscow').date, time: zonedDateTimeParts(moscowMoment, 'Europe/Moscow').time },
  { date: '2026-09-21', time: '14:30' },
);

const paymentSource = readFileSync(new URL('../ui/payment/index.js', import.meta.url), 'utf8');
const methodsSource = readFileSync(new URL('../ui/payment/methods.js', import.meta.url), 'utf8');
const paymentCss = readFileSync(new URL('../ui/payment/payment.css', import.meta.url), 'utf8');
const recordViewSource = readFileSync(new URL('../journal/record-view.js', import.meta.url), 'utf8');
const recordPaymentSource = readFileSync(new URL('../journal/record-payment.js', import.meta.url), 'utf8');
const financeUiSource = readFileSync(new URL('../core/finance/dds/index.js', import.meta.url), 'utf8');
const financeServiceSource = readFileSync(new URL('../core/finance/service.js', import.meta.url), 'utf8');
const journalDaySource = readFileSync(new URL('../journal/день.js', import.meta.url), 'utf8');

assert.match(paymentSource, /const percentOptions = \[/);
assert.match(paymentSource, /Array\.from\(\{ length: 100 \}/);
assert.match(paymentSource, /setPercentDisplay/);
assert.match(paymentSource, /data-payment-correction-mode/);
assert.match(paymentSource, /data-payment-price-percent/);
assert.match(paymentSource, /preserve = null/);
assert.match(paymentSource, /const \{ percentInput, moneyInput \} = rowValues\(row\)/);
assert.match(paymentSource, /percentInput[^\n]*addEventListener\('change'/);
assert.match(paymentSource, /moneyInput[^\n]*addEventListener\('input'/);
assert.match(paymentSource, /onChange\?\.\(result\)/);
assert.match(paymentSource, /label: 'Условие'/);
assert.match(paymentSource, /label: 'Ручная коррекция цены, %'/);
assert.match(paymentSource, /label: 'Ручная коррекция цены, ₽'/);
assert.match(methodsSource, /const due = Math\.max\(0, numberValue\(total\)\)/);
assert.match(methodsSource, /const depositReceived = deposits\.reduce/);
assert.match(methodsSource, /const personalAccountAmount = Math\.max/);
assert.match(methodsSource, /const nonCashReceived = depositReceived \+ personalAccountAmount/);
assert.match(methodsSource, /const serviceFromCash = Math\.min/);
assert.match(methodsSource, /const applied = Math\.min\(due, nonCashReceived \+ serviceFromCash\)/);
assert.match(methodsSource, /const tips = Math\.max\(0, cashReceived - serviceFromCash\)/);
assert.match(methodsSource, /const remaining = Math\.max\(0, due - applied\)/);
assert.match(methodsSource, /return \{\s*state,\s*sync,\s*initial\s*\};/s);
assert.match(methodsSource, /Личный счёт · доступно/);
assert.match(methodsSource, /type === 'personal-account'/);

assert.match(paymentSource, /miniCard/);
assert.match(paymentSource, /v2ZBodySections/);
assert.match(paymentSource, /payment-summary-mini-card/);
assert.match(methodsSource, /readOnlyReceipt/);
assert.match(methodsSource, /field\(\{[\s\S]*label: 'Сумма'/);
assert.match(paymentCss, /\.payment-summary-mini-card \.mini-card__lines\{/);
assert.match(paymentCss, /grid-template-rows:auto auto 8px auto 8px auto/);
assert.match(paymentCss, /\.payment-item-section\{display:grid;gap:8px/);
assert.match(paymentCss, /\.payment-item-head\{/);
assert.match(paymentCss, /\.payment-edit-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.doesNotMatch(paymentSource, /payment-record-summary|payment-procedure__|payment-methods__/);
assert.doesNotMatch(methodsSource, /payment-allocation-block|payment-methods__/);

assert.match(recordViewSource, /openRecordPayment\(/);
assert.match(recordViewSource, /\{ host: m \}/);
assert.doesNotMatch(recordViewSource, /К оплате ·/);
assert.match(recordViewSource, /\? 'Оплачено'\s*:\s*formatMoney\(paymentState\.remaining\)/s);
assert.doesNotMatch(recordViewSource, /openRecordPaymentEntry|openPaidState|data-record-payment-open/);
assert.doesNotMatch(journalDaySource, /openRecordPaymentEntry/);

assert.match(recordPaymentSource, /export function openRecordPayment/);
assert.match(recordPaymentSource, /className: 'record-payment-z'/);
assert.match(recordPaymentSource, /title: 'Оплата'/);
assert.match(recordPaymentSource, /settingsTag:\s*true/);
assert.match(recordPaymentSource, /hideD:\s*false/);
assert.match(recordPaymentSource, /showActions: false/);
assert.match(recordPaymentSource, /label: 'Сохранить'/);
assert.match(recordPaymentSource, /label: 'Оплатить'/);
assert.match(recordPaymentSource, /const canPay = state\.remaining > 0\.009 \|\| state\.fullyPaid/);
assert.match(recordPaymentSource, /data-record-payment-chat/);
assert.match(recordPaymentSource, /personKeys:/);
assert.match(recordPaymentSource, /listPersonDeposits/);
assert.match(recordPaymentSource, /loadPersonalAccount/);
assert.match(recordPaymentSource, /personalAccountForRecord/);
assert.match(recordPaymentSource, /paymentMethods\(\{ wallets: getWallets\(\), deposits, personalAccount/);
assert.match(recordPaymentSource, /depositAllocations:\s*allocationState\.depositAllocations/);
assert.match(recordPaymentSource, /personalAccountAmount:\s*allocationState\.personalAccountAmount/);
assert.match(recordPaymentSource, /finalizeDebt:\s*allocationState\.remaining > 0\.009/);

for (const action of [
  "id: 'correct-payment'",
  "id: 'refund-payment'",
  "id: 'cancel-payment'",
  "id: 'delete-payment'",
]) assert.ok(recordPaymentSource.includes(action), `Missing payment A action: ${action}`);

assert.match(recordPaymentSource, /await\s+correctFinanceOperation/);
assert.match(recordPaymentSource, /await\s+recordRefundExpense/);
assert.match(recordPaymentSource, /await\s+cancelPaymentOperation/);
assert.match(recordPaymentSource, /await\s+hardDeleteFinanceOperation/);
assert.match(recordPaymentSource, /name: 'recordPaymentDate'/);
assert.match(recordPaymentSource, /name: 'recordPaymentCorrectionDate'/);
assert.match(recordPaymentSource, /name: 'recordPaymentRefundDate'/);
assert.match(recordPaymentSource, /name: 'recordPaymentCancelDate'/);
assert.match(recordPaymentSource, /showYear: false/);
assert.match(recordPaymentSource, /modalVariant: 'bottom'/);
assert.match(recordPaymentSource, /modalClassName: 'modal--form-sheet'/);
assert.match(recordPaymentSource, /readOnlyReceipt/);
assert.doesNotMatch(recordPaymentSource, /datetime-local|refundOccurredAt|cancelOccurredAt|paymentOccurredAt/);
assert.doesNotMatch(recordPaymentSource, /openRecordPaymentEntry|paymentEntryContent|openPaymentModal|openPaidState/);

assert.match(recordPaymentSource, /blankPaymentContext\(current\)/);
assert.match(recordPaymentSource, /blankPaymentContext\(record, 'Корректировка оплаты'\)/);
assert.match(recordPaymentSource, /serviceAmount:\s*allocationState\.applied/);
assert.match(recordPaymentSource, /tips:\s*allocationState\.tips/);
assert.match(recordPaymentSource, /setRecordPrimaryAction\(layer, \{\s*label: 'Оплатить'/s);
assert.match(recordPaymentSource, /occurredAtForDate/);
assert.match(recordPaymentSource, /zonedDateTimeToDate/);

assert.match(financeServiceSource, /export async function cancelFinanceOperation/);
assert.match(financeServiceSource, /export async function correctFinanceOperation/);
assert.match(financeServiceSource, /export async function hardDeleteFinanceOperation/);
assert.match(financeServiceSource, /export async function recordRefundExpense/);
assert.match(financeUiSource, /readOnlyReceipt\(/);
assert.match(financeUiSource, /hardDeleteFinanceOperation/);

console.log('payment UI tests: OK');
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paymentForm, paymentMethods } from '../ui/payment/index.js';
import { shortDate } from '../ui/utils/date-time.js';
import { zonedDateTimeParts, zonedDateTimeToDate } from '../core/time/index.js';

const html = paymentForm({
  workplace: 'Рабочее пространство',
  date: '11.09.26',
  time: '12:00 - 13:00',
  person: { uei: '0278', name: 'Наталья Гусева' },
  procedures: [
    { id: 'p1', name: 'Стрижка - Женская', cost: 7000, discountPercent: 0, discountMoney: 0 },
    { id: 'p2', name: 'Очень длинное название процедуры без сокращения', cost: 2500, discountPercent: 10, discountMoney: 250 },
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
assert.match(html, /data-payment-discount-percent/);
assert.match(html, /data-payment-discount-money/);
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

const methodsHtml = paymentMethods({
  wallets: [{ id: 'cash', name: 'Наличные' }, { id: 'card', name: 'СберБанк' }],
  total: 7000,
});
assert.match(methodsHtml, /К оплате/);
assert.match(methodsHtml, /7 000 ₽/);
assert.match(methodsHtml, /data-payment-allocation-row="0"/);
assert.match(methodsHtml, /data-payment-allocation-row="1"/);
assert.match(methodsHtml, /data-payment-allocation-amount="0"/);
assert.match(methodsHtml, /data-payment-allocation-amount="1"/);
assert.match(methodsHtml, /data-payment-tips-row hidden/);
assert.match(methodsHtml, />Сохранить</);
assert.doesNotMatch(methodsHtml, /data-payment-mode|Разделить/);
assert.doesNotMatch(methodsHtml, /type="number"[^>]*data-payment-allocation-amount/);

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

assert.match(paymentSource, /const discountOptions = \[/);
assert.match(paymentSource, /Array\.from\(\{ length: 100 \}/);
assert.match(paymentSource, /setPercentDisplay/);
assert.match(paymentSource, /data-payment-discount-mode/);
assert.match(paymentSource, /preserve = null/);
assert.match(paymentSource, /priceInput[^\n]*currentState\(priceInput\)/);
assert.match(paymentSource, /percentInput[^\n]*addEventListener\('change'/);
assert.match(paymentSource, /moneyInput[^\n]*addEventListener\('input'/);
assert.match(paymentSource, /onChange\?\.\(result\)/);
assert.match(methodsSource, /const due = Math\.max\(0, numberValue\(total\)\)/);
assert.match(methodsSource, /const applied = Math\.min\(due, received\)/);
assert.match(methodsSource, /const tips = Math\.max\(0, received - applied\)/);
assert.match(methodsSource, /const remaining = Math\.max\(0, due - applied\)/);
assert.match(methodsSource, /return \{\s*state,\s*sync,\s*initial,/s);

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

assert.match(recordPaymentSource, /blankPaymentContext\(\)/);
assert.match(recordPaymentSource, /paymentMethods\(\{ wallets: getWallets\(\), total, showAction: false, showTotal: false \}\)/);
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

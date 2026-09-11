import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { details } from '../ui/page/page.js';
import { paymentForm, paymentMethods } from '../ui/payment/index.js';
import { modal } from '../ui/modals/index.js';
import { shortDate } from '../ui/utils/date-time.js';

const html = paymentForm({
  workplace: 'Бьюти тория',
  date: '11.09.26',
  time: '02:09',
  client: { uei: '0278', name: 'Наталья Гусева' },
  procedures: [{ id: 'p1', name: 'Стрижка - Женская', cost: 7000, discountPercent: 0, discountMoney: 0 }],
  total: 7000,
});

assert.match(html, /class="payment-client-uei">0278</);
assert.match(html, /data-payment-save/);
assert.match(html, /ui-button--secondary/);
assert.match(html, /data-payment-submit/);
assert.match(html, /data-payment-total>7 000 ₽</);
assert.match(html, /data-payment-remove/);
assert.match(html, /remove-button payment-procedure__remove/);
assert.doesNotMatch(html, /data-payment-total[^>]*type="number"/);
assert.equal(shortDate('2026-09-11'), '11.09.26');
assert.equal(shortDate('2026-09-11T02:41:00'), '11.09.26');

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
assert.match(methodsHtml, /data-payment-tips>0 ₽/);
assert.match(methodsHtml, />Tips</);
assert.match(methodsHtml, />Сохранить</);
assert.doesNotMatch(methodsHtml, /data-payment-mode|Оплата<\/button>|Разделить/);
assert.doesNotMatch(methodsHtml, /type="number"[^>]*data-payment-allocation-amount/);
assert.doesNotMatch(methodsHtml, /data-payment-tips[^>]*input/);

const split = details([
  { left: '11.09.26', right: '02:41' },
  { left: '7 000 ₽', right: 'СберБанк' },
], { variant: 'split' });
assert.match(split, /entity-details--split/);
assert.match(split, /11\.09\.26/);
assert.match(split, /02:41/);
assert.match(split, /7 000 ₽/);
assert.match(split, /СберБанк/);

const modalHtml = modal('<div>Оплата</div>', { variant: 'large', surface: 'app' });
assert.match(modalHtml, /tabindex="-1"/);

const modalSource = readFileSync(new URL('../ui/modals/index.js', import.meta.url), 'utf8');
const modalCss = readFileSync(new URL('../ui/modals/modal.css', import.meta.url), 'utf8');
const inputCss = readFileSync(new URL('../ui/inputs/inputs.css', import.meta.url), 'utf8');
const paymentSource = readFileSync(new URL('../ui/payment/index.js', import.meta.url), 'utf8');
const methodsSource = readFileSync(new URL('../ui/payment/methods.js', import.meta.url), 'utf8');
const paymentCss = readFileSync(new URL('../ui/payment/payment.css', import.meta.url), 'utf8');
const recordViewSource = readFileSync(new URL('../journal/record-view.js', import.meta.url), 'utf8');
const recordPaymentSource = readFileSync(new URL('../journal/record-payment.js', import.meta.url), 'utf8');
const journalListSource = readFileSync(new URL('../journal/список.js', import.meta.url), 'utf8');
const clientMetadataSource = readFileSync(new URL('../main/clients/metadata.js', import.meta.url), 'utf8');
const walletSource = readFileSync(new URL('../settings/wallets/wallets.js', import.meta.url), 'utf8');
const documentsSource = readFileSync(new URL('../settings/documents/documents.js', import.meta.url), 'utf8');
const clientsSource = readFileSync(new URL('../main/clients/clients.js', import.meta.url), 'utf8');

assert.doesNotMatch(modalSource, /querySelector\(['"]input,select,textarea/);
assert.match(modalSource, /data-modal-autofocus/);
assert.match(paymentSource, /preserve:\s*moneyInput/);
assert.match(paymentSource, /preserve:\s*priceInput/);
assert.match(paymentSource, /preserve:\s*percentInput/);
assert.match(paymentSource, /iconButton\('×'/);
assert.match(paymentSource, /onRemove/);
assert.doesNotMatch(paymentSource, /singlePaymentMarkup|splitPaymentMarkup|data-payment-mode/);
assert.doesNotMatch(paymentCss, /payment-procedure__remove[^}]*font-size/);
assert.match(methodsSource, /data-payment-allocation-row="\$\{index\}"/);
assert.match(methodsSource, /data-payment-remaining/);
assert.match(methodsSource, /data-payment-tips-row/);
assert.match(methodsSource, /const applied = Math\.min\(Math\.max\(0, total\), received\)/);
assert.match(methodsSource, /const tips = Math\.max\(0, received - applied\)/);
assert.match(methodsSource, /remaining = Math\.max\(0, total - applied\)/);
assert.doesNotMatch(methodsSource, /tipsInput|data-payment-tips[^\n]*input/);
assert.match(paymentCss, /payment-client-uei[^}]*font-size:16px/);
assert.match(paymentCss, /ui-select__value[^}]*font-size:16px/);
assert.match(inputCss, /input\[type="number"\]::-webkit-outer-spin-button/);
assert.match(inputCss, /-moz-appearance:textfield/);
assert.match(modalCss, /modal-bottom-action--partial[^}]*rgba\(154,98,88,\.14\)/);
assert.match(recordViewSource, /discountTotal\s*>\s*0\s*\?[^:]+:\s*formatMoney\(0\)/s);
assert.match(recordViewSource, /getRecordPaymentState/);
assert.match(recordViewSource, /book:records-changed/);
assert.match(recordViewSource, /openProductRemoval/);
assert.match(recordViewSource, /data-record-view-product-edit/);
assert.match(recordPaymentSource, /modal\(content,\s*\{\s*variant:\s*'large'/);
assert.match(recordPaymentSource, /variant:\s*'split'/);
assert.match(recordPaymentSource, /getRecordPaymentState/);
assert.match(recordPaymentSource, /modal-bottom-action--partial/);
assert.match(recordPaymentSource, /left:\s*'Tips'/);
assert.match(recordPaymentSource, /receivedTotal/);
assert.match(recordPaymentSource, /Возврат оплаты',\s*\{\s*variant:\s*'danger'/);
assert.match(recordPaymentSource, /Подтвердить возврат',[\s\S]*variant:\s*'danger'/);
assert.match(recordPaymentSource, /flatMap/);
assert.doesNotMatch(recordPaymentSource, /toLocaleDateString/);
assert.match(journalListSource, /shortDate\(record\?\.date\)/);
assert.match(clientMetadataSource, /shortDate\(value,\s*'—'\)/);
assert.match(walletSource, /shortDateTime\(raw,\s*fallback\)/);
assert.match(documentsSource, /shortDateTime\(value,\s*'Дата не зафиксирована'\)/);
assert.match(clientsSource, /shortDateTime\(value,'—'\)/);
assert.equal(existsSync(new URL('../ui/payment/single.js', import.meta.url)), false);
assert.equal(existsSync(new URL('../ui/payment/split.js', import.meta.url)), false);

console.log('payment ui tests: OK');

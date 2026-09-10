import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paymentForm } from '../ui/payment/index.js';
import { modal } from '../ui/modals/index.js';

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

const modalHtml = modal('<div>Оплата</div>', { variant: 'large', surface: 'app' });
assert.match(modalHtml, /tabindex="-1"/);

const modalSource = readFileSync(new URL('../ui/modals/index.js', import.meta.url), 'utf8');
const paymentSource = readFileSync(new URL('../ui/payment/index.js', import.meta.url), 'utf8');
const paymentCss = readFileSync(new URL('../ui/payment/payment.css', import.meta.url), 'utf8');
const recordViewSource = readFileSync(new URL('../journal/record-view.js', import.meta.url), 'utf8');
const recordPaymentSource = readFileSync(new URL('../journal/record-payment.js', import.meta.url), 'utf8');

assert.doesNotMatch(modalSource, /querySelector\(['"]input,select,textarea/);
assert.match(modalSource, /data-modal-autofocus/);
assert.match(paymentSource, /preserve:\s*moneyInput/);
assert.match(paymentSource, /preserve:\s*priceInput/);
assert.match(paymentSource, /preserve:\s*percentInput/);
assert.match(paymentCss, /payment-client-uei[^}]*font-size:16px/);
assert.match(paymentCss, /ui-select__value[^}]*font-size:16px/);
assert.match(recordViewSource, /discountTotal\s*>\s*0\s*\?[^:]+:\s*formatMoney\(0\)/s);
assert.match(recordViewSource, /book:records-changed/);
assert.match(recordPaymentSource, /modal\(content,\s*\{\s*variant:\s*'large'/);

console.log('payment ui tests: OK');

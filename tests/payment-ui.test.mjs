import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { details } from '../ui/page/page.js';
import { paymentForm } from '../ui/payment/index.js';
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
assert.equal(shortDate('2026-09-11'), '11.09.26');
assert.equal(shortDate('2026-09-11T02:41:00'), '11.09.26');

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
const paymentSource = readFileSync(new URL('../ui/payment/index.js', import.meta.url), 'utf8');
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
assert.match(paymentCss, /payment-client-uei[^}]*font-size:16px/);
assert.match(paymentCss, /ui-select__value[^}]*font-size:16px/);
assert.match(recordViewSource, /discountTotal\s*>\s*0\s*\?[^:]+:\s*formatMoney\(0\)/s);
assert.match(recordViewSource, /book:records-changed/);
assert.match(recordPaymentSource, /modal\(content,\s*\{\s*variant:\s*'large'/);
assert.match(recordPaymentSource, /variant:\s*'split'/);
assert.match(recordPaymentSource, /Возврат оплаты',\s*\{\s*variant:\s*'danger'/);
assert.match(recordPaymentSource, /Подтвердить возврат',[\s\S]*variant:\s*'danger'/);
assert.doesNotMatch(recordPaymentSource, /toLocaleDateString/);
assert.match(journalListSource, /shortDate\(record\?\.date\)/);
assert.match(clientMetadataSource, /shortDate\(value,\s*'—'\)/);
assert.match(walletSource, /shortDateTime\(raw,\s*fallback\)/);
assert.match(documentsSource, /shortDateTime\(value,\s*'Дата не зафиксирована'\)/);
assert.match(clientsSource, /shortDateTime\(value,'—'\)/);

console.log('payment ui tests: OK');

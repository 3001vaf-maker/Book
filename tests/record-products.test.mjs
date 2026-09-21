import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hydrateDaysFromServer } from '../core/day/index.js';
import { calculateSettlement, getSettlementItemTotals, hydrateFinanceFromServer } from '../core/finance/index.js';
import { createRecord, getRecords, hydrateRecordStateFromServer, updateRecord } from '../core/record/index.js';
import { canonicalFinanceState, paymentFixture, settlementRow } from './helpers/finance-canonical.mjs';

hydrateDaysFromServer([
  { date: '2026-09-11', workplaceId: 'studio', from: '09:00', to: '18:00' },
]);
hydrateRecordStateFromServer({ records: [], recordEvents: [] });
hydrateFinanceFromServer({ version: 6, settlements: [], operations: [], ledger: [], income: [], expense: [] });

const record = createRecord({
  date: '2026-09-11',
  workplaceId: 'studio',
  from: '10:00',
  to: '11:00',
  person: { key: 'person-products', name: 'Анна', surname: 'Товар' },
  procedures: [{ id: 'procedure-products', name: 'Стрижка', cost: 5000, duration: 60 }],
});
assert.ok(record);
assert.deepEqual(record.products, []);
assert.equal(record.finance.serviceTotal, 5000);

const withProduct = updateRecord(record.id, {
  products: [{ id: 'product-1', name: 'Шампунь', cost: 2000 }],
});
assert.ok(withProduct);
assert.equal(withProduct.products.length, 1);
assert.equal(withProduct.finance.serviceTotal, 7000);
assert.equal(withProduct.finance.planTotal, 7000);
assert.equal(withProduct.finance.items.find((item) => item.sourceId === 'product-1')?.sourceType, 'product');
assert.equal(withProduct.finance.items.find((item) => item.sourceId === 'procedure-products')?.sourceType, 'procedure');

const discountedProductSettlement = calculateSettlement(withProduct.finance.items.map((item) => item.sourceType === 'product'
  ? { ...item, discountMode: 'percent', discountPercent: 10 }
  : { ...item, discountMode: 'none', discountPercent: 0, discountMoney: 0 }));

const rejectedByRecord = updateRecord(record.id, { finance: discountedProductSettlement });
assert.equal(rejectedByRecord.finance.planTotal, 7000);

const payment = paymentFixture({
  id: 'payment-products',
  recordId: record.id,
  settlement: discountedProductSettlement,
  allocations: [{ walletId: 'cash', walletName: 'Наличные', amount: 6800 }],
  serviceAmount: 6800,
});
hydrateFinanceFromServer(canonicalFinanceState({
  settlements: [settlementRow(record.id, discountedProductSettlement)],
  payments: [payment],
}));

assert.equal(getSettlementItemTotals('procedure', 'procedure-products').factTotal, 5000);
assert.equal(getSettlementItemTotals('product', 'product-1').factTotal, 1800);
assert.equal(getRecords().find((item) => item.id === record.id)?.finance?.planTotal, 6800);

const recordViewSource = readFileSync(new URL('../journal/record-view.js', import.meta.url), 'utf8');
const recordPaymentSource = readFileSync(new URL('../journal/record-payment.js', import.meta.url), 'utf8');
const modalCss = readFileSync(new URL('../ui/modals/modal.css', import.meta.url), 'utf8');
assert.match(recordViewSource, /button\('Продажа'/);
assert.match(recordViewSource, /data-record-sale-product/);
assert.match(recordViewSource, /initMultiSelect/);
assert.match(recordViewSource, /recordSettlementItems\(state\)/);
assert.match(recordPaymentSource, /products:\s*sourcesFromSettlement/);
assert.match(recordPaymentSource, /saveSettlementSnapshot/);
assert.match(modalCss, /modal--bottom\{[^}]*height:88px[^}]*max-height:88px/);

console.log('record product sale tests: OK');

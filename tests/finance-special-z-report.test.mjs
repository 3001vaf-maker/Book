import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getWalletDDSMovements,
  getZReport,
  hydrateFinanceFromServer,
} from '../core/finance/index.js';

const day = '2026-09-21';
const at = (time) => `${day}T${time}:00.000Z`;

const operations = [
  { operationId: 'loan-in', kind: 'loan-received', status: 'completed', source: { type: 'finance', id: 'loan-in' }, occurredAt: at('09:00'), data: {} },
  { operationId: 'loan-out', kind: 'loan-repayment', status: 'completed', source: { type: 'finance', id: 'loan-out' }, occurredAt: at('10:00'), data: {} },
  { operationId: 'invest-in', kind: 'investment-received', status: 'completed', source: { type: 'finance', id: 'invest-in' }, occurredAt: at('11:00'), data: {} },
  { operationId: 'invest-out', kind: 'investment-return', status: 'completed', source: { type: 'finance', id: 'invest-out' }, occurredAt: at('12:00'), data: {} },
  { operationId: 'transfer-1', kind: 'transfer', status: 'completed', source: { type: 'finance', id: 'transfer-1' }, occurredAt: at('13:00'), data: {} },
  { operationId: 'service-1', kind: 'payment', status: 'completed', source: { type: 'record', id: 'r1' }, occurredAt: at('14:00'), recordedAt: '2026-09-28T09:00:00.000Z', data: {} },
  { operationId: 'expense-1', kind: 'manual-expense', status: 'completed', source: { type: 'manual', id: 'expense-1' }, occurredAt: at('15:00'), data: {} },
  { operationId: 'tax-1', kind: 'manual-expense', status: 'completed', source: { type: 'manual', id: 'tax-1' }, occurredAt: at('16:00'), data: {} },
  { operationId: 'cancelled-1', kind: 'payment', status: 'cancelled', source: { type: 'record', id: 'r-cancelled' }, occurredAt: at('17:00'), data: {} },
  { operationId: 'cancel-cancelled-1', kind: 'cancel', status: 'completed', source: { type: 'record', id: 'r-cancelled' }, originalOperationId: 'cancelled-1', occurredAt: at('17:01'), data: {} },
];

const ledger = [
  { entryId: 'loan-in-1', operationId: 'loan-in', walletId: 'cash', walletName: 'Наличные', direction: 'IN', economicType: 'LOAN_RECEIVED', amount: 100000, occurredAt: at('09:00'), source: { type: 'finance', id: 'loan-in' }, articleId: 'system-loan-received', articleName: 'Займ' },
  { entryId: 'loan-out-1', operationId: 'loan-out', walletId: 'cash', walletName: 'Наличные', direction: 'OUT', economicType: 'LOAN_REPAYMENT', amount: 20000, occurredAt: at('10:00'), source: { type: 'finance', id: 'loan-out' }, articleId: 'system-loan-repayment', articleName: 'Возврат займа' },
  { entryId: 'invest-in-1', operationId: 'invest-in', walletId: 'card', walletName: 'Карта', direction: 'IN', economicType: 'INVESTMENT_RECEIVED', amount: 50000, occurredAt: at('11:00'), source: { type: 'finance', id: 'invest-in' }, articleId: 'system-investment-received', articleName: 'Инвестиции' },
  { entryId: 'invest-out-1', operationId: 'invest-out', walletId: 'card', walletName: 'Карта', direction: 'OUT', economicType: 'INVESTMENT_RETURN', amount: 10000, occurredAt: at('12:00'), source: { type: 'finance', id: 'invest-out' }, articleId: 'system-investment-return', articleName: 'Возврат инвестиций' },
  { entryId: 'transfer-out', operationId: 'transfer-1', walletId: 'cash', walletName: 'Наличные', direction: 'OUT', economicType: 'TRANSFER', amount: 30000, occurredAt: at('13:00'), source: { type: 'finance', id: 'transfer-1' }, articleId: 'system-transfer', articleName: 'Перевод между кошельками' },
  { entryId: 'transfer-in', operationId: 'transfer-1', walletId: 'card', walletName: 'Карта', direction: 'IN', economicType: 'TRANSFER', amount: 30000, occurredAt: at('13:00'), source: { type: 'finance', id: 'transfer-1' }, articleId: 'system-transfer', articleName: 'Перевод между кошельками' },
  { entryId: 'service-in', operationId: 'service-1', walletId: 'cash', walletName: 'Наличные', direction: 'IN', economicType: 'SERVICE_REVENUE', amount: 8000, occurredAt: at('14:00'), recordedAt: '2026-09-28T09:00:00.000Z', source: { type: 'record', id: 'r1' }, articleId: 'system-service-revenue', articleName: 'Услуги' },
  { entryId: 'expense-out', operationId: 'expense-1', walletId: 'cash', walletName: 'Наличные', direction: 'OUT', economicType: 'OPERATING_EXPENSE', amount: 2000, occurredAt: at('15:00'), source: { type: 'manual', id: 'expense-1' }, articleId: 'materials', articleName: 'Материалы' },
  { entryId: 'tax-out', operationId: 'tax-1', walletId: 'card', walletName: 'Карта', direction: 'OUT', economicType: 'TAX', amount: 1000, occurredAt: at('16:00'), source: { type: 'manual', id: 'tax-1' }, articleId: 'system-tax', articleName: 'Налог' },
  { entryId: 'cancelled-in', operationId: 'cancelled-1', walletId: 'cash', walletName: 'Наличные', direction: 'IN', economicType: 'SERVICE_REVENUE', amount: 5000, occurredAt: at('17:00'), source: { type: 'record', id: 'r-cancelled' } },
  { entryId: 'cancelled-reversal', operationId: 'cancel-cancelled-1', walletId: 'cash', walletName: 'Наличные', direction: 'OUT', economicType: 'REVERSAL', amount: 5000, occurredAt: at('17:01'), source: { type: 'record', id: 'r-cancelled' }, relatedOperationId: 'cancelled-1' },
];

hydrateFinanceFromServer({
  version: 7,
  articles: [],
  settlements: [],
  operations,
  ledger,
  income: [],
  expense: [],
});

const report = getZReport({
  from: `${day}T00:00:00.000Z`,
  to: `${day}T23:59:59.999Z`,
});

assert.equal(report.entries.length, 9);
assert.equal(report.totals.incoming, 188000);
assert.equal(report.totals.outgoing, 63000);
assert.equal(report.totals.netCash, 125000);
assert.equal(report.totals.serviceRevenue, 8000);
assert.equal(report.totals.operatingExpense, 2000);
assert.equal(report.totals.tax, 1000);
assert.equal(report.totals.loanReceived, 100000);
assert.equal(report.totals.loanRepaid, 20000);
assert.equal(report.totals.investmentReceived, 50000);
assert.equal(report.totals.investmentReturned, 10000);
assert.equal(report.totals.transferIn, 30000);
assert.equal(report.totals.transferOut, 30000);

const lateClosedService = report.entries.find((row) => row.operationId === 'service-1');
assert.equal(lateClosedService?.occurredAt, at('14:00'));
assert.equal(lateClosedService?.recordedAt, '2026-09-28T09:00:00.000Z');

const laterReport = getZReport({
  from: '2026-09-28T00:00:00.000Z',
  to: '2026-09-28T23:59:59.999Z',
});
assert.equal(laterReport.entries.some((row) => row.operationId === 'service-1'), false);

const cash = report.byWallet.find((row) => row.id === 'cash');
const card = report.byWallet.find((row) => row.id === 'card');
assert.equal(cash.net, 56000);
assert.equal(card.net, 69000);
assert.equal(cash.net + card.net, report.totals.netCash);

// Transfer moves cash between wallets but nets to zero across the business.
const transferNet = ledger
  .filter((row) => row.economicType === 'TRANSFER')
  .reduce((sum, row) => sum + (row.direction === 'IN' ? row.amount : -row.amount), 0);
assert.equal(transferNet, 0);

// Raw wallet history still contains the immutable cancelled + reversal audit pair.
assert.equal(getWalletDDSMovements('cash').filter((row) => row.operationId === 'cancelled-1' || row.operationId === 'cancel-cancelled-1').length, 2);
// Z-report excludes both cancelled original and technical reversal.
assert.equal(report.entries.some((row) => row.operationId === 'cancelled-1'), false);
assert.equal(report.entries.some((row) => row.operationId === 'cancel-cancelled-1'), false);

const server = readFileSync(new URL('../server/src/finance/finance.service.ts', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../server/src/finance/finance.controller.ts', import.meta.url), 'utf8');
const specialUi = readFileSync(new URL('../main/finance/special-operations.js', import.meta.url), 'utf8');
const zUi = readFileSync(new URL('../main/finance/z-report.js', import.meta.url), 'utf8');

assert.match(server, /recordSpecialOperation/);
assert.match(server, /loan-received/);
assert.match(server, /loan-repayment/);
assert.match(server, /investment-received/);
assert.match(server, /investment-return/);
assert.match(server, /kind === 'transfer'/);
assert.match(server, /direction: 'OUT'[\s\S]*economicType: 'TRANSFER'[\s\S]*direction: 'IN'[\s\S]*economicType: 'TRANSFER'/);
assert.match(controller, /operations\/special/);
assert.match(specialUi, /Получить займ/);
assert.match(specialUi, /Вернуть займ/);
assert.match(specialUi, /Получить инвестицию/);
assert.match(specialUi, /Вернуть инвестицию/);
assert.match(specialUi, /Перевод между кошельками/);
assert.match(zUi, /getZReport/);
assert.match(zUi, /type: 'date'/);

console.log('finance special operations and Z-report tests: OK');

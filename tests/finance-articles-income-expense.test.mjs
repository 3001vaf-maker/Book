import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getFinanceArticles, getLedgerEntries, hydrateFinanceFromServer } from '../core/finance/index.js';
import { getWalletBalance, hydrateWalletsFromServer } from '../settings/wallets/data.js';

hydrateWalletsFromServer([
  { id: 'cash', name: 'Наличные', photo: '', system: true },
]);

hydrateFinanceFromServer({
  version: 7,
  articles: [
    {
      articleId: 'materials',
      parentArticleId: 'system-expense',
      name: 'Краска',
      direction: 'OUT',
      economicType: 'OPERATING_EXPENSE',
      systemKey: '',
      position: 10,
    },
    {
      articleId: 'other-income',
      parentArticleId: 'system-income',
      name: 'Прочий доход',
      direction: 'IN',
      economicType: 'OPERATING_REVENUE',
      systemKey: '',
      position: 20,
    },
  ],
  settlements: [],
  operations: [
    {
      operationId: 'manual-expense-1',
      kind: 'manual-expense',
      status: 'completed',
      source: { type: 'manual', id: 'manual-expense-1' },
      originalOperationId: '',
      occurredAt: '2026-09-21T10:00:00.000Z',
      data: { walletId: 'cash', walletName: 'Наличные', total: 20000 },
    },
    {
      operationId: 'manual-income-1',
      kind: 'manual-income',
      status: 'completed',
      source: { type: 'manual', id: 'manual-income-1' },
      originalOperationId: '',
      occurredAt: '2026-09-21T11:00:00.000Z',
      data: { walletId: 'cash', walletName: 'Наличные', total: 5000 },
    },
  ],
  ledger: [
    {
      entryId: 'expense-line-1',
      operationId: 'manual-expense-1',
      walletId: 'cash',
      walletName: 'Наличные',
      direction: 'OUT',
      economicType: 'OPERATING_EXPENSE',
      amount: 20000,
      occurredAt: '2026-09-21T10:00:00.000Z',
      source: { type: 'manual', id: 'manual-expense-1' },
      component: 'manual',
      articleId: 'materials',
      articleName: 'Краска',
      lineName: 'Тюбик краски',
      quantity: 20,
      unitPrice: 1000,
      note: 'Закупка',
    },
    {
      entryId: 'income-line-1',
      operationId: 'manual-income-1',
      walletId: 'cash',
      walletName: 'Наличные',
      direction: 'IN',
      economicType: 'OPERATING_REVENUE',
      amount: 5000,
      occurredAt: '2026-09-21T11:00:00.000Z',
      source: { type: 'manual', id: 'manual-income-1' },
      component: 'manual',
      articleId: 'other-income',
      articleName: 'Прочий доход',
      lineName: '',
      quantity: 1,
      unitPrice: 5000,
      note: '',
    },
  ],
  income: [],
  expense: [],
});

assert.equal(getFinanceArticles().length, 2);
assert.equal(getFinanceArticles().find((item) => item.articleId === 'materials')?.economicType, 'OPERATING_EXPENSE');

const ledger = getLedgerEntries();
assert.equal(ledger.length, 2);
assert.equal(ledger[0].articleName, 'Краска');
assert.equal(ledger[0].quantity, 20);
assert.equal(ledger[0].unitPrice, 1000);
assert.equal(ledger[0].total, -20000);
assert.equal(ledger[1].total, 5000);
assert.equal(getWalletBalance('cash'), -15000);

const schema = readFileSync(new URL('../server/prisma/schema.prisma', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server/src/finance/finance.service.ts', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../server/src/finance/finance.controller.ts', import.meta.url), 'utf8');
const financeUi = readFileSync(new URL('../main/finance/finance.js', import.meta.url), 'utf8');
const articlesUi = readFileSync(new URL('../main/finance/articles.js', import.meta.url), 'utf8');
const incomeExpenseUi = readFileSync(new URL('../main/finance/income-expense.js', import.meta.url), 'utf8');

assert.match(schema, /model FinanceArticle/);
assert.match(controller, /operations\/manual/);
assert.match(controller, /articles\/:articleId/);
assert.match(server, /DEFAULT_FINANCE_ARTICLES/);
assert.match(server, /recordManualOperation/);
assert.match(server, /quantity/);
assert.match(server, /unitPrice/);
assert.match(server, /articleId/);
assert.match(financeUi, /Доход \/ Расход/);
assert.match(financeUi, /Статьи/);
assert.match(articlesUi, /parentArticleId/);
assert.match(articlesUi, /economicType/);
assert.match(incomeExpenseUi, /lineQuantity/);
assert.match(incomeExpenseUi, /linePrice/);
assert.match(incomeExpenseUi, /recordManualFinanceOperation/);

console.log('finance articles income expense tests: OK');

import { canUseBookCapability } from '../access.js';
import { renderWallets } from './cash/cash.js';
import { renderDDS } from './dds/index.js';
import { renderIncomeExpense } from './dds/income-expense.js';
import { renderSpecialFinanceOperations } from './dds/special-operations.js';
import { renderFinanceArticles } from './articles.js';
import { renderZReport } from './z-report/index.js';

const FINANCE_NAVIGATION = [
  { id: 'cash', label: 'Касса', capability: 'finance.cash.access' },
  { id: 'dds', label: 'ДДС', capability: 'finance.dds.access' },
  { id: 'income-expense', label: 'Доход / Расход', capability: 'finance.income_expense.access' },
  { id: 'articles', label: 'Статьи', capability: 'finance.articles.access' },
  { id: 'special', label: 'Прочие операции', capability: 'finance.special.access' },
  { id: 'z-report', label: 'Z-отчёт', capability: 'finance.z_report.access' },
];

export function financeNavigationItems() {
  return FINANCE_NAVIGATION
    .filter((item) => canUseBookCapability(item.capability))
    .map(({ id, label }) => ({ id, label }));
}

export function renderFinanceSection(root, section = 'cash') {
  if (section === 'dds') return renderDDS(root);
  if (section === 'income-expense') return renderIncomeExpense(root);
  if (section === 'articles') return renderFinanceArticles(root);
  if (section === 'special') return renderSpecialFinanceOperations(root);
  if (section === 'z-report') return renderZReport(root);
  return renderWallets(root);
}

export { renderFinanceSection as render };

import { canUseBookCapability } from '../access.js';
import { renderWallets } from './cash/cash.js';
import { renderDDS } from './dds/index.js';
import { renderZReport } from './z-report/index.js';

const FINANCE_NAVIGATION = [
  { id: 'cash', label: 'Касса', capability: 'finance.cash.access' },
  { id: 'dds', label: 'ДДС', capability: 'finance.dds.access' },
  { id: 'z-report', label: 'Z-отчёт', capability: 'finance.z_report.access' },
];

function investmentAccessAllowed() {
  return canUseBookCapability('finance.investment.self.access')
    || canUseBookCapability('finance.investment.raise.access')
    || canUseBookCapability('finance.investment.external.access');
}

export function financeNavigationItems() {
  return FINANCE_NAVIGATION
    .filter((item) => item.id === 'cash'
      ? (canUseBookCapability(item.capability) || investmentAccessAllowed())
      : canUseBookCapability(item.capability))
    .map(({ id, label }) => ({ id, label }));
}

export function renderFinanceSection(root, section = 'cash', options = {}) {
  if (section === 'dds') return renderDDS(root);
  if (section === 'z-report') return renderZReport(root);
  return renderWallets(root, options);
}

export { renderFinanceSection as render };

import { emptyState, folderList, listEntries, listEntry, pageHeader, shortDateTime } from '../../ui/ui.js';
import { getDDSMovements } from '../../core/finance/index.js';
import { getWalletTotalBalance } from '../../settings/wallets/data.js';
import { renderWallets } from '../../settings/wallets/wallets.js';

function formatMoney(value = 0, { signed = false } = {}) {
  const amount = Number(value) || 0;
  const absolute = Math.abs(amount).toLocaleString('ru-RU').replaceAll('\u00a0', ' ');
  if (!signed || Math.abs(amount) < 0.009) return `${absolute} ₽`;
  return `${amount < 0 ? '−' : '+'}${absolute} ₽`;
}

function operationMoment(item) {
  const raw = item?.refundedAt || item?.paidAt || item?.createdAt || '';
  const fallback = `${item?.date || ''} ${item?.time || ''}`.trim();
  return shortDateTime(raw, fallback);
}

function operationName(item) {
  let label = 'Операция';
  if (item?.movementType === 'income' && item?.incomeType === 'payment') label = 'Оплата';
  else if (item?.movementType === 'expense' && item?.expenseType === 'refund') label = 'Возврат';
  else if (item?.movementType === 'income') label = 'Доход';
  else if (item?.movementType === 'expense') label = 'Расход';
  return item?.status === 'cancelled' ? `${label} · Отменена` : label;
}

function operationAmount(item) {
  const total = Math.max(0, Number(item?.total) || 0);
  return item?.movementType === 'expense' ? -total : total;
}

function walletText(item) {
  if (Array.isArray(item?.allocations) && item.allocations.length) {
    return item.allocations
      .map((allocation) => `${allocation?.walletName || 'Кошелёк'} ${formatMoney(allocation?.amount)}`)
      .join(' · ');
  }
  return item?.walletName || '';
}

function clientText(item) {
  return String(item?.client?.name || '').trim();
}

function operationDetails(item) {
  const details = [clientText(item), item?.workplace || '', walletText(item)].filter(Boolean);
  if (Number(item?.tips || 0) > 0) details.push(`Чаевые ${formatMoney(item.tips)}`);
  return details.join(' · ');
}

function renderMovement(item) {
  return listEntry({
    overline: operationMoment(item),
    title: operationName(item),
    subtitle: operationDetails(item),
    rightTop: formatMoney(operationAmount(item), { signed: true }),
    initial: '₽',
    interactive: false,
  });
}

export function renderFinance(root) {
  const movements = [...getDDSMovements()].reverse();
  const cashTotal = formatMoney(getWalletTotalBalance());
  const cashFolder = folderList([{ title: 'Касса', count: cashTotal, data: 'data-finance-cash', aria: `Открыть кассу, ${cashTotal}` }]);
  const operations = movements.length
    ? listEntries(movements.map(renderMovement))
    : emptyState('Все операции', 'Финансовых операций пока нет.');

  root.innerHTML = `${pageHeader('Финансы', 'Все операции')}${cashFolder}${operations}`;
  root.querySelector('[data-finance-cash]')?.addEventListener('click', () => renderWallets(root, () => renderFinance(root)));
}

export { renderFinance as render };

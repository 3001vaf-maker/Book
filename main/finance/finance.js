import { actionBlock, button, emptyState, folderCard, list, pageHeader, shortDateTime } from '../../ui/ui.js';
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

function movementListItem(item) {
  return {
    overline: operationMoment(item),
    title: operationName(item),
    secondary: operationDetails(item),
    right: formatMoney(operationAmount(item), { signed: true }),
    interactive: false,
  };
}

function renderDDS(root) {
  const movements = [...getDDSMovements()].reverse();
  const operations = movements.length
    ? list({ items: movements.map(movementListItem) })
    : emptyState('Все операции', 'Финансовых операций пока нет.');

  root.innerHTML = `${pageHeader('ДДС', 'Все операции')}${operations}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-finance-dds-back' }))}`;
  root.querySelector('[data-finance-dds-back]')?.addEventListener('click', () => renderFinance(root));
}

export function renderFinance(root) {
  const cashTotal = formatMoney(getWalletTotalBalance());
  const cashFolder = folderCard({
    title: 'Касса',
    icon: '₽',
    count: cashTotal,
    variant: 'compact',
    data: 'data-finance-cash',
    aria: `Открыть кассу, ${cashTotal}`,
  });
  const ddsFolder = folderCard({
    title: 'ДДС',
    icon: '▤',
    variant: 'compact',
    data: 'data-finance-dds',
    aria: 'Открыть движение денежных средств',
  });

  root.innerHTML = `${pageHeader('Финансы')}<div class="ui-folder-grid">${cashFolder}${ddsFolder}</div>`;
  root.querySelector('[data-finance-cash]')?.addEventListener('click', () => renderWallets(root, () => renderFinance(root)));
  root.querySelector('[data-finance-dds]')?.addEventListener('click', () => renderDDS(root));
}

export { renderFinance as render };

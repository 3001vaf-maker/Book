import { actionBlock, button, emptyState, folderCard, list, pageHeader, shortDateTime } from '../../ui/ui.js';
import { getLedgerEntries } from '../../core/finance/index.js';
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
  const type = String(item?.economicType || '');
  let label = 'Движение';
  if (type === 'SERVICE_REVENUE') label = 'Оплата услуги';
  else if (type === 'TIPS') label = 'Чаевые';
  else if (type === 'SERVICE_REFUND') label = 'Возврат услуги';
  else if (type === 'TIPS_REFUND') label = 'Возврат чаевых';
  else if (type === 'REVERSAL') label = 'Отмена операции';
  else if (item?.direction === 'IN') label = 'Доход';
  else if (item?.direction === 'OUT') label = 'Расход';
  return item?.operationStatus === 'cancelled' ? `${label} · Отменена` : label;
}

function operationAmount(item) {
  const amount = Math.max(0, Number(item?.amount) || Math.abs(Number(item?.total) || 0));
  return item?.direction === 'OUT' ? -amount : amount;
}

function walletText(item) {
  return item?.walletName || item?.walletId || '';
}

function personText(item) {
  return String(item?.person?.name || '').trim();
}

function operationDetails(item) {
  const details = [personText(item), item?.workplace || '', walletText(item)].filter(Boolean);
  if (item?.economicType === 'TIPS' || item?.economicType === 'TIPS_REFUND') details.push('Чаевые');
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

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadDDS(movements) {
  const headers = ['Дата и время', 'Операция', 'Человек', 'Рабочее место', 'Кошелёк', 'Сумма', 'Статус', 'Чаевые'];
  const rows = movements.map((item) => [
    operationMoment(item),
    operationName(item).replace(' · Отменена', ''),
    personText(item),
    item?.workplace || '',
    walletText(item),
    operationAmount(item),
    item?.operationStatus === 'cancelled' ? 'Отменена' : 'Активна',
    item?.economicType === 'TIPS' || item?.economicType === 'TIPS_REFUND' ? Math.abs(operationAmount(item)) : 0,
  ]);
  const text = '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'Book-ДДС.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderDDS(root) {
  const movements = [...getLedgerEntries()].reverse();
  const operations = movements.length
    ? list({ items: movements.map(movementListItem) })
    : emptyState('Все операции', 'Финансовых операций пока нет.');

  root.innerHTML = `${pageHeader('ДДС', 'Все операции')}<div class="ui-list-toolbar"><div></div><div class="ui-list-toolbar__actions">${button('Excel', { className: 'ui-button--secondary', data: 'data-finance-dds-excel' })}</div></div>${operations}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-finance-dds-back' }))}`;
  root.querySelector('[data-finance-dds-excel]')?.addEventListener('click', () => downloadDDS(movements));
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

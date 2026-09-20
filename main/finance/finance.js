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
  const raw = item?.occurredAt || item?.refundedAt || item?.paidAt || item?.createdAt || '';
  const fallback = `${item?.date || ''} ${item?.time || ''}`.trim();
  return shortDateTime(raw, fallback);
}

function operationName(item) {
  let label = item?.direction === 'OUT' ? 'Расход' : 'Доход';
  if (item?.operationType === 'payment') label = item?.component === 'tips' ? 'Tips' : 'Оплата услуги';
  else if (item?.operationType === 'refund') label = item?.component === 'tips' ? 'Возврат Tips' : 'Возврат';
  else if (item?.operationType === 'cancellation') label = 'Отмена операции';
  return item?.status === 'cancelled' ? `${label} · Отменена` : label;
}

function operationAmount(item) {
  const total = Math.max(0, Number(item?.amount ?? item?.total) || 0);
  return item?.direction === 'OUT' ? -total : total;
}

function walletText(item) {
  return item?.walletName || '';
}

function personText(item) {
  return String(item?.person?.name || '').trim();
}

function operationDetails(item) {
  return [personText(item), item?.workplace || '', walletText(item), item?.economicType || ''].filter(Boolean).join(' · ');
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
  const headers = ['Дата и время', 'Операция', 'Экономический тип', 'Человек', 'Рабочее место', 'Кошелёк', 'Сумма', 'Статус', 'operationId'];
  const rows = movements.map((item) => [
    operationMoment(item),
    operationName(item).replace(' · Отменена', ''),
    item?.economicType || '',
    personText(item),
    item?.workplace || '',
    walletText(item),
    operationAmount(item),
    item?.status === 'cancelled' ? 'Отменена' : 'Активна',
    item?.operationId || '',
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
  const movements = [...getDDSMovements()].reverse();
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

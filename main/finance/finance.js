import { actionBlock, button, details, emptyState, field, folderCard, list, modal, mountModal, openNotice, pageHeader, shortDateTime } from '../../ui/ui.js';
import { cancelFinanceOperation, getLedgerEntries } from '../../core/finance/index.js';
import { getWalletTotalBalance } from '../../settings/wallets/data.js';
import { renderWallets } from '../../settings/wallets/wallets.js';
import { renderFinanceArticles } from './articles.js';
import { renderIncomeExpense } from './income-expense.js';
import { renderSpecialFinanceOperations } from './special-operations.js';
import { renderZReport } from './z-report.js';

function formatMoney(value = 0, { signed = false } = {}) {
  const amount = Number(value) || 0;
  const absolute = Math.abs(amount).toLocaleString('ru-RU').replaceAll('\u00a0', ' ');
  if (!signed || Math.abs(amount) < 0.009) return `${absolute} ₽`;
  return `${amount < 0 ? '−' : '+'}${absolute} ₽`;
}

function operationMoment(item) {
  const raw = item?.occurredAt || item?.refundedAt || item?.paidAt || '';
  const fallback = `${item?.date || ''} ${item?.time || ''}`.trim();
  return shortDateTime(raw, fallback);
}

function recordedMoment(item) {
  const raw = item?.recordedAt || '';
  return raw ? shortDateTime(raw, '') : '';
}

function operationName(item) {
  const type = String(item?.economicType || '');
  let label = 'Движение';
  if (type === 'SERVICE_REVENUE') label = 'Оплата услуги';
  else if (type === 'TIPS') label = 'Чаевые';
  else if (type === 'SERVICE_REFUND') label = 'Возврат услуги';
  else if (type === 'TIPS_REFUND') label = 'Возврат чаевых';
  else if (type === 'REVERSAL') label = 'Отмена операции';
  else if (type === 'LOAN_RECEIVED') label = 'Получен займ';
  else if (type === 'LOAN_REPAYMENT') label = 'Возврат займа';
  else if (type === 'INVESTMENT_RECEIVED') label = 'Получена инвестиция';
  else if (type === 'INVESTMENT_RETURN') label = 'Возврат инвестиций';
  else if (type === 'TRANSFER') label = item?.direction === 'OUT' ? 'Перевод · списание' : 'Перевод · зачисление';
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
  const details = [
    personText(item),
    item?.sourceDetails || '',
    item?.articleName || '',
    item?.lineName || '',
    item?.counterparty || '',
    item?.workplace || '',
    walletText(item),
  ].filter(Boolean);
  if (item?.economicType === 'TIPS' || item?.economicType === 'TIPS_REFUND') details.push('Чаевые');
  if (item?.quantity != null && item?.unitPrice != null && Number(item.quantity) !== 1) {
    details.push(`${item.quantity} × ${formatMoney(item.unitPrice)}`);
  }
  const recorded = recordedMoment(item);
  if (recorded) details.push(`Внесено ${recorded}`);
  return details.join(' · ');
}

function movementListItem(item) {
  const interactive = Boolean(item?.operationId);
  return {
    overline: operationMoment(item),
    title: operationName(item),
    secondary: operationDetails(item),
    right: formatMoney(operationAmount(item), { signed: true }),
    interactive,
    data: interactive ? `data-finance-operation="${item.operationId}"` : '',
    aria: interactive ? `Открыть финансовую операцию ${operationName(item)}` : '',
  };
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadDDS(movements) {
  const headers = ['Фактическая дата и время', 'Внесено в Book', 'Операция', 'Статья', 'Позиция', 'Человек', 'Рабочее место', 'Кошелёк', 'Сумма', 'Статус', 'Чаевые'];
  const rows = movements.map((item) => [
    operationMoment(item),
    recordedMoment(item),
    operationName(item).replace(' · Отменена', ''),
    item?.articleName || '',
    item?.lineName || '',
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

function localDateTimeValue(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function openFinanceOperation(root, movements, operationId) {
  const id = String(operationId || '');
  const entries = movements.filter((item) => String(item?.operationId || '') === id);
  if (!entries.length) return;
  const first = entries[0];
  const canCancel = first?.operationKind !== 'cancel' && first?.operationStatus !== 'cancelled';
  const person = [first?.person?.name, first?.person?.surname].filter(Boolean).join(' ').trim();
  const wallets = [...new Set(entries.map((item) => walletText(item)).filter(Boolean))].join(' + ');
  const articles = [...new Set(entries.map((item) => String(item?.articleName || '')).filter(Boolean))].join(', ');
  const sourceDetails = [...new Set(entries.map((item) => String(item?.sourceDetails || '')).filter(Boolean))].join(', ');
  const context = details([
    { label: 'Фактическая дата и время', value: operationMoment(first) || '—' },
    { label: 'Внесено в Book', value: recordedMoment(first) || '—' },
    person ? { label: 'Клиент', value: person } : null,
    sourceDetails ? { label: 'За что', value: sourceDetails } : null,
    first?.workplace ? { label: 'Рабочее место', value: first.workplace } : null,
    wallets ? { label: 'Кошелёк', value: wallets } : null,
    articles ? { label: 'Статья', value: articles } : null,
    first?.counterparty ? { label: 'Контрагент', value: first.counterparty } : null,
    first?.note ? { label: 'Комментарий', value: first.note } : null,
    { label: 'Статус', value: first?.operationStatus === 'cancelled' ? 'Отменена' : 'Активна' },
  ]);
  const rows = list({
    items: entries.map((item) => ({
      ...movementListItem(item),
      interactive: false,
      data: '',
      aria: '',
    })),
  });
  const cancel = canCancel
    ? `<div class="compact-form">
        ${field({ label: 'Фактическая дата и время отмены', name: 'financeCancelOccurredAt', type: 'datetime-local', value: localDateTimeValue(), required: true })}
        <p>Ошибочный ввод останется в финансовой истории, а его влияние на кошельки и отчёты будет отменено обратной операцией.</p>
        ${button('Отменить ошибочную операцию', { variant: 'danger', data: 'data-finance-operation-cancel' })}
      </div>`
    : '';
  const m = mountModal(root, modal(`<div class="modal-title"><h2>${operationName(first)}</h2></div>${context}${rows}${cancel}`, { variant: 'medium' }));
  if (!m || !canCancel) return;
  m.querySelector('[data-finance-operation-cancel]')?.addEventListener('click', async () => {
    const input = m.querySelector('input[name="financeCancelOccurredAt"]');
    if (!input?.value) return;
    try {
      const cancelled = await cancelFinanceOperation(id, {
        reason: 'incorrect-entry',
        occurredAt: new Date(input.value),
      });
      if (!cancelled) return;
      m.remove();
      renderDDS(root);
    } catch (error) {
      openNotice({ message: String(error?.message || 'Не удалось отменить операцию') });
    }
  });
}

function renderDDS(root) {
  const movements = [...getLedgerEntries()].reverse();
  const operations = movements.length
    ? list({ items: movements.map(movementListItem) })
    : emptyState('Все операции', 'Финансовых операций пока нет.');

  root.innerHTML = `${pageHeader('ДДС', 'Все операции')}<div class="ui-list-toolbar"><div></div><div class="ui-list-toolbar__actions">${button('Excel', { className: 'ui-button--secondary', data: 'data-finance-dds-excel' })}</div></div>${operations}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-finance-dds-back' }))}`;
  root.querySelector('[data-finance-dds-excel]')?.addEventListener('click', () => downloadDDS(movements));
  root.querySelectorAll('[data-finance-operation]').forEach((element) => {
    element.addEventListener('click', () => openFinanceOperation(root, movements, element.dataset.financeOperation));
  });
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

  const incomeExpenseFolder = folderCard({
    title: 'Доход / Расход',
    icon: '±',
    variant: 'compact',
    data: 'data-finance-income-expense',
    aria: 'Открыть доходы и расходы',
  });
  const articlesFolder = folderCard({
    title: 'Статьи',
    icon: '≡',
    variant: 'compact',
    data: 'data-finance-articles',
    aria: 'Открыть статьи доходов и расходов',
  });
  const specialFolder = folderCard({
    title: 'Прочие операции',
    icon: '↔',
    variant: 'compact',
    data: 'data-finance-special',
    aria: 'Открыть займы, инвестиции и переводы',
  });
  const zReportFolder = folderCard({
    title: 'Z-отчёт',
    icon: 'Z',
    variant: 'compact',
    data: 'data-finance-z-report',
    aria: 'Открыть Z-отчёт',
  });

  root.innerHTML = `${pageHeader('Финансы')}<div class="ui-folder-grid">${cashFolder}${ddsFolder}${incomeExpenseFolder}${articlesFolder}${specialFolder}${zReportFolder}</div>`;
  root.querySelector('[data-finance-cash]')?.addEventListener('click', () => renderWallets(root, () => renderFinance(root)));
  root.querySelector('[data-finance-dds]')?.addEventListener('click', () => renderDDS(root));
  root.querySelector('[data-finance-income-expense]')?.addEventListener('click', () => renderIncomeExpense(root, () => renderFinance(root)));
  root.querySelector('[data-finance-articles]')?.addEventListener('click', () => renderFinanceArticles(root, () => renderFinance(root)));
  root.querySelector('[data-finance-special]')?.addEventListener('click', () => renderSpecialFinanceOperations(root, () => renderFinance(root)));
  root.querySelector('[data-finance-z-report]')?.addEventListener('click', () => renderZReport(root, () => renderFinance(root)));
}

export { renderFinance as render };

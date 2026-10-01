import {
  actionBlock,
  button,
  details,
  emptyState,
  field,
  list,
  modal,
  mountModal,
  mountV2ZLayer,
  openNotice,
  select,
  shortDateTime,
  v2Section,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../../ui/ui.js';
import { canUseBookCapability } from '../../access.js';
import { cancelFinanceOperation } from '../service.js';
import { getLedgerEntries } from '../read.js';
import { renderFinanceArticles } from './articles.js';
import { renderIncomeExpenseOperation } from './income-expense.js';
import { SPECIAL_FINANCE_ACTIONS, renderSpecialFinanceOperation } from './special-operations.js';

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
  const values = [
    personText(item),
    item?.sourceDetails || '',
    item?.articleName || '',
    item?.lineName || '',
    item?.counterparty || '',
    item?.workplace || '',
    walletText(item),
  ].filter(Boolean);
  if (item?.economicType === 'TIPS' || item?.economicType === 'TIPS_REFUND') values.push('Чаевые');
  if (item?.quantity != null && item?.unitPrice != null && Number(item.quantity) !== 1) {
    values.push(`${item.quantity} × ${formatMoney(item.unitPrice)}`);
  }
  const recorded = recordedMoment(item);
  if (recorded) values.push(`Внесено ${recorded}`);
  return values.join(' · ');
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
  const headers = ['Фактическая дата и время', 'Внесено в систему', 'Операция', 'Статья', 'Позиция', 'Человек', 'Рабочее место', 'Кошелёк', 'Сумма', 'Статус', 'Чаевые'];
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
  anchor.download = 'ДДС.csv';
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
    { label: 'Внесено в систему', value: recordedMoment(first) || '—' },
    person ? { label: 'Конечный пользователь', value: person } : null,
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

function movementDay(item) {
  const raw = String(item?.occurredAt || item?.refundedAt || item?.paidAt || item?.date || '').trim();
  if (!raw) return '';
  return raw.slice(0, 10);
}

function exportKind(item) {
  const type = String(item?.economicType || '');
  if (type === 'TRANSFER') return 'transfer';
  if (type === 'LOAN_RECEIVED' || type === 'LOAN_REPAYMENT') return 'loan';
  if (type === 'INVESTMENT_RECEIVED' || type === 'INVESTMENT_RETURN') return 'investment';
  return item?.direction === 'OUT' ? 'expense' : 'income';
}

function filterExportMovements(movements, form) {
  const data = new FormData(form);
  const from = String(data.get('from') || '');
  const to = String(data.get('to') || '');
  const kind = String(data.get('kind') || '');
  const walletId = String(data.get('walletId') || '');
  const status = String(data.get('status') || '');
  return movements.filter((item) => {
    const day = movementDay(item);
    if (from && (!day || day < from)) return false;
    if (to && (!day || day > to)) return false;
    if (kind && exportKind(item) !== kind) return false;
    if (walletId && String(item?.walletId || '') !== walletId) return false;
    if (status === 'active' && item?.operationStatus === 'cancelled') return false;
    if (status === 'cancelled' && item?.operationStatus !== 'cancelled') return false;
    return true;
  });
}

function openDDSExport(root, movements) {
  const wallets = [...new Map(movements
    .filter((item) => item?.walletId)
    .map((item) => [String(item.walletId), { value: String(item.walletId), label: walletText(item) || String(item.walletId) }])).values()];
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'finance-dds-export-z' }), { stack: true });
  if (!layer) return;
  layer.innerHTML = `${workspaceHeaderContext({
    title: 'Выгрузка ДДС',
    c: { label: 'Выгрузить', data: 'data-finance-dds-export-submit', aria: 'Выгрузить ДДС' },
  })}
    <form class="compact-form" data-finance-dds-export-form>
      ${field({ label: 'С', name: 'from', type: 'date' })}
      ${field({ label: 'До', name: 'to', type: 'date' })}
      ${select({
        label: 'Операции',
        name: 'kind',
        value: '',
        options: [
          { value: '', label: 'Все операции' },
          { value: 'income', label: 'Доходы' },
          { value: 'expense', label: 'Расходы' },
          { value: 'loan', label: 'Займы' },
          { value: 'investment', label: 'Инвестиции' },
          { value: 'transfer', label: 'Переводы' },
        ],
      })}
      ${select({
        label: 'Кошелёк',
        name: 'walletId',
        value: '',
        options: [{ value: '', label: 'Все кошельки' }, ...wallets],
      })}
      ${select({
        label: 'Статус',
        name: 'status',
        value: '',
        options: [
          { value: '', label: 'Все' },
          { value: 'active', label: 'Активные' },
          { value: 'cancelled', label: 'Отменённые' },
        ],
      })}
    </form>`;
  layer.querySelector('[data-finance-dds-export-submit]')?.addEventListener('click', () => {
    const form = layer.querySelector('[data-finance-dds-export-form]');
    if (!form) return;
    downloadDDS(filterExportMovements(movements, form));
    layer.v2Close?.();
  });
}

function operationGroups() {
  const groups = [];
  if (canUseBookCapability('finance.income_expense.access')) {
    groups.push({
      title: 'Доход / Расход',
      items: [
        { id: 'manual-income', label: 'Доход' },
        { id: 'manual-expense', label: 'Расход' },
      ],
    });
  }
  if (canUseBookCapability('finance.special.access')) {
    groups.push({
      title: 'Займы',
      items: SPECIAL_FINANCE_ACTIONS.filter((item) => item.group === 'loan'),
    });
    groups.push({
      title: 'Инвестиции',
      items: SPECIAL_FINANCE_ACTIONS.filter((item) => item.group === 'investment'),
    });
    groups.push({
      title: 'Переводы',
      items: SPECIAL_FINANCE_ACTIONS.filter((item) => item.group === 'transfer'),
    });
  }
  return groups.filter((group) => group.items.length);
}

function openFinanceOperationForm(root, actionId) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'finance-dds-operation-z' }), { stack: true });
  if (!layer) return;
  const onSaved = () => {
    layer.v2Close?.();
    renderDDS(root);
  };
  let rendered = false;
  if (actionId === 'manual-income') rendered = renderIncomeExpenseOperation(layer, 'IN', { onSaved });
  else if (actionId === 'manual-expense') rendered = renderIncomeExpenseOperation(layer, 'OUT', { onSaved });
  else rendered = renderSpecialFinanceOperation(layer, actionId, { onSaved });
  if (!rendered) layer.v2Close?.();
}

function openFinancialOperations(root) {
  const groups = operationGroups();
  if (!groups.length) return;
  const content = groups.map((group) => v2Section(
    group.title,
    actionBlock(group.items.map((item) => button(item.label, {
      variant: 'secondary',
      data: `data-finance-operation-action="${item.id}"`,
    })).join('')),
  )).join('');
  const picker = mountModal(root, modal(content, {
    title: 'Финансовые операции',
    variant: 'quick',
    surface: 'app',
  }));
  if (!picker) return;
  picker.querySelectorAll('[data-finance-operation-action]').forEach((element) => {
    element.addEventListener('click', () => {
      const actionId = String(element.dataset.financeOperationAction || '');
      picker.v2Close?.();
      openFinanceOperationForm(root, actionId);
    });
  });
}

function openArticles(root) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'finance-dds-articles-z' }), { stack: true });
  if (!layer) return;
  renderFinanceArticles(layer);
}

function availableDDSSettings() {
  const items = [{ id: 'excel', label: 'Эксель' }];
  if (operationGroups().length) items.push({ id: 'operations', label: 'Финансовые операции' });
  if (canUseBookCapability('finance.articles.access')) items.push({ id: 'articles', label: 'Статьи' });
  return items;
}

function openDDSSettings(root, movements) {
  const items = availableDDSSettings();
  if (!items.length) return;
  const content = actionBlock(items.map((item) => button(item.label, {
    variant: 'secondary',
    data: `data-finance-dds-tool="${item.id}"`,
  })).join(''));
  const settings = mountModal(root, modal(content, {
    title: 'Настройки ДДС',
    variant: 'quick',
    surface: 'app',
  }));
  if (!settings) return;
  settings.querySelectorAll('[data-finance-dds-tool]').forEach((element) => {
    element.addEventListener('click', () => {
      const id = String(element.dataset.financeDdsTool || '');
      settings.v2Close?.();
      if (id === 'excel') openDDSExport(root, movements);
      else if (id === 'operations') openFinancialOperations(root);
      else if (id === 'articles') openArticles(root);
    });
  });
}

function renderDDS(root) {
  const movements = [...getLedgerEntries()].reverse();
  const operations = movements.length
    ? list({ items: movements.map(movementListItem) })
    : emptyState('Все операции', 'Финансовых операций пока нет.');
  const settingsItems = availableDDSSettings();
  const headerContext = workspaceHeaderContext({
    title: 'Движения денежных средств',
    a: settingsItems.length ? {
      kind: 'settings',
      data: 'data-finance-dds-settings',
      aria: 'Настройки ДДС',
    } : null,
  });

  root.innerHTML = `${headerContext}${operations}`;
  root.querySelector('[data-finance-dds-settings]')?.addEventListener('click', () => openDDSSettings(root, movements));
  root.querySelectorAll('[data-finance-operation]').forEach((element) => {
    element.addEventListener('click', () => openFinanceOperation(root, movements, element.dataset.financeOperation));
  });
}

export { renderDDS };

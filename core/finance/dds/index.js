import {
  actionBlock,
  button,
  emptyState,
  field,
  infoUI,
  modal,
  mountModal,
  mountV2ZLayer,
  openNotice,
  openSharedProfileSettingsMenu,
  select,
  shortDateTime,
  shortDateTimeParts,
  v2ListEntries,
  v2ListEntry,
  v2Section,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../../ui/ui.js';
import { readOnlyReceipt } from '../../../ui/receipt/index.js';
import { canUseBookCapability } from '../../access.js';
import { getFinanceOperation } from '../data.js';
import { getWallets } from '../cash/data.js';
import { cancelFinanceOperation, correctFinanceOperation, hardDeleteFinanceOperation } from '../service.js';
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
  const kind = String(item?.operationKind || '');
  const type = String(item?.economicType || '');
  let label = 'Движение';
  if (kind === 'payment') label = 'Оплата услуги';
  else if (kind === 'cancel') label = 'Отмена операции';
  else if (kind === 'refund') label = 'Возврат';
  else if (kind === 'manual-income') label = 'Доход';
  else if (kind === 'manual-expense') label = 'Расход';
  else if (kind === 'loan-received') label = 'Получен займ';
  else if (kind === 'loan-repayment') label = 'Возврат займа';
  else if (kind === 'investment-received') label = 'Получена инвестиция';
  else if (kind === 'investment-return') label = 'Возврат инвестиций';
  else if (kind === 'transfer') label = 'Перевод';
  else if (type === 'SERVICE_REVENUE') label = 'Оплата услуги';
  else if (type === 'TIPS') label = 'Чаевые';
  else if (type === 'SERVICE_REFUND') label = 'Возврат услуги';
  else if (type === 'TIPS_REFUND') label = 'Возврат чаевых';
  else if (type === 'REVERSAL') label = 'Отмена операции';
  else if (type === 'LOAN_RECEIVED') label = 'Получен займ';
  else if (type === 'LOAN_REPAYMENT') label = 'Возврат займа';
  else if (type === 'INVESTMENT_RECEIVED') label = 'Получена инвестиция';
  else if (type === 'INVESTMENT_RETURN') label = 'Возврат инвестиций';
  else if (type === 'TRANSFER') label = 'Перевод';
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
  return [item?.person?.name, item?.person?.surname].filter(Boolean).join(' ').trim();
}

function operationGroupsFromLedger(movements = []) {
  const groups = new Map();
  (Array.isArray(movements) ? movements : []).forEach((item) => {
    const id = String(item?.operationId || '').trim();
    if (!id || item?.operationKind === 'cancel') return;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(item);
  });
  return [...groups.values()];
}

function operationTotal(entries = []) {
  const rows = Array.isArray(entries) ? entries : [];
  const declared = Math.max(0, Number(rows[0]?.operationTotal) || 0);
  if (declared > 0) return declared;
  if (rows[0]?.operationKind === 'transfer') {
    return Math.max(0, ...rows.map((item) => Math.max(0, Number(item?.amount) || 0)));
  }
  return rows.reduce((sum, item) => sum + Math.max(0, Number(item?.amount) || 0), 0);
}

function operationDisplayAmount(entries = []) {
  const rows = Array.isArray(entries) ? entries : [];
  const total = operationTotal(rows);
  if (rows[0]?.operationKind === 'transfer') return formatMoney(total);
  const directions = new Set(rows.map((item) => String(item?.direction || '')).filter(Boolean));
  if (directions.size === 1 && directions.has('OUT')) return formatMoney(-total, { signed: true });
  if (directions.size === 1 && directions.has('IN')) return formatMoney(total, { signed: true });
  return formatMoney(total);
}

function operationListSubtitle(entries = []) {
  const rows = Array.isArray(entries) ? entries : [];
  const first = rows[0] || {};
  const wallets = [...new Set(rows.map((item) => walletText(item)).filter(Boolean))];
  if (first?.operationKind === 'transfer') {
    const from = rows.find((item) => item?.direction === 'OUT');
    const to = rows.find((item) => item?.direction === 'IN');
    return [walletText(from), walletText(to)].filter(Boolean).join(' → ');
  }
  const articles = [...new Set(rows.map((item) => String(item?.articleName || '')).filter(Boolean))];
  return [
    articles.join(', '),
    personText(first),
    first?.workplace || '',
    wallets.join(' + '),
  ].filter(Boolean).join(' · ');
}

function operationListEntry(entries = []) {
  const first = entries[0] || {};
  const id = String(first?.operationId || '');
  return v2ListEntry({
    title: operationName(first),
    subtitle: operationListSubtitle(entries),
    rightTop: operationDisplayAmount(entries),
    rightBottom: operationMoment(first),
    interactive: Boolean(id),
    initial: '',
    data: id ? `data-finance-operation="${id}"` : '',
    aria: id ? `Открыть финансовую операцию ${operationName(first)}` : '',
  });
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

function operationReceiptItems(entries = []) {
  const rows = Array.isArray(entries) ? entries : [];
  const first = rows[0] || {};
  const items = [];
  const recorded = recordedMoment(first);
  if (recorded) items.push({ label: `Внесено · ${recorded}`, value: '' });

  const articles = [...new Set(rows.map((item) => String(item?.articleName || '')).filter(Boolean))];
  if (articles.length && first?.operationKind !== 'transfer') {
    items.push({ label: `Статья · ${articles.join(', ')}`, value: '' });
  }

  const person = personText(first);
  const uei = String(first?.person?.uei || '').trim();
  if (person || uei) items.push({ label: [uei, person].filter(Boolean).join(' · '), value: '' });
  if (first?.workplace) items.push({ label: `Рабочее место · ${first.workplace}`, value: '' });

  const wallets = [...new Set(rows.map((item) => walletText(item)).filter(Boolean))];
  if (first?.operationKind === 'transfer') {
    const from = rows.find((item) => item?.direction === 'OUT');
    const to = rows.find((item) => item?.direction === 'IN');
    if (walletText(from)) items.push({ label: `Из кошелька · ${walletText(from)}`, value: '' });
    if (walletText(to)) items.push({ label: `В кошелёк · ${walletText(to)}`, value: '' });
  } else if (wallets.length === 1) {
    items.push({ label: `Кошелёк · ${wallets[0]}`, value: '' });
  } else if (wallets.length > 1) {
    items.push({ label: `Кошельки · ${wallets.join(' + ')}`, value: '' });
  }

  if (first?.counterparty) items.push({ label: `Контрагент · ${first.counterparty}`, value: '' });
  if (first?.note) items.push({ label: `Комментарий · ${first.note}`, value: '' });

  let lines = [];
  if (first?.operationKind === 'payment') {
    const settlementItems = Array.isArray(first?.settlementItems) ? first.settlementItems : [];
    const tips = rows
      .filter((item) => item?.economicType === 'TIPS')
      .reduce((sum, item) => sum + Math.max(0, Number(item?.amount) || 0), 0);
    const servicePaid = Math.max(0, operationTotal(rows) - tips);
    const settlementTotal = settlementItems.reduce((sum, item) => sum + Math.max(0, Number(item?.planAmount ?? item?.price) || 0), 0);
    const canShowLineAmounts = settlementItems.length > 1 && Math.abs(settlementTotal - servicePaid) < 0.01;
    lines = settlementItems.map((item) => ({
      label: String(item?.name || 'Услуга'),
      value: canShowLineAmounts ? formatMoney(item?.planAmount ?? item?.price) : '',
    }));
    if (tips > 0) lines.push({ label: 'Чаевые', value: formatMoney(tips) });
  } else if (first?.operationKind !== 'transfer') {
    lines = rows
      .filter((item) => String(item?.lineName || '').trim())
      .map((item) => ({
        label: String(item.lineName),
        value: formatMoney(Math.max(0, Number(item?.amount) || 0)),
      }));
  }

  if (lines.length === 1) lines[0].value = '';
  items.push(...lines);
  return { items, lineCount: lines.length };
}

function openCancellationInfo(root) {
  return openNotice({
    title: 'Об отмене операции',
    message: 'Отмена сохраняет исходную операцию в истории и создаёт обратную операцию на выбранные фактические дату и время.',
    action: 'Закрыть',
    variant: 'top',
    surface: 'app',
  });
}

function openCancelOperation(root, operationLayer, entries) {
  const first = entries[0] || {};
  const content = `<div class="ui-list-toolbar"><div></div><div class="ui-list-toolbar__actions">${infoUI('', {
    aria: 'Что означает отмена операции',
    data: 'data-finance-cancel-info',
    actionOnly: true,
  })}</div></div>
    <div class="compact-form">
      ${field({ label: 'Фактическая дата и время отмены', name: 'financeCancelOccurredAt', type: 'datetime-local', value: localDateTimeValue(), required: true })}
      ${button('Отменить', { variant: 'danger', data: 'data-finance-operation-cancel-confirm' })}
    </div>`;
  const cancelLayer = mountModal(document.body, modal(content, {
    title: 'Отменить операцию',
    variant: 'bottom',
    className: 'modal--time-picker-sheet',
    surface: 'app',
  }));
  if (!cancelLayer) return;

  cancelLayer.querySelector('[data-finance-cancel-info] [data-info-trigger]')?.addEventListener('click', () => {
    openCancellationInfo(root);
  });
  cancelLayer.querySelector('[data-finance-operation-cancel-confirm]')?.addEventListener('click', async () => {
    const input = cancelLayer.querySelector('input[name="financeCancelOccurredAt"]');
    if (!input?.value) return;
    try {
      const cancelled = await cancelFinanceOperation(first.operationId, {
        reason: 'incorrect-entry',
        occurredAt: new Date(input.value),
      });
      if (!cancelled) return;
      cancelLayer.v2Close?.();
      operationLayer.v2Close?.();
      renderDDS(root);
    } catch (error) {
      openNotice({ message: String(error?.message || 'Не удалось отменить операцию') });
    }
  });
}

function openDeleteOperation(root, operationLayer, entries) {
  const first = entries[0] || {};
  const content = `<div class="modal-title"><h2>Удалить операцию?</h2><p>Операция и связанные с ней финансовые записи будут удалены без возможности восстановления.</p></div>
    <div class="modal-actions">
      ${button('Отмена', { variant: 'secondary', data: 'data-finance-operation-delete-close' })}
      ${button('Удалить', { variant: 'critical', data: 'data-finance-operation-delete-confirm' })}
    </div>`;
  const confirmation = mountModal(root, modal(content, {
    title: 'Удалить операцию',
    variant: 'top',
    surface: 'app',
  }));
  if (!confirmation) return;

  confirmation.querySelector('[data-finance-operation-delete-close]')?.addEventListener('click', () => confirmation.v2Close?.());
  confirmation.querySelector('[data-finance-operation-delete-confirm]')?.addEventListener('click', async () => {
    try {
      await hardDeleteFinanceOperation(first.operationId);
      confirmation.v2Close?.();
      operationLayer.v2Close?.();
      renderDDS(root);
    } catch (error) {
      openNotice({ message: String(error?.message || 'Не удалось удалить операцию') });
    }
  });
}

function openOperationSettings(root, operationLayer, entries) {
  const first = entries[0] || {};
  const canCancel = first?.operationStatus !== 'cancelled';
  return openSharedProfileSettingsMenu({
    title: 'Настройки операции',
    actions: [
      canCancel ? {
        id: 'cancel-operation',
        label: 'Отменить операцию',
        variant: 'outline',
        onSelect: () => openCancelOperation(root, operationLayer, entries),
      } : null,
      {
        id: 'delete-operation',
        label: 'Удалить операцию',
        variant: 'critical',
        onSelect: () => openDeleteOperation(root, operationLayer, entries),
      },
    ].filter(Boolean),
  });
}

function openFinanceOperation(root, movements, operationId) {
  const id = String(operationId || '');
  const entries = movements.filter((item) => String(item?.operationId || '') === id);
  if (!entries.length) return;
  const first = entries[0];
  const when = shortDateTimeParts(first?.occurredAt || '');
  const receiptContent = operationReceiptItems(entries);
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'finance-dds-receipt-z' }), { stack: true });
  if (!layer) return;

  layer.innerHTML = `${workspaceHeaderContext({
    title: operationName(first),
    a: {
      kind: 'settings',
      data: 'data-finance-operation-settings',
      aria: 'Настройки операции',
    },
  })}${readOnlyReceipt({
    title: operationName(first).replace(' · Отменена', ''),
    status: first?.operationStatus === 'cancelled' ? 'Отменена · Факт операции' : 'Факт операции',
    date: when.date || '—',
    time: when.time || '—',
    items: receiptContent.items,
    totals: [{
      label: receiptContent.lineCount > 1 ? 'Итого' : '',
      value: formatMoney(operationTotal(entries)),
      strong: true,
    }],
  })}`;

  layer.querySelector('[data-finance-operation-settings]')?.addEventListener('click', () => {
    openOperationSettings(root, layer, entries);
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
  const groupedOperations = operationGroupsFromLedger(movements);
  const operations = groupedOperations.length
    ? v2ListEntries(groupedOperations.map(operationListEntry))
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

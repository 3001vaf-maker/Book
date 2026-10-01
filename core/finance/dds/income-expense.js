import {
  button,
  field,
  openNotice,
  select,
  textareaField,
  workspaceHeaderContext,
} from '../../../ui/ui.js';
import { getFinanceArticles } from '../data.js';
import { getWallets } from '../cash/data.js';
import { recordManualFinanceOperation } from '../service.js';

function localDateTimeValue(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function articleOptions(direction) {
  return getFinanceArticles()
    .filter((item) => item.direction === direction && item.economicType !== 'GROUP')
    .map((item) => ({ value: item.articleId, label: item.name }));
}

function walletOptions() {
  return getWallets().map((item) => ({ value: item.id, label: item.name }));
}

function detailRow(values = {}) {
  return `<div class="array-row" data-finance-manual-line>
    <input type="text" name="lineName" value="${String(values.name || '').replaceAll('"', '&quot;')}" placeholder="Что купили / что получили">
    <input type="number" min="0" step="0.01" inputmode="decimal" name="lineQuantity" value="${values.quantity ?? 1}" placeholder="Количество">
    <input type="number" min="0" step="0.01" inputmode="decimal" name="linePrice" value="${values.unitPrice ?? ''}" placeholder="Цена">
    <button type="button" class="remove-button" data-finance-manual-line-remove aria-label="Удалить строку">×</button>
  </div>`;
}

function modeMarkup(mode) {
  if (mode === 'detail') {
    return `<div class="array-group" data-finance-manual-detail>
      <span class="array-label">Позиции</span>
      <div data-finance-manual-lines>${detailRow()}</div>
      ${button('+ Добавить позицию', { type: 'button', variant: 'secondary', data: 'data-finance-manual-line-add' })}
    </div>`;
  }
  return field({
    label: 'Сумма',
    name: 'amount',
    type: 'number',
    inputmode: 'decimal',
    required: true,
    placeholder: '0',
    data: 'min="0" step="0.01"',
  });
}

function syncMode(root) {
  const mode = String(root.querySelector('input[name="entryMode"]')?.value || 'simple');
  const host = root.querySelector('[data-finance-manual-mode]');
  if (!host) return;
  host.innerHTML = modeMarkup(mode);
}

function collectLines(root) {
  return [...root.querySelectorAll('[data-finance-manual-line]')].map((row) => ({
    name: String(row.querySelector('[name="lineName"]')?.value || '').trim(),
    quantity: Number(row.querySelector('[name="lineQuantity"]')?.value || 0),
    unitPrice: Number(row.querySelector('[name="linePrice"]')?.value || 0),
  })).filter((row) => row.quantity > 0 && row.unitPrice > 0);
}

async function saveManual(root, direction, onSaved) {
  const form = root.querySelector('[data-finance-manual-form]');
  if (!form) return;
  const data = new FormData(form);
  const mode = String(data.get('entryMode') || 'simple');
  const walletId = String(data.get('walletId') || '');
  const wallet = getWallets().find((item) => item.id === walletId);
  const payload = {
    direction,
    articleId: String(data.get('articleId') || ''),
    walletId,
    walletName: wallet?.name || '',
    amount: mode === 'simple' ? Number(data.get('amount') || 0) : null,
    lines: mode === 'detail' ? collectLines(root) : [],
    note: String(data.get('note') || '').trim(),
    occurredAt: data.get('occurredAt') ? new Date(String(data.get('occurredAt'))).toISOString() : '',
  };
  if (!payload.occurredAt) {
    openNotice({ message: 'Укажите фактическую дату и время операции.' });
    return;
  }
  try {
    await recordManualFinanceOperation(payload);
    onSaved?.();
  } catch (error) {
    openNotice({ message: String(error?.message || 'Не удалось сохранить операцию') });
  }
}

export function renderIncomeExpenseOperation(root, direction, { onSaved = null } = {}) {
  const isIncome = direction === 'IN';
  const articles = articleOptions(direction);
  const wallets = walletOptions();
  if (!articles.length) {
    openNotice({ message: 'Сначала добавьте конечную статью для этого типа операции.' });
    return false;
  }
  if (!wallets.length) {
    openNotice({ message: 'Сначала добавьте кошелёк.' });
    return false;
  }

  root.innerHTML = `${workspaceHeaderContext({
    title: isIncome ? 'Доход' : 'Расход',
    c: {
      label: 'Сохранить',
      data: 'data-finance-manual-save',
      aria: isIncome ? 'Сохранить доход' : 'Сохранить расход',
    },
  })}
    <form class="compact-form" data-finance-manual-form>
      ${select({ label: 'Статья', name: 'articleId', value: articles[0]?.value || '', options: articles, searchable: true })}
      ${select({ label: 'Кошелёк', name: 'walletId', value: wallets[0]?.value || '', options: wallets })}
      ${select({ label: 'Ввод', name: 'entryMode', value: 'simple', options: [{ value: 'simple', label: 'Сумма' }, { value: 'detail', label: 'Детально' }] })}
      ${field({ label: 'Фактическая дата и время', name: 'occurredAt', type: 'datetime-local', value: localDateTimeValue(), required: true })}
      <div data-finance-manual-mode>${modeMarkup('simple')}</div>
      ${textareaField({ label: 'Примечание', name: 'note', rows: 3, placeholder: 'Необязательно' })}
    </form>`;

  root.addEventListener('change', (event) => {
    if (event.target?.matches?.('input[name="entryMode"]')) syncMode(root);
  });
  root.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-finance-manual-line-add]')) {
      root.querySelector('[data-finance-manual-lines]')?.insertAdjacentHTML('beforeend', detailRow());
      return;
    }
    const remove = event.target.closest?.('[data-finance-manual-line-remove]');
    if (remove) {
      const rows = root.querySelectorAll('[data-finance-manual-line]');
      if (rows.length > 1) remove.closest('[data-finance-manual-line]')?.remove();
    }
  });
  root.querySelector('[data-finance-manual-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveManual(root, direction, onSaved);
  });
  root.querySelector('[data-finance-manual-save]')?.addEventListener('click', () => {
    root.querySelector('[data-finance-manual-form]')?.requestSubmit();
  });
  return true;
}

import {
  actionBlock,
  button,
  field,
  mountModal,
  modal,
  openNotice,
  pageHeader,
  select,
  textareaField,
} from '../../ui/ui.js';
import { getFinanceArticles, recordManualFinanceOperation } from '../../core/finance/index.js';
import { getWallets } from '../../settings/wallets/data.js';

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
  return \`<div class="array-row" data-finance-manual-line>
    <input type="text" name="lineName" value="\${String(values.name || '').replaceAll('"', '&quot;')}" placeholder="Что купили / что получили">
    <input type="number" min="0" step="0.01" inputmode="decimal" name="lineQuantity" value="\${values.quantity ?? 1}" placeholder="Количество">
    <input type="number" min="0" step="0.01" inputmode="decimal" name="linePrice" value="\${values.unitPrice ?? ''}" placeholder="Цена">
    <button type="button" class="remove-button" data-finance-manual-line-remove aria-label="Удалить строку">×</button>
  </div>\`;
}

function modeMarkup(mode) {
  if (mode === 'detail') {
    return \`<div class="array-group" data-finance-manual-detail>
      <span class="array-label">Позиции</span>
      <div data-finance-manual-lines>\${detailRow()}</div>
      \${button('+ Добавить позицию', { type: 'button', variant: 'secondary', data: 'data-finance-manual-line-add' })}
    </div>\`;
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

function syncMode(modalRoot) {
  const mode = String(modalRoot.querySelector('input[name="entryMode"]')?.value || 'simple');
  const host = modalRoot.querySelector('[data-finance-manual-mode]');
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

async function saveManual(root, modalRoot, direction, navigateBack) {
  const form = modalRoot.querySelector('[data-finance-manual-form]');
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
    lines: mode === 'detail' ? collectLines(modalRoot) : [],
    note: String(data.get('note') || '').trim(),
    occurredAt: String(data.get('occurredAt') || ''),
  };
  try {
    await recordManualFinanceOperation(payload);
    modalRoot.remove();
    renderIncomeExpense(root, navigateBack);
  } catch (error) {
    openNotice({ message: String(error?.message || 'Не удалось сохранить операцию') });
  }
}

function openOperation(root, direction, navigateBack) {
  const isIncome = direction === 'IN';
  const articles = articleOptions(direction);
  const wallets = walletOptions();
  if (!articles.length) {
    openNotice({ message: 'Сначала добавьте конечную статью для этого типа операции.' });
    return;
  }
  if (!wallets.length) {
    openNotice({ message: 'Сначала добавьте кошелёк.' });
    return;
  }
  const html = \`<form class="compact-form" data-finance-manual-form>
    \${select({ label: 'Статья', name: 'articleId', value: articles[0]?.value || '', options: articles, searchable: true })}
    \${select({ label: 'Кошелёк', name: 'walletId', value: wallets[0]?.value || '', options: wallets })}
    \${select({ label: 'Ввод', name: 'entryMode', value: 'simple', options: [{ value: 'simple', label: 'Сумма' }, { value: 'detail', label: 'Детально' }] })}
    \${field({ label: 'Дата и время', name: 'occurredAt', type: 'datetime-local', value: localDateTimeValue(), required: true })}
    <div data-finance-manual-mode>\${modeMarkup('simple')}</div>
    \${textareaField({ label: 'Примечание', name: 'note', rows: 3, placeholder: 'Необязательно' })}
    \${button(isIncome ? 'Записать доход' : 'Записать расход', { type: 'submit' })}
  </form>\`;
  const m = mountModal(root, modal(html, { title: isIncome ? 'Доход' : 'Расход' }));
  if (!m) return;

  m.addEventListener('change', (event) => {
    if (event.target?.matches?.('input[name="entryMode"]')) syncMode(m);
  });
  m.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-finance-manual-line-add]')) {
      m.querySelector('[data-finance-manual-lines]')?.insertAdjacentHTML('beforeend', detailRow());
      return;
    }
    const remove = event.target.closest?.('[data-finance-manual-line-remove]');
    if (remove) {
      const rows = m.querySelectorAll('[data-finance-manual-line]');
      if (rows.length > 1) remove.closest('[data-finance-manual-line]')?.remove();
    }
  });
  m.querySelector('[data-finance-manual-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveManual(root, m, direction, navigateBack);
  });
}

export function renderIncomeExpense(root, navigateBack = () => {}) {
  root.innerHTML = \`\${pageHeader('Доход / Расход')}\${actionBlock(\`\${button('Доход', { data: 'data-finance-manual-income' })}\${button('Расход', { data: 'data-finance-manual-expense' })}\${button('Назад', { variant: 'secondary', data: 'data-finance-manual-back' })}\`)}\`;
  root.querySelector('[data-finance-manual-income]')?.addEventListener('click', () => openOperation(root, 'IN', navigateBack));
  root.querySelector('[data-finance-manual-expense]')?.addEventListener('click', () => openOperation(root, 'OUT', navigateBack));
  root.querySelector('[data-finance-manual-back]')?.addEventListener('click', navigateBack);
}

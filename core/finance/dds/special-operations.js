import {
  field,
  openNotice,
  select,
  textareaField,
  workspaceHeaderContext,
} from '../../../ui/ui.js';
import { getWallets } from '../cash/data.js';
import { correctFinanceOperation, recordSpecialFinanceOperation } from '../service.js';

export const SPECIAL_FINANCE_ACTIONS = [
  { id: 'loan-received', kind: 'loan-received', group: 'loan', label: 'Получить займ', title: 'Получить займ', counterparty: 'От кого' },
  { id: 'loan-repayment', kind: 'loan-repayment', group: 'loan', label: 'Вернуть займ', title: 'Вернуть займ', counterparty: 'Кому' },
  { id: 'investment-received', kind: 'investment-received', group: 'investment', label: 'Получить инвестицию', title: 'Получить инвестицию', counterparty: 'От кого' },
  { id: 'investment-return', kind: 'investment-return', group: 'investment', label: 'Вернуть инвестицию', title: 'Вернуть инвестицию', counterparty: 'Кому' },
  { id: 'transfer', kind: 'transfer', group: 'transfer', label: 'Перевод между кошельками', title: 'Перевод между кошельками', transfer: true },
];

function localDateTimeValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safe = Number.isFinite(date.getTime()) ? date : new Date();
  const shifted = new Date(safe.getTime() - safe.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function walletOptions() {
  return getWallets().map((item) => ({ value: item.id, label: item.name }));
}

function walletName(id) {
  return getWallets().find((item) => item.id === id)?.name || '';
}

export function renderSpecialFinanceOperation(root, actionId, { onSaved = null, operation = null } = {}) {
  const action = SPECIAL_FINANCE_ACTIONS.find((item) => item.id === actionId);
  if (!action) return false;
  const wallets = walletOptions();
  if (!wallets.length) {
    openNotice({ message: 'Сначала добавьте кошелёк.' });
    return false;
  }

  const existing = operation?.data && typeof operation.data === 'object' ? operation.data : {};
  const walletFields = action.transfer
    ? `${select({ label: 'Из кошелька', name: 'fromWalletId', value: existing.fromWalletId || wallets[0]?.value || '', options: wallets })}${select({ label: 'В кошелёк', name: 'toWalletId', value: existing.toWalletId || wallets[1]?.value || wallets[0]?.value || '', options: wallets })}`
    : select({ label: 'Кошелёк', name: 'walletId', value: existing.walletId || wallets[0]?.value || '', options: wallets });

  root.innerHTML = `${workspaceHeaderContext({
    title: operation ? `Корректировка · ${action.title}` : action.title,
    c: {
      label: 'Сохранить',
      data: 'data-finance-special-save',
      aria: `Сохранить операцию ${action.title}`,
    },
  })}
    <form class="compact-form" data-finance-special-form>
      ${walletFields}
      ${field({ label: 'Сумма', name: 'amount', type: 'number', inputmode: 'decimal', value: existing.total || '', required: true, placeholder: '0', data: 'min="0" step="0.01"' })}
      ${!action.transfer ? field({ label: action.counterparty || 'Контрагент', name: 'counterparty', value: existing.counterparty || '', placeholder: 'Необязательно' }) : ''}
      ${field({ label: 'Фактическая дата и время', name: 'occurredAt', type: 'datetime-local', value: localDateTimeValue(operation?.occurredAt || new Date()), required: true })}
      ${textareaField({ label: 'Примечание', name: 'note', value: existing.note || '', rows: 3, placeholder: 'Необязательно' })}
    </form>`;

  root.querySelector('[data-finance-special-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      kind: action.kind,
      amount: Number(data.get('amount') || 0),
      counterparty: String(data.get('counterparty') || '').trim(),
      note: String(data.get('note') || '').trim(),
      occurredAt: data.get('occurredAt') ? new Date(String(data.get('occurredAt'))).toISOString() : '',
    };

    if (!payload.occurredAt) {
      openNotice({ message: 'Укажите фактическую дату и время операции.' });
      return;
    }

    if (action.transfer) {
      payload.fromWalletId = String(data.get('fromWalletId') || '');
      payload.fromWalletName = walletName(payload.fromWalletId);
      payload.toWalletId = String(data.get('toWalletId') || '');
      payload.toWalletName = walletName(payload.toWalletId);
    } else {
      payload.walletId = String(data.get('walletId') || '');
      payload.walletName = walletName(payload.walletId);
    }

    try {
      if (operation?.operationId) await correctFinanceOperation(operation.operationId, payload);
      else await recordSpecialFinanceOperation(payload);
      onSaved?.();
    } catch (error) {
      openNotice({ message: String(error?.message || 'Не удалось сохранить операцию') });
    }
  });

  root.querySelector('[data-finance-special-save]')?.addEventListener('click', () => {
    root.querySelector('[data-finance-special-form]')?.requestSubmit();
  });
  return true;
}

import {
  datePicker,
  field,
  formValidationMessage,
  initDatePickers,
  openNotice,
  select,
  textareaField,
  workspaceHeaderContext,
} from '../../../ui/ui.js';
import { getWallets } from '../cash/data.js';
import { getInvestmentEntities, getLoanEntities } from '../cash/entities.js';
import { financeLocalDateValue, financeOccurredAtForDate } from '../date.js';
import { correctFinanceOperation, recordSpecialFinanceOperation } from '../service.js';

export const SPECIAL_FINANCE_ACTIONS = [
  { id: 'loan-received', kind: 'loan-received', group: 'loan', entityType: 'loan', entityLabel: 'Займ', walletLabel: 'Кошелёк получения', label: 'Получение займа', title: 'Получение займа' },
  { id: 'loan-repayment', kind: 'loan-repayment', group: 'loan', entityType: 'loan', entityLabel: 'Займ', walletLabel: 'Кошелёк списания', label: 'Возврат займа', title: 'Возврат займа' },
  { id: 'investment-received', kind: 'investment-received', group: 'investment', entityType: 'investment', entityLabel: 'Инвестиция', walletLabel: 'Кошелёк получения', label: 'Получение инвестиции', title: 'Получение инвестиции' },
  { id: 'investment-return', kind: 'investment-return', group: 'investment', entityType: 'investment', entityLabel: 'Инвестиция', walletLabel: 'Кошелёк списания', label: 'Возврат инвестиции', title: 'Возврат инвестиции' },
  { id: 'transfer', kind: 'transfer', group: 'transfer', label: 'Перевод между кошельками', title: 'Перевод между кошельками', transfer: true },
];

function walletOptions() {
  return getWallets().map((item) => ({ value: item.id, label: item.name }));
}

function walletName(id) {
  return getWallets().find((item) => item.id === id)?.name || '';
}

function financeEntities(type) {
  return type === 'loan' ? getLoanEntities() : getInvestmentEntities();
}

function financeEntityOptions(type) {
  return financeEntities(type).map((item) => ({ value: item.id, label: item.name }));
}

function financeEntityName(type, id) {
  return financeEntities(type).find((item) => String(item.id) === String(id))?.name || '';
}

export function renderSpecialFinanceOperation(root, actionId, {
  onSaved = null,
  operation = null,
  financeEntity = null,
} = {}) {
  const action = SPECIAL_FINANCE_ACTIONS.find((item) => item.id === actionId);
  if (!action) return false;
  const wallets = walletOptions();
  if (!wallets.length) {
    openNotice({ message: 'Сначала добавьте кошелёк.' });
    return false;
  }

  const existing = operation?.data && typeof operation.data === 'object' ? operation.data : {};
  const lockedEntity = !action.transfer && financeEntity
    && String(financeEntity?.type || '') === String(action.entityType || '')
    && String(financeEntity?.id || '').trim()
    ? {
        type: String(financeEntity.type),
        id: String(financeEntity.id),
        name: String(financeEntity.name || ''),
      }
    : null;
  const entityOptions = action.transfer || lockedEntity ? [] : financeEntityOptions(action.entityType);
  if (!action.transfer && !lockedEntity && !entityOptions.length) {
    openNotice({ message: action.entityType === 'loan' ? 'Сначала добавьте займ.' : 'Сначала добавьте инвестицию.' });
    return false;
  }
  const walletFields = action.transfer
    ? `${select({ label: 'Из кошелька', name: 'fromWalletId', value: existing.fromWalletId || wallets[0]?.value || '', options: wallets })}${select({ label: 'В кошелёк', name: 'toWalletId', value: existing.toWalletId || wallets[1]?.value || wallets[0]?.value || '', options: wallets })}`
    : `${lockedEntity ? '' : select({
        label: action.entityLabel,
        name: 'financeEntityId',
        value: existing.financeEntityId || entityOptions[0]?.value || '',
        options: entityOptions,
      })}${select({
        label: action.walletLabel,
        name: 'walletId',
        value: existing.walletId || wallets[0]?.value || '',
        options: wallets,
      })}`;

  root.innerHTML = `${workspaceHeaderContext({
    title: operation ? `Корректировка · ${action.title}` : action.title,
    c: {
      label: 'Сохранить',
      data: 'data-finance-special-save',
      aria: `Сохранить операцию ${action.title}`,
    },
  })}
    <form class="compact-form" data-finance-special-form novalidate>
      ${walletFields}
      ${field({ label: 'Сумма', name: 'amount', type: 'number', inputmode: 'decimal', value: existing.total || '', required: true, placeholder: '0', data: 'min="0" step="0.01"' })}
      ${datePicker({ label: 'Фактическая дата', name: 'occurredDate', value: financeLocalDateValue(operation?.occurredAt || new Date()), required: true, allowClear: false })}
      ${textareaField({ label: 'Примечание', name: 'note', value: existing.note || '', rows: 3, placeholder: 'Необязательно' })}
    </form>`;

  initDatePickers(root);

  root.querySelector('[data-finance-special-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const validation = formValidationMessage(form);
    if (validation) {
      openNotice({ message: validation });
      return;
    }
    const data = new FormData(form);
    const payload = {
      kind: action.kind,
      amount: Number(data.get('amount') || 0),
      note: String(data.get('note') || '').trim(),
      occurredAt: financeOccurredAtForDate(
        String(data.get('occurredDate') || ''),
        operation?.occurredAt || new Date(),
      ),
    };

    if (!payload.occurredAt) {
      openNotice({ message: 'Укажите фактическую дату операции.' });
      return;
    }

    if (action.transfer) {
      payload.fromWalletId = String(data.get('fromWalletId') || '');
      payload.fromWalletName = walletName(payload.fromWalletId);
      payload.toWalletId = String(data.get('toWalletId') || '');
      payload.toWalletName = walletName(payload.toWalletId);
    } else {
      payload.financeEntityType = action.entityType;
      payload.financeEntityId = lockedEntity?.id || String(data.get('financeEntityId') || '');
      payload.financeEntityName = lockedEntity?.name || financeEntityName(action.entityType, payload.financeEntityId);
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

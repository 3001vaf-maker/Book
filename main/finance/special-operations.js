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
import { recordSpecialFinanceOperation } from '../../core/finance/index.js';
import { getWallets } from '../../settings/wallets/data.js';

const ACTIONS = [
  { kind: 'loan-received', label: 'Получить займ', title: 'Получить займ', counterparty: 'От кого' },
  { kind: 'loan-repayment', label: 'Вернуть займ', title: 'Вернуть займ', counterparty: 'Кому' },
  { kind: 'investment-received', label: 'Получить инвестицию', title: 'Получить инвестицию', counterparty: 'От кого' },
  { kind: 'investment-return', label: 'Вернуть инвестицию', title: 'Вернуть инвестицию', counterparty: 'Кому' },
  { kind: 'transfer', label: 'Перевод между кошельками', title: 'Перевод между кошельками', transfer: true },
];

function localDateTimeValue(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function walletOptions() {
  return getWallets().map((item) => ({ value: item.id, label: item.name }));
}

function walletName(id) {
  return getWallets().find((item) => item.id === id)?.name || '';
}

function openAction(root, action, navigateBack) {
  const wallets = walletOptions();
  if (!wallets.length) {
    openNotice({ message: 'Сначала добавьте кошелёк.' });
    return;
  }

  const walletFields = action.transfer
    ? `${select({ label: 'Из кошелька', name: 'fromWalletId', value: wallets[0]?.value || '', options: wallets })}${select({ label: 'В кошелёк', name: 'toWalletId', value: wallets[1]?.value || wallets[0]?.value || '', options: wallets })}`
    : select({ label: 'Кошелёк', name: 'walletId', value: wallets[0]?.value || '', options: wallets });

  const html = `<form class="compact-form" data-finance-special-form>
    ${walletFields}
    ${field({ label: 'Сумма', name: 'amount', type: 'number', inputmode: 'decimal', required: true, placeholder: '0', data: 'min="0" step="0.01"' })}
    ${!action.transfer ? field({ label: action.counterparty || 'Контрагент', name: 'counterparty', placeholder: 'Необязательно' }) : ''}
    ${field({ label: 'Фактическая дата и время', name: 'occurredAt', type: 'datetime-local', value: localDateTimeValue(), required: true })}
    ${textareaField({ label: 'Примечание', name: 'note', rows: 3, placeholder: 'Необязательно' })}
    ${button('Сохранить', { type: 'submit' })}
  </form>`;

  const m = mountModal(root, modal(html, { title: action.title }));
  if (!m) return;

  m.querySelector('[data-finance-special-form]')?.addEventListener('submit', async (event) => {
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
      await recordSpecialFinanceOperation(payload);
      m.remove();
      renderSpecialFinanceOperations(root, navigateBack);
    } catch (error) {
      openNotice({ message: String(error?.message || 'Не удалось сохранить операцию') });
    }
  });
}

export function renderSpecialFinanceOperations(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Прочие операции')}${actionBlock(`${ACTIONS.map((action) => button(action.label, { data: `data-finance-special="${action.kind}"` })).join('')}${button('Назад', { variant: 'secondary', data: 'data-finance-special-back' })}`)}`;
  root.querySelectorAll('[data-finance-special]').forEach((element) => {
    element.addEventListener('click', () => {
      const action = ACTIONS.find((item) => item.kind === element.dataset.financeSpecial);
      if (action) openAction(root, action, navigateBack);
    });
  });
  root.querySelector('[data-finance-special-back]')?.addEventListener('click', navigateBack);
}

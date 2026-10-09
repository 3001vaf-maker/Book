import {
  details,
  emptyState,
  entityCardStack,
  miniCard,
  miniCardRail,
  mountV2ZLayer,
  page,
  shortDateTime,
  v2Section,
  v2ZLayer,
} from '../../../ui/ui.js';
import {
  availablePeople,
  bindViewSettings,
  loyaltyCardFields,
  loyaltyHeader,
  loyaltyVisualCard,
  money,
  notifyLoyaltyContext,
  personLabel,
} from '../shared.js';
import {
  loadPersonalAccount,
  loadPersonalAccounts,
} from './data.js';

function personKey(person = {}) {
  return String(person?.key || person?.id || '').trim();
}

function accountPerson(account = {}, people = []) {
  const keys = new Set([
    String(account?.personKey || ''),
    ...(Array.isArray(account?.memberKeys) ? account.memberKeys.map((value) => String(value || '')) : []),
  ].filter(Boolean));
  return people.find((person) => keys.has(personKey(person))) || { key: String(account?.personKey || ''), name: 'Без имени' };
}

function movementTitle(item = {}) {
  const kind = String(item?.kind || '');
  if (kind === 'funding') return 'Пополнение';
  if (kind === 'withdrawal') return 'Возврат денег';
  if (kind === 'payment') return 'Оплата';
  if (kind === 'refund') return 'Возврат оплаты';
  return String(item?.direction || '').toUpperCase() === 'IN' ? 'Пополнение' : 'Списание';
}

function movementSource(item = {}) {
  const data = item?.data && typeof item.data === 'object' ? item.data : {};
  if (data?.note) return String(data.note);
  if (data?.reason) return String(data.reason);
  if (item?.sourceType === 'record') return 'Запись';
  if (item?.sourceType === 'sale') return 'Продажа';
  if (item?.sourceType === 'order') return 'Заказ';
  return 'Операция';
}

export function personalAccountCardFields({ person = null, title = '', balance = 0, debt = 0 } = {}) {
  const resolvedBalance = Math.max(0, Number(balance) || 0);
  const resolvedDebt = Math.max(0, Number(debt) || 0);
  return loyaltyCardFields({
    title: title || personLabel(person || {}),
    subtitle: 'Личный счёт',
    status: resolvedDebt > 0.009 ? 'Есть задолженность' : resolvedBalance > 0.009 ? 'Есть остаток' : 'Нулевой остаток',
    metaLeft: resolvedDebt > 0.009 ? 'Задолженность' : 'Денежный остаток',
    metaRight: money(resolvedDebt > 0.009 ? resolvedDebt : resolvedBalance),
  });
}

export function personalAccountVisualCard({
  person = null,
  title = '',
  balance = 0,
  debt = 0,
  data = '',
  aria = '',
  interactive = true,
} = {}) {
  return loyaltyVisualCard('personal-account', personalAccountCardFields({ person, title, balance, debt }), {
    data,
    aria,
    interactive,
  });
}

function historyRail(account = {}) {
  const items = Array.isArray(account?.movements) ? account.movements : [];
  if (!items.length) return emptyState('Истории пока нет', 'Движения появятся после использования Личного счёта.');
  return miniCardRail(items.map((item) => {
    const incoming = String(item?.direction || '').toUpperCase() === 'IN';
    return miniCard({
      title: movementTitle(item),
      value: `${incoming ? '+' : '−'}${money(item?.amount)}`,
      subtitle: shortDateTime(item?.occurredAt, '—'),
      rows: [
        { label: 'Источник', value: movementSource(item) },
        { label: 'Остаток', value: money(item?.balanceAfter) },
      ],
    });
  }));
}

function debtRail(account = {}) {
  const items = Array.isArray(account?.debts) ? account.debts : [];
  if (!items.length) return emptyState('Задолженностей нет', 'Неоплаченные остатки появятся здесь отдельно от денег Личного счёта.');
  return miniCardRail(items.map((item) => miniCard({
    title: Number(item?.outstandingAmount || 0) > 0.009 ? 'Задолженность' : 'Погашено',
    value: money(item?.outstandingAmount),
    subtitle: shortDateTime(item?.occurredAt, '—'),
    rows: [
      { label: 'Начальная сумма', value: money(item?.originalAmount) },
      { label: 'Состояние', value: Number(item?.outstandingAmount || 0) > 0.009 ? 'Открыта' : 'Закрыта' },
    ],
  })));
}

function accountInfo(person = {}, account = {}) {
  return details([
    { label: 'Контакт', value: personLabel(person) },
    { label: 'Денежный остаток', value: money(account?.balance) },
    { label: 'Задолженность', value: money(account?.debtTotal) },
    { label: 'Можно оплатить со счёта', value: `${Math.max(0, Math.min(100, Number(account?.spendLimitPercent ?? 100) || 0))}%` },
    { label: 'Виден конечному пользователю', value: account?.visibleToEndUser === false ? 'Нет' : 'Да' },
  ]);
}

export async function openPersonalAccountForPerson(root, person = {}, snapshot = null) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-personal-account-z' }), { stack: true });
  if (!layer) return null;
  const key = personKey(person);
  const account = snapshot || await loadPersonalAccount(key);
  layer.innerHTML = page([
    loyaltyHeader(personLabel(person)),
    accountInfo(person, account || {}),
    v2Section('Задолженности', debtRail(account || {})),
    v2Section('История', historyRail(account || {})),
  ]);
  notifyLoyaltyContext();
  return layer;
}

export async function renderPersonalAccount(root) {
  const people = availablePeople([]);
  let accounts = [];
  try {
    accounts = await loadPersonalAccounts();
  } catch (error) {
    root.innerHTML = page([
      loyaltyHeader('Личный счёт', { settings: true }),
      emptyState('Не удалось загрузить Личные счета', String(error?.message || 'Повторите попытку.')),
    ]);
    notifyLoyaltyContext();
    return;
  }

  const values = accounts
    .filter((account) => Number(account?.balance || 0) > 0.009 || Number(account?.debtTotal || 0) > 0.009)
    .map((account) => ({ account, person: accountPerson(account, people) }));
  const cards = values.length
    ? entityCardStack(values.map(({ account, person }) => personalAccountVisualCard({
        person,
        balance: account.balance,
        debt: account.debtTotal,
        data: `data-personal-account-person="${personKey(person)}"`,
        aria: `Открыть Личный счёт ${personLabel(person)}`,
      })))
    : emptyState('Активных Личных счетов пока нет', 'Здесь появятся контакты с денежным остатком или задолженностью.');

  root.innerHTML = page([
    loyaltyHeader('Личный счёт', { settings: true }),
    cards,
  ]);

  bindViewSettings(root, 'Личный счёт', {
    type: 'personal-account',
    fields: () => {
      const first = values[0];
      return personalAccountCardFields({
        person: first?.person || people[0] || {},
        balance: first?.account?.balance || 0,
        debt: first?.account?.debtTotal || 0,
      });
    },
    onSaved: () => renderPersonalAccount(root),
  });
  root.querySelectorAll('[data-personal-account-person]').forEach((node) => {
    node.addEventListener('click', () => {
      const item = values.find(({ person }) => personKey(person) === String(node.dataset.personalAccountPerson || ''));
      if (item) openPersonalAccountForPerson(root, item.person, item.account);
    });
  });
  notifyLoyaltyContext();
}

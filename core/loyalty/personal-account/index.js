import {
  emptyState,
  entityCardStack,
  mountV2ZLayer,
  page,
  shortDateTime,
  v2ListEntries,
  v2ListEntry,
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
  mockPerson,
  notifyLoyaltyContext,
  personLabel,
} from '../shared.js';

const fallbackPeople = [
  mockPerson('Иван Петров', 'mock-person-1'),
  mockPerson('Анна Иванова', 'mock-person-2'),
];

const mockBalances = new Map([
  ['mock-person-1', 5000],
  ['mock-person-2', 0],
]);

const mockHistory = new Map([
  ['mock-person-1', [
    { id: 'pa-1', amount: 5000, direction: 'in', source: 'Оставлено для будущего расчёта', occurredAt: '2026-10-01T12:00:00.000Z', recordedAt: '2026-10-01T12:03:00.000Z', balanceAfter: 5000 },
  ]],
]);

function personKey(person = {}) {
  return String(person?.key || person?.id || '');
}

function balanceFor(person = {}) {
  const key = personKey(person);
  return mockBalances.has(key) ? Number(mockBalances.get(key) || 0) : 0;
}

function historyFor(person = {}) {
  return mockHistory.get(personKey(person)) || [];
}

function accountCardFields(person = {}) {
  const balance = balanceFor(person);
  return loyaltyCardFields({
    title: personLabel(person),
    subtitle: 'Личный счёт',
    status: balance > 0 ? 'Есть остаток' : 'Нулевой остаток',
    metaLeft: 'Денежный остаток',
    metaRight: money(balance),
  });
}

function historyRows(person = {}) {
  const items = historyFor(person);
  if (!items.length) return emptyState('Движений пока нет', 'Личный счёт существует и при нулевом денежном остатке.');
  return v2ListEntries([...items].reverse().map((item) => v2ListEntry({
    title: item.direction === 'in' ? 'Деньги оставлены на счёте' : 'Использовано при расчёте',
    subtitle: `${item.source} · ${shortDateTime(item.occurredAt, '—')}`,
    rightTop: `${item.direction === 'in' ? '+' : '−'}${money(item.amount)}`,
    rightBottom: `Остаток ${money(item.balanceAfter)}`,
    interactive: false,
    initial: '',
  })));
}

function accountInfo(person = {}) {
  return v2ListEntries([
    v2ListEntry({ title: 'Владелец', subtitle: personLabel(person), interactive: false, initial: '' }),
    v2ListEntry({ title: 'Денежный остаток', subtitle: money(balanceFor(person)), interactive: false, initial: '' }),
    v2ListEntry({ title: 'Состояние', subtitle: balanceFor(person) > 0 ? 'Есть деньги человека' : 'Нулевой остаток', interactive: false, initial: '' }),
  ]);
}

async function openAccountLayer(root, person = {}) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-personal-account-z' }), { stack: true });
  if (!layer) return null;
  layer.innerHTML = page([
    loyaltyHeader(personLabel(person)),
    v2Section('Личный счёт', accountInfo(person)),
    v2Section('История', historyRows(person)),
  ]);
  notifyLoyaltyContext();
  return layer;
}

export async function renderPersonalAccount(root) {
  const values = availablePeople(fallbackPeople);
  const cards = values.length
    ? entityCardStack(values.map((person) => loyaltyVisualCard('personal-account', accountCardFields(person), {
        data: `data-personal-account-person="${personKey(person)}"`,
        aria: `Открыть личный счёт ${personLabel(person)}`,
      })))
    : emptyState('Контактов пока нет', 'Личный счёт появляется автоматически вместе с отношением профессионал ↔ человек.');

  root.innerHTML = page([
    loyaltyHeader('Личный счёт', { settings: true }),
    cards,
  ]);

  bindViewSettings(root, 'Личный счёт', {
    type: 'personal-account',
    fields: () => accountCardFields(values[0] || fallbackPeople[0]),
    onSaved: () => renderPersonalAccount(root),
  });
  root.querySelectorAll('[data-personal-account-person]').forEach((node) => {
    node.addEventListener('click', () => {
      const person = values.find((item) => personKey(item) === String(node.dataset.personalAccountPerson || ''));
      if (person) openAccountLayer(root, person);
    });
  });
  notifyLoyaltyContext();
}

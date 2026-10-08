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
    status: 'Есть остаток',
    metaLeft: 'Денежный остаток',
    metaRight: money(balance),
  });
}

function historyRail(person = {}) {
  const items = historyFor(person);
  if (!items.length) return emptyState('Истории пока нет', 'Движения появятся после использования личного счёта.');
  return miniCardRail([...items].reverse().map((item) => miniCard({
    title: item.direction === 'in' ? 'Пополнение' : 'Использование',
    value: `${item.direction === 'in' ? '+' : '−'}${money(item.amount)}`,
    subtitle: shortDateTime(item.occurredAt, '—'),
    rows: [
      { label: 'Источник', value: item.source || '—' },
      { label: 'Остаток', value: money(item.balanceAfter) },
    ],
  })));
}

function accountInfo(person = {}) {
  return details([
    { label: 'Контакт', value: personLabel(person) },
    { label: 'Денежный остаток', value: money(balanceFor(person)) },
    { label: 'Состояние', value: 'Есть деньги контакта' },
  ]);
}

async function openAccountLayer(root, person = {}) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-personal-account-z' }), { stack: true });
  if (!layer) return null;
  layer.innerHTML = page([
    loyaltyHeader(personLabel(person)),
    accountInfo(person),
    v2Section('История', historyRail(person)),
  ]);
  notifyLoyaltyContext();
  return layer;
}

export async function renderPersonalAccount(root) {
  const allContacts = availablePeople(fallbackPeople);
  const values = allContacts.filter((person) => balanceFor(person) > 0.009);
  const cards = values.length
    ? entityCardStack(values.map((person) => loyaltyVisualCard('personal-account', accountCardFields(person), {
        data: `data-personal-account-person="${personKey(person)}"`,
        aria: `Открыть личный счёт ${personLabel(person)}`,
      })))
    : emptyState('Ненулевых остатков пока нет', 'Здесь появятся только контакты, у которых есть деньги на личном счёте.');

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

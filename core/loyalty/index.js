import {
  emptyState,
  entityCardStack,
  openNotice,
  page,
} from '../../ui/ui.js';
import { renderDeposit } from './deposit/index.js';
import { renderPersonalAccount } from './personal-account/index.js';
import { renderCertificate } from './certificate/index.js';
import { renderSubscription } from './subscription/index.js';
import { renderReferral } from './referral/index.js';
import {
  bindViewSettings,
  loyaltyCardFields,
  loyaltyHeader,
  loyaltyVisualCard,
} from './shared.js';

const LOYALTY_NAVIGATION = [
  { id: 'deposit', label: 'Депозит' },
  { id: 'personal-account', label: 'Личный счёт' },
  { id: 'certificate', label: 'Сертификат' },
  { id: 'subscription', label: 'Абонемент' },
  { id: 'referral', label: 'Реферальная программа' },
  { id: 'bonus', label: 'Бонусная программа' },
];

function bonusCards(items = []) {
  return entityCardStack(items.map((item) => loyaltyVisualCard('bonus', loyaltyCardFields({
    uei: item.uei || '',
    title: item.title || '',
    subtitle: item.subtitle || '',
    status: item.status || '',
    metaLeft: item.metaLeft || '',
    metaRight: item.metaRight || '',
  }), { interactive: false })));
}

function renderBonus(root) {
  const items = [
    { title: '5% с оплаты', subtitle: 'Бонусная программа', status: 'Активна', metaLeft: 'Всем контактам', metaRight: '5%' },
    { title: 'VIP 10%', subtitle: 'Бонусная программа', status: 'Активна', metaLeft: 'Выбранным контактам', metaRight: '10%' },
  ];
  root.innerHTML = page([
    loyaltyHeader('Бонусная программа', { settings: true, c: { label: '+', data: 'data-bonus-stage-action', aria: 'Создать бонусную программу' } }),
    bonusCards(items),
  ]);
  bindViewSettings(root, 'Бонусная программа', {
    type: 'bonus',
    fields: () => loyaltyCardFields(items[0]),
    onSaved: () => renderBonus(root),
  });
  root.querySelector('[data-bonus-stage-action]')?.addEventListener('click', () => {
    openNotice({
      title: 'Бонусная программа',
      message: 'Визуальный контур карты готов. Q-конструктор Бонусной программы подключается отдельным шагом.',
      surface: 'app',
    });
  });
}

export function loyaltyNavigationItems() {
  return LOYALTY_NAVIGATION.map((item) => ({ ...item }));
}

export async function renderLoyaltySection(root, section = 'deposit') {
  if (section === 'deposit') return renderDeposit(root);
  if (section === 'personal-account') return renderPersonalAccount(root);
  if (section === 'certificate') return renderCertificate(root);
  if (section === 'subscription') return renderSubscription(root);
  if (section === 'referral') return renderReferral(root);
  if (section === 'bonus') return renderBonus(root);
  root.innerHTML = page([
    loyaltyHeader('Лояльность'),
    emptyState('Раздел не найден', 'Выберите инструмент Лояльности в меню.'),
  ]);
}

export { renderLoyaltySection as render };

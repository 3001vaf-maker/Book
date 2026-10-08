import {
  emptyState,
  entityCardStack,
  openNotice,
  page,
} from '../../ui/ui.js';
import { renderDeposit } from './deposit/index.js';
import { renderPersonalAccount } from './personal-account/index.js';
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

function previewCards(type, items = []) {
  return entityCardStack(items.map((item) => loyaltyVisualCard(type, loyaltyCardFields({
    uei: item.uei || '',
    title: item.title || '',
    subtitle: item.subtitle || '',
    status: item.status || '',
    metaLeft: item.metaLeft || '',
    metaRight: item.metaRight || '',
  }), { interactive: false })));
}

function bindStageActions(root, title) {
  root.querySelector('[data-loyalty-stage-action]')?.addEventListener('click', () => {
    openNotice({
      title,
      message: 'Это только визуальный mock. Q-конструктор этого раздела ещё не подключён.',
      surface: 'app',
    });
  });
}

function renderCertificate(root) {
  const items = [
    { title: 'Подарочный 10 000', subtitle: 'Сертификат', status: 'Активен', metaLeft: 'Денежный', metaRight: '10 000 ₽' },
    { title: 'Уход 5 000', subtitle: 'Сертификат', status: 'Активен', metaLeft: 'Денежный', metaRight: '5 000 ₽' },
  ];
  root.innerHTML = page([
    loyaltyHeader('Сертификат', { settings: true, c: { label: '+', data: 'data-loyalty-stage-action', aria: 'Создать сертификат' } }),
    previewCards('certificate', items),
  ]);
  bindViewSettings(root, 'Сертификат', {
    type: 'certificate',
    fields: () => loyaltyCardFields(items[0]),
    onSaved: () => renderCertificate(root),
  });
  bindStageActions(root, 'Сертификат');
}

function renderSubscription(root) {
  const items = [
    { title: 'Стрижка × 10', subtitle: 'Абонемент', status: 'Активен', metaLeft: '10 посещений', metaRight: 'Осталось 10' },
    { title: 'Уход × 5', subtitle: 'Абонемент', status: 'Активен', metaLeft: '5 посещений', metaRight: 'Осталось 5' },
  ];
  root.innerHTML = page([
    loyaltyHeader('Абонемент', { settings: true, c: { label: '+', data: 'data-loyalty-stage-action', aria: 'Создать абонемент' } }),
    previewCards('subscription', items),
  ]);
  bindViewSettings(root, 'Абонемент', {
    type: 'subscription',
    fields: () => loyaltyCardFields(items[0]),
    onSaved: () => renderSubscription(root),
  });
  bindStageActions(root, 'Абонемент');
}

function renderReferral(root) {
  const items = [
    { title: 'Приведи друга', subtitle: 'Реферальная программа', status: 'Активна', metaLeft: 'Всем контактам', metaRight: '1 уровень' },
    { title: 'VIP рекомендации', subtitle: 'Реферальная программа', status: 'Активна', metaLeft: 'Выбранным контактам', metaRight: '2 уровня' },
  ];
  root.innerHTML = page([
    loyaltyHeader('Реферальная программа', { settings: true, c: { label: '+', data: 'data-loyalty-stage-action', aria: 'Создать реферальную программу' } }),
    previewCards('referral', items),
  ]);
  bindViewSettings(root, 'Реферальная программа', {
    type: 'referral',
    fields: () => loyaltyCardFields(items[0]),
    onSaved: () => renderReferral(root),
  });
  bindStageActions(root, 'Реферальная программа');
}

function renderBonus(root) {
  const items = [
    { title: '5% с оплаты', subtitle: 'Бонусная программа', status: 'Активна', metaLeft: 'Всем контактам', metaRight: '5%' },
    { title: 'VIP 10%', subtitle: 'Бонусная программа', status: 'Активна', metaLeft: 'Выбранным контактам', metaRight: '10%' },
  ];
  root.innerHTML = page([
    loyaltyHeader('Бонусная программа', { settings: true, c: { label: '+', data: 'data-loyalty-stage-action', aria: 'Создать бонусную программу' } }),
    previewCards('bonus', items),
  ]);
  bindViewSettings(root, 'Бонусная программа', {
    type: 'bonus',
    fields: () => loyaltyCardFields(items[0]),
    onSaved: () => renderBonus(root),
  });
  bindStageActions(root, 'Бонусная программа');
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

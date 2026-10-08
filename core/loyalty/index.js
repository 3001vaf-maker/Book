import { emptyState, page } from '../../ui/ui.js';
import { renderDeposit } from './deposit/index.js';
import { renderPersonalAccount } from './personal-account/index.js';
import { renderCertificate } from './certificate/index.js';
import { renderSubscription } from './subscription/index.js';
import { renderReferral } from './referral/index.js';
import { renderBonus } from './bonus/index.js';
import { loyaltyHeader } from './shared.js';

const LOYALTY_NAVIGATION = [
  { id: 'deposit', label: 'Депозит' },
  { id: 'personal-account', label: 'Личный счёт' },
  { id: 'certificate', label: 'Сертификат' },
  { id: 'subscription', label: 'Абонемент' },
  { id: 'referral', label: 'Реферальная программа' },
  { id: 'bonus', label: 'Бонусная программа' },
];

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

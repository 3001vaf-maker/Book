import {
  emptyState,
  modal,
  mountModal,
  workspaceHeaderContext,
} from '../../ui/ui.js';
import { canUseBookCapability } from '../access.js';

const LOYALTY_NAVIGATION = [
  { id: 'deposit', label: 'Депозит', capability: 'loyalty.deposit.access' },
  { id: 'personal-account', label: 'Личный счёт', capability: 'loyalty.personal_account.access' },
  { id: 'certificate', label: 'Сертификат', capability: 'loyalty.certificate.access' },
  { id: 'subscription', label: 'Абонемент', capability: 'loyalty.subscription.access' },
  { id: 'referral', label: 'Реферальная программа', capability: 'loyalty.referral.access' },
  { id: 'bonus', label: 'Бонусная программа', capability: 'loyalty.bonus.access' },
];

function notifyContext() {
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function openSectionSettings(section) {
  mountModal(document.body, modal(
    emptyState('В разработке', `Настройки: ${section.label}`),
    { variant: 'x', title: section.label },
  ));
}

export function loyaltyNavigationItems() {
  return LOYALTY_NAVIGATION
    .filter((item) => canUseBookCapability(item.capability))
    .map(({ id, label }) => ({ id, label }));
}

export function renderLoyaltySection(root, sectionId = 'deposit') {
  const allowed = LOYALTY_NAVIGATION.filter((item) => canUseBookCapability(item.capability));
  const section = allowed.find((item) => item.id === sectionId) || allowed[0] || LOYALTY_NAVIGATION[0];

  root.innerHTML = `
    ${workspaceHeaderContext({
      title: section.label,
      a: {
        kind: 'settings',
        data: 'data-loyalty-settings',
        aria: `Настройки: ${section.label}`,
      },
    })}
    ${emptyState('В разработке')}`;

  root.querySelector('[data-loyalty-settings]')?.addEventListener('click', () => openSectionSettings(section));
  notifyContext();
  return () => {};
}

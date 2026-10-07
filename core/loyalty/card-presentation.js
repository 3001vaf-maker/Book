import { getCardAppearanceTemplate } from '../card-appearance-templates.js';

const SCOPE_BY_KIND = Object.freeze({
  deposit: 'loyalty-deposit',
  'personal-account': 'loyalty-personal-account',
  certificate: 'loyalty-certificate',
  subscription: 'loyalty-subscription',
  referral: 'loyalty-referral',
  bonus: 'loyalty-bonus',
});

const LABEL_BY_KIND = Object.freeze({
  deposit: 'Депозит',
  'personal-account': 'Личный счёт',
  certificate: 'Сертификат',
  subscription: 'Абонемент',
  referral: 'Реферальная программа',
  bonus: 'Бонусная программа',
});

function defaultAppearance() {
  const lines = Array.from({ length: 9 }, () => ({}));
  lines[0] = { field: 'status', zone: 'right', align: 'right', size: 'm', color: 'white' };
  lines[5] = { field: 'title', zone: 'full', align: 'left', size: 'xl', color: 'white', bold: true };
  lines[6] = { field: 'subtitle', zone: 'full', align: 'left', size: 'm', color: 'white' };
  lines[7] = { field: 'metaLeft', zone: 'left', align: 'left', size: 'm', color: 'white' };
  lines[8] = { field: 'metaRight', zone: 'right', align: 'right', size: 'm', color: 'white' };
  return { lines };
}

export function loyaltyCardScope(kind) {
  return SCOPE_BY_KIND[String(kind || '')] || 'loyalty-bonus';
}

export function loyaltyKindLabel(kind) {
  return LABEL_BY_KIND[String(kind || '')] || 'Лояльность';
}

export function loyaltyCardAppearance(kind) {
  return getCardAppearanceTemplate(loyaltyCardScope(kind))?.appearance || defaultAppearance();
}

export function loyaltyCardPhoto(kind) {
  return getCardAppearanceTemplate(loyaltyCardScope(kind))?.photo || '';
}

export function loyaltyCardPhotoPosition(kind) {
  return getCardAppearanceTemplate(loyaltyCardScope(kind))?.photoPosition || '50% 50%';
}

export function loyaltyCardFields({ kind = '', title = '', subtitle = '', status = '', metaLeft = '', metaRight = '' } = {}) {
  return [
    { value: 'title', label: 'Название', text: String(title || loyaltyKindLabel(kind)) },
    { value: 'subtitle', label: 'Подпись', text: String(subtitle || loyaltyKindLabel(kind)) },
    { value: 'status', label: 'Статус', text: String(status || '') },
    { value: 'metaLeft', label: 'Данные слева', text: String(metaLeft || '') },
    { value: 'metaRight', label: 'Данные справа', text: String(metaRight || '') },
  ];
}

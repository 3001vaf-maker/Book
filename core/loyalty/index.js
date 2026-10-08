import {
  emptyState,
  page,
  v2ListEntries,
  v2ListEntry,
  workspaceHeaderContext,
  openNotice,
} from '../../ui/ui.js';
import { getProfile } from '../profile/data.js';
import { renderDeposit } from './deposit/index.js';
import { renderPersonalAccount } from './personal-account/index.js';

const LOYALTY_NAVIGATION = [
  { id: 'deposit', label: 'Депозит' },
  { id: 'personal-account', label: 'Личный счёт' },
  { id: 'certificate', label: 'Сертификат' },
  { id: 'subscription', label: 'Абонемент' },
  { id: 'referral', label: 'Реферальная программа' },
  { id: 'bonus', label: 'Бонусная программа' },
];

function profileASlot({ settings = false, data = '', aria = 'Настройки' } = {}) {
  const profile = getProfile();
  const name = [profile?.name, profile?.surname].filter(Boolean).join(' ').trim() || 'Профиль';
  const crop = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Math.round(Number(value)))) : 50;
  return {
    kind: 'avatar',
    image: String(profile?.photo || ''),
    imagePosition: `${crop(profile?.photoCropX)}% ${crop(profile?.photoCropY)}%`,
    initials: name.slice(0, 1).toUpperCase() || '?',
    settingsTag: settings,
    data,
    aria,
    disabled: !settings,
  };
}

function header(title, { settings = false, c = null } = {}) {
  return workspaceHeaderContext({
    title,
    a: profileASlot({ settings, data: settings ? 'data-loyalty-settings' : '', aria: `Настройки ${title}` }),
    c,
  });
}

function previewRows(rows) {
  return v2ListEntries(rows.map(({ title, subtitle, rightTop = '' }) => v2ListEntry({
    title,
    subtitle,
    rightTop,
    interactive: false,
    initial: '',
  })));
}

function bindStageActions(root, title) {
  root.querySelector('[data-loyalty-stage-action]')?.addEventListener('click', () => {
    openNotice({
      title,
      message: 'Интерфейс готов. Бизнес-логика подключается следующим слоем.',
      surface: 'app',
    });
  });
}

function renderCertificate(root) {
  root.innerHTML = page([
    header('Сертификат', { settings: true, c: { label: '+', data: 'data-loyalty-stage-action', aria: 'Создать сертификат' } }),
    previewRows([
      { title: 'Подарочный 10 000', subtitle: 'Активен', rightTop: '10 000 ₽' },
      { title: 'Уход 5 000', subtitle: 'Активен', rightTop: '5 000 ₽' },
    ]),
  ]);
  bindStageActions(root, 'Сертификат');
}

function renderSubscription(root) {
  root.innerHTML = page([
    header('Абонемент', { settings: true, c: { label: '+', data: 'data-loyalty-stage-action', aria: 'Создать абонемент' } }),
    previewRows([
      { title: 'Стрижка × 10', subtitle: '10 посещений', rightTop: 'Активен' },
      { title: 'Уход × 5', subtitle: '5 посещений', rightTop: 'Активен' },
    ]),
  ]);
  bindStageActions(root, 'Абонемент');
}

function renderReferral(root) {
  root.innerHTML = page([
    header('Реферальная программа', { settings: true, c: { label: '+', data: 'data-loyalty-stage-action', aria: 'Создать реферальную программу' } }),
    previewRows([
      { title: 'Приведи друга', subtitle: 'Всем контактам', rightTop: 'Активна' },
      { title: 'VIP рекомендации', subtitle: 'Выбранным контактам', rightTop: 'Активна' },
    ]),
  ]);
  bindStageActions(root, 'Реферальная программа');
}

function renderBonus(root) {
  root.innerHTML = page([
    header('Бонусная программа', { settings: true, c: { label: '+', data: 'data-loyalty-stage-action', aria: 'Создать бонусную программу' } }),
    previewRows([
      { title: '5% с оплаты', subtitle: 'Всем контактам', rightTop: 'Активна' },
      { title: 'VIP 10%', subtitle: 'Выбранным контактам', rightTop: 'Активна' },
    ]),
  ]);
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
    header('Лояльность'),
    emptyState('Раздел не найден', 'Выберите инструмент Лояльности в меню.'),
  ]);
}

export { renderLoyaltySection as render };

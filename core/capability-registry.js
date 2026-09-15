const CAPABILITIES = [
  { key: 'profile.access', title: 'Профиль', description: 'Данные мастера и основная информация Book.', placement: 'settings', owner: 'settings/settings.js' },
  { key: 'services.access', title: 'Услуги', description: 'Настройка услуг и процедур мастера.', placement: 'settings', owner: 'settings/settings.js' },
  { key: 'clients.access', title: 'Клиенты', description: 'Клиентская база и работа с карточками клиентов.', placement: 'main', owner: 'main/main.js' },
  { key: 'workplaces.max', title: 'Рабочие пространства', description: 'Количество доступных рабочих пространств.', placement: 'limit', owner: 'server/src/profile/workplace-limit.guard.ts' },
  { key: 'timetable.access', title: 'График', description: 'Настройка рабочих дней и рабочего времени.', placement: 'navigation', section: 'timetable', owner: 'core.js' },
  { key: 'journal.access', title: 'Журнал', description: 'Записи, рабочий день и история работы.', placement: 'navigation', section: 'journal', owner: 'core.js' },
  { key: 'online_booking.access', title: 'Онлайн-запись', description: 'Клиенты смогут записываться к мастеру онлайн.', placement: 'settings', owner: 'settings/settings.js' },
  { key: 'payments.access', title: 'Оплаты', description: 'Оплата и расчёты внутри записей и процедур.', placement: 'embedded', owner: 'journal/record-payment.js' },
  { key: 'finance.access', title: 'Финансы', description: 'Доходы, расходы и финансовая картина работы.', placement: 'main', owner: 'main/main.js' },
  { key: 'chat.access', title: 'Чат', description: 'Рабочий чат и коммуникация.', placement: 'navigation', section: 'chat', owner: 'core.js' },
  { key: 'notifications.access', title: 'Уведомления', description: 'Настройки уведомлений и сообщений.', placement: 'settings', owner: 'settings/settings.js' },
  { key: 'integrations.access', title: 'Интеграции', description: 'Подключение внешних сервисов Book.', placement: 'settings', owner: 'settings/settings.js' },
  { key: 'documents.access', title: 'Документы', description: 'Документы, согласия и история документов.', placement: 'settings', owner: 'settings/settings.js' },
  { key: 'tags.access', title: 'Ярлыки', description: 'Ярлыки и дополнительные признаки для работы.', placement: 'settings', owner: 'settings/settings.js' },
];

export const BOOK_CAPABILITIES = Object.freeze(Object.fromEntries(CAPABILITIES.map((item) => [item.key, Object.freeze({ ...item })])));

export function getCapabilityMeta(key) {
  return BOOK_CAPABILITIES[String(key || '').trim()] || null;
}

export function getCapabilityTitle(key) {
  return getCapabilityMeta(key)?.title || String(key || '').trim();
}

export function getCapabilityDescription(key) {
  return getCapabilityMeta(key)?.description || '';
}

export function getSectionCapability(section) {
  const target = String(section || '').trim();
  return CAPABILITIES.find((item) => item.placement === 'navigation' && item.section === target)?.key || null;
}

export function listCapabilityKeys() {
  return CAPABILITIES.map((item) => item.key);
}

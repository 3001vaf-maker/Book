const CAPABILITIES = [
  { key: 'profile.access', title: 'Профиль', description: 'Данные мастера и основная информация Book.', placement: 'settings' },
  { key: 'services.access', title: 'Услуги', description: 'Настройка услуг и процедур мастера.', placement: 'settings' },
  { key: 'clients.access', title: 'Клиенты', description: 'Клиентская база и работа с карточками клиентов.', placement: 'main' },
  { key: 'workplaces.max', title: 'Рабочие пространства', description: 'Количество доступных рабочих пространств.', placement: 'limit' },
  { key: 'timetable.access', title: 'График', description: 'Настройка рабочих дней и рабочего времени.', placement: 'navigation', section: 'timetable' },
  { key: 'journal.access', title: 'Журнал', description: 'Записи, рабочий день и история работы.', placement: 'navigation', section: 'journal' },
  { key: 'online_booking.access', title: 'Онлайн-запись', description: 'Клиенты смогут записываться к мастеру онлайн.', placement: 'settings' },
  { key: 'payments.access', title: 'Оплаты', description: 'Оплата и расчёты внутри записей и процедур.', placement: 'embedded' },
  { key: 'finance.access', title: 'Финансы', description: 'Доходы, расходы и финансовая картина работы.', placement: 'main' },
  { key: 'chat.access', title: 'Чат', description: 'Рабочий чат и коммуникация.', placement: 'navigation', section: 'chat' },
  { key: 'notifications.access', title: 'Уведомления', description: 'Настройки уведомлений и сообщений.', placement: 'settings' },
  { key: 'integrations.access', title: 'Интеграции', description: 'Подключение внешних сервисов Book.', placement: 'settings' },
  { key: 'documents.access', title: 'Документы', description: 'Документы, согласия и история документов.', placement: 'settings' },
  { key: 'tags.access', title: 'Ярлыки', description: 'Ярлыки и дополнительные признаки для работы.', placement: 'settings' },
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

const CAPABILITIES = [
  {
    key: 'profile.access', title: 'Профиль', description: 'Данные пользователя и рабочего профиля.', placement: 'settings', owner: 'settings/settings.js',
    entrySelector: '[data-settings-open="profile"]', introTitle: 'Профиль открыт', introBody: 'Теперь доступен раздел профиля. Здесь настраиваются данные пользователя и его рабочего профиля.', introAction: 'Открыть профиль',
  },
  {
    key: 'services.access', title: 'Услуги', description: 'Настройка услуг и процедур.', placement: 'settings', owner: 'settings/settings.js',
    entrySelector: '[data-settings-open="service"]', introTitle: 'Услуги открыты', introBody: 'Теперь доступен раздел услуг. Здесь можно настроить услуги и процедуры.', introAction: 'Открыть услуги',
  },
  {
    key: 'clients.access', title: 'Клиенты', description: 'Клиентская база и работа с карточками клиентов.', placement: 'main', owner: 'main/main.js',
    entrySelector: '[data-open-clients]', introTitle: 'Клиенты открыты', introBody: 'Теперь доступна клиентская база и работа с карточками клиентов.', introAction: 'Открыть клиентов',
  },
  { key: 'workplaces.max', title: 'Рабочие пространства', description: 'Количество доступных рабочих пространств.', placement: 'limit', owner: 'server/src/profile/workplace-limit.guard.ts' },
  {
    key: 'timetable.access', title: 'График', description: 'Настройка рабочих дней и рабочего времени.', placement: 'navigation', section: 'timetable', owner: 'core.js',
    entrySelector: '[data-nav="timetable"]', introTitle: 'График открыт', introBody: 'Теперь можно выбрать рабочие дни и настроить рабочее время.', introAction: 'Настроить график',
  },
  {
    key: 'journal.access', title: 'Журнал', description: 'Записи, рабочий день и история работы.', placement: 'navigation', section: 'journal', owner: 'core.js',
    entrySelector: '[data-nav="journal"]', introTitle: 'Журнал открыт', introBody: 'Теперь можно вести записи, рабочий день и историю работы.', introAction: 'Открыть журнал',
  },
  {
    key: 'online_booking.access', title: 'Онлайн-запись', description: 'Доступна публичная онлайн-запись.', placement: 'settings', owner: 'settings/settings.js',
    entrySelector: '[data-settings-open="online-booking"]', introTitle: 'Онлайн-запись открыта', introBody: 'Теперь доступна онлайн-запись и ссылка для записи клиентов.', introAction: 'Настроить онлайн-запись',
  },
  {
    key: 'payments.access', title: 'Оплаты', description: 'Оплата и расчёты внутри записей и процедур.', placement: 'embedded', owner: 'journal/record-payment.js',
    entrySelector: '[data-record-payment-open], [data-record-payment-paid]', introTitle: 'Оплаты открыты', introBody: 'Теперь можно фиксировать оплату и расчёты внутри записей.', introAction: 'Продолжить',
  },
  {
    key: 'finance.access', title: 'Финансы', description: 'Доходы, расходы и финансовая картина работы.', placement: 'main', owner: 'main/main.js',
    entrySelector: '[data-open-finance]', introTitle: 'Финансы открыты', introBody: 'Теперь доступен финансовый раздел с доходами, расходами и общей картиной.', introAction: 'Открыть финансы',
  },
  {
    key: 'chat.access', title: 'Чат', description: 'Рабочий чат и коммуникация.', placement: 'navigation', section: 'chat', owner: 'core.js',
    entrySelector: '[data-nav="chat"]', introTitle: 'Чат открыт', introBody: 'Теперь доступен рабочий чат для коммуникации с клиентами.', introAction: 'Открыть чат',
  },
  {
    key: 'notifications.access', title: 'Уведомления', description: 'Настройки уведомлений и сообщений.', placement: 'settings', owner: 'settings/settings.js',
    entrySelector: '[data-settings-open="communications"]', introTitle: 'Уведомления открыты', introBody: 'Теперь можно настраивать уведомления и сообщения.', introAction: 'Открыть уведомления',
  },
  {
    key: 'integrations.access', title: 'Интеграции', description: 'Подключение внешних сервисов.', placement: 'settings', owner: 'settings/settings.js',
    entrySelector: '[data-settings-open="integrations"]', introTitle: 'Интеграции открыты', introBody: 'Теперь доступно подключение внешних сервисов.', introAction: 'Открыть интеграции',
  },
  {
    key: 'documents.access', title: 'Документы', description: 'Документы, согласия и история документов.', placement: 'settings', owner: 'settings/settings.js',
    entrySelector: '[data-settings-open="documents"]', introTitle: 'Документы открыты', introBody: 'Теперь доступна работа с документами, согласиями и их историей.', introAction: 'Открыть документы',
  },
  {
    key: 'tags.access', title: 'Ярлыки', description: 'Ярлыки и дополнительные признаки для работы.', placement: 'settings', owner: 'settings/settings.js',
    entrySelector: '[data-settings-open="tags"]', introTitle: 'Ярлыки открыты', introBody: 'Теперь можно использовать ярлыки и дополнительные признаки в работе.', introAction: 'Открыть ярлыки',
  },
];

export const CAPABILITY_REGISTRY = Object.freeze(Object.fromEntries(CAPABILITIES.map((item) => [item.key, Object.freeze({ ...item })])));

export function getCapabilityMeta(key) {
  return CAPABILITY_REGISTRY[String(key || '').trim()] || null;
}

export function getCapabilityTitle(key) {
  return getCapabilityMeta(key)?.title || String(key || '').trim();
}

export function getCapabilityDescription(key) {
  return getCapabilityMeta(key)?.description || '';
}

export function getCapabilityIntro(key) {
  const meta = getCapabilityMeta(key);
  if (!meta) return null;
  return {
    title: meta.introTitle || `${meta.title} открыт`,
    body: meta.introBody || meta.description || meta.title,
    action: meta.introAction || 'Продолжить',
  };
}

export function getCapabilityByEntryTarget(target) {
  if (!(target instanceof Element)) return null;
  return CAPABILITIES.find((item) => item.entrySelector && target.closest(item.entrySelector)) || null;
}

export function getSectionCapability(section) {
  const target = String(section || '').trim();
  return CAPABILITIES.find((item) => item.placement === 'navigation' && item.section === target)?.key || null;
}

export function listCapabilityKeys() {
  return CAPABILITIES.map((item) => item.key);
}

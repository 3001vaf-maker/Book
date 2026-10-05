import { getNotificationRouting, saveNotificationRouting } from '../../core/notifications/routing.js';
import {
  emptyState,
  field,
  initV2ListReorder,
  mountModal,
  page,
  modal,
  textareaField,
  v2ListEntry,
  v2ListEntries,
  workspaceHeaderContext,
} from '../../ui/ui.js';

const EVENTS = [
  { type: 'booking.created', title: 'Запись создана', body: 'После создания записи' },
  { type: 'booking.rescheduled', title: 'Запись перенесена', body: 'После изменения даты или времени' },
  { type: 'booking.cancelled', title: 'Запись отменена', body: 'После отмены записи' },
];

const CHANNELS = [
  ['PUSH', 'Push'],
  ['TELEGRAM', 'Telegram'],
  ['EMAIL', 'Email'],
];

function normalizedPolicy(routing, type) {
  const source = Array.isArray(routing) ? routing.find((item) => item?.eventType === type) : null;
  return {
    mode: source?.mode === 'fallback' ? 'fallback' : 'always',
    channels: Array.isArray(source?.channels) ? source.channels.filter((value) => CHANNELS.some(([key]) => key === value)) : ['PUSH'],
    titleTemplate: String(source?.titleTemplate || '').trim(),
    bodyTemplate: String(source?.bodyTemplate || '').trim(),
  };
}

function channelName(key) {
  return CHANNELS.find(([value]) => value === key)?.[1] || key;
}

function policySubtitle(policy) {
  const names = policy.channels.map(channelName);
  const delivery = policy.mode === 'fallback' ? 'по очереди' : 'во все выбранные';
  return `${names.length ? names.join(' → ') : 'без внешней отправки'} · ${delivery}`;
}

function editPolicy(root, routing, event) {
  const current = normalizedPolicy(routing, event.type);
  const state = { mode: current.mode, channels: [...current.channels] };
  const layer = mountModal(document.body, modal(`
    <div class="form-grid" data-notification-policy>
      ${field({ label: 'Заголовок сообщения', name: 'titleTemplate', value: current.titleTemplate })}
      ${textareaField({ label: 'Текст сообщения', name: 'bodyTemplate', value: current.bodyTemplate, rows: 5 })}
      <div class="muted">Доступно: {{date}}, {{time}}, {{workplace}}, {{person.name}}, {{person.surname}}</div>
      <div data-notification-modes></div>
      <div data-notification-channels></div>
      <div class="muted" data-notification-save-status></div>
    </div>
  `, { title: event.title, variant: 'q', surface: 'app' }));

  const status = () => layer?.querySelector('[data-notification-save-status]');
  const templateValue = (name) => String(layer?.querySelector(`[name="${name}"]`)?.value || '').trim();

  const persist = async () => {
    const node = status();
    if (node) node.textContent = 'Сохраняем…';
    try {
      const saved = await saveNotificationRouting(event.type, {
        mode: state.mode,
        channels: state.channels,
        titleTemplate: templateValue('titleTemplate'),
        bodyTemplate: templateValue('bodyTemplate'),
      });
      if (Array.isArray(routing)) {
        const index = routing.findIndex((item) => item?.eventType === event.type);
        const next = saved && typeof saved === 'object'
          ? saved
          : {
              eventType: event.type,
              mode: state.mode,
              channels: [...state.channels],
              titleTemplate: templateValue('titleTemplate'),
              bodyTemplate: templateValue('bodyTemplate'),
            };
        if (index >= 0) routing[index] = next;
        else routing.push(next);
      }
      if (node) node.textContent = 'Сохранено.';
      await render(root);
    } catch (error) {
      if (node) node.textContent = error instanceof Error ? error.message : 'Не удалось сохранить.';
    }
  };

  const drawChannels = () => {
    const host = layer?.querySelector('[data-notification-channels]');
    if (!host) return;
    const enabled = state.channels.map((key) => v2ListEntry({
      title: channelName(key),
      subtitle: state.mode === 'fallback' ? `Приоритет ${state.channels.indexOf(key) + 1}` : 'Включён',
      interactive: false,
      toggleData: `data-notification-channel-toggle="${key}"`,
      toggleAria: `Выключить ${channelName(key)}`,
      toggleChecked: true,
      reorderHandle: state.mode === 'fallback',
    }));
    const disabled = CHANNELS.filter(([key]) => !state.channels.includes(key)).map(([key, label]) => v2ListEntry({
      title: label,
      subtitle: 'Выключен',
      interactive: false,
      toggleData: `data-notification-channel-toggle="${key}"`,
      toggleAria: `Включить ${label}`,
      toggleChecked: false,
    }));
    host.innerHTML = [
      v2ListEntries([
        v2ListEntry({ title: 'В приложении', subtitle: 'Всегда', interactive: false, toggleData: 'data-in-app-fixed', toggleAria: 'В приложении включено всегда', toggleChecked: true, toggleDisabled: true }),
      ]),
      enabled.length ? v2ListEntries(enabled) : '',
      disabled.length ? v2ListEntries(disabled) : '',
    ].join('');

    host.querySelectorAll('[data-notification-channel-toggle]').forEach((node) => {
      const key = node.dataset.notificationChannelToggle;
      const row = node.closest('.list-entry');
      if (row && state.channels.includes(key)) row.dataset.reorderId = key;
      node.addEventListener('click', () => {
        if (state.channels.includes(key)) state.channels = state.channels.filter((value) => value !== key);
        else state.channels.push(key);
        drawChannels();
        void persist();
      });
    });

    if (state.mode === 'fallback' && enabled.length) {
      const lists = host.querySelectorAll('.list-entries');
      const enabledList = lists.length > 1 ? lists[1] : null;
      if (enabledList) initV2ListReorder(enabledList, {
        onReorder: (ids) => {
          state.channels = ids.filter((key) => CHANNELS.some(([value]) => value === key));
          drawChannels();
          void persist();
        },
      });
    }
  };

  const drawModes = () => {
    const host = layer?.querySelector('[data-notification-modes]');
    if (!host) return;
    host.innerHTML = v2ListEntries([
      v2ListEntry({
        title: 'Во все выбранные',
        subtitle: 'Одновременно используем все доступные каналы',
        selected: state.mode === 'always',
        data: 'data-notification-mode="always"',
      }),
      v2ListEntry({
        title: 'По очереди',
        subtitle: 'Используем первый доступный канал по заданному приоритету',
        selected: state.mode === 'fallback',
        data: 'data-notification-mode="fallback"',
      }),
    ]);
    host.querySelectorAll('[data-notification-mode]').forEach((node) => node.addEventListener('click', () => {
      state.mode = node.dataset.notificationMode === 'fallback' ? 'fallback' : 'always';
      drawModes();
      drawChannels();
      void persist();
    }));
  };

  layer?.querySelector('[name="titleTemplate"]')?.addEventListener('change', () => void persist());
  layer?.querySelector('[name="bodyTemplate"]')?.addEventListener('change', () => void persist());
  drawModes();
  drawChannels();
}

export async function render(root) {
  root.innerHTML = page([
    workspaceHeaderContext({ title: 'Уведомления' }),
    '<div data-notification-routing></div>',
  ]);
  const host = root.querySelector('[data-notification-routing]');
  if (host) host.innerHTML = emptyState('Загрузка', 'Загружаем сообщения.');

  try {
    const routing = await getNotificationRouting();
    if (!host) return;
    host.innerHTML = v2ListEntries(EVENTS.map((event, index) => {
      const policy = normalizedPolicy(routing, event.type);
      return v2ListEntry({
        title: event.title,
        subtitle: `${event.body} · ${policySubtitle(policy)}`,
        data: `data-notification-event="${index}"`,
      });
    }));
    host.querySelectorAll('[data-notification-event]').forEach((node) => node.addEventListener('click', () => {
      const event = EVENTS[Number(node.dataset.notificationEvent)];
      if (event) editPolicy(root, routing, event);
    }));
  } catch (error) {
    if (host) host.innerHTML = emptyState('Настройки недоступны', error instanceof Error ? error.message : 'Не удалось загрузить уведомления.');
  }
}

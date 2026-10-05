import { getNotificationRouting, saveNotificationRouting } from '../../core/notifications/routing.js';
import {
  button,
  emptyState,
  mountModal,
  page,
  settingsPanel,
  modal,
  v2ListEntry,
  v2ListEntries,
  workspaceHeaderContext,
} from '../../ui/ui.js';

const EVENTS = [
  { type: 'booking.created', title: 'Запись создана', body: 'Сообщение после создания записи' },
  { type: 'booking.rescheduled', title: 'Запись перенесена', body: 'Сообщение после изменения даты или времени' },
  { type: 'booking.cancelled', title: 'Запись отменена', body: 'Сообщение после отмены записи' },
  { type: 'booking.reminder', title: 'Напоминание о записи', body: 'Сообщение перед предстоящей записью' },
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
    channels: Array.isArray(source?.channels) ? source.channels : ['PUSH'],
  };
}

function policySubtitle(policy) {
  const names = CHANNELS.filter(([key]) => policy.channels.includes(key)).map(([, label]) => label);
  const delivery = policy.mode === 'fallback' ? 'по очереди' : 'во все выбранные';
  return `${names.length ? names.join(', ') : 'Только в приложении'} · ${delivery}`;
}

function editPolicy(root, routing, event) {
  const current = normalizedPolicy(routing, event.type);
  const state = { mode: current.mode, channels: new Set(current.channels) };
  const layer = mountModal(document.body, modal(`
    <div class="form-grid" data-notification-policy>
      ${settingsPanel([
        { label: 'Во все выбранные', data: 'data-notification-mode="always"' },
        { label: 'По очереди', data: 'data-notification-mode="fallback"' },
      ])}
      <div data-notification-channels></div>
      ${button('Сохранить', { data: 'data-notification-save' })}
    </div>
  `, { title: event.title, variant: 'q', surface: 'app' }));

  const draw = () => {
    const host = layer?.querySelector('[data-notification-channels]');
    if (host) host.innerHTML = v2ListEntries(CHANNELS.map(([key, label]) => v2ListEntry({
      title: label,
      subtitle: state.channels.has(key) ? 'Включён' : 'Выключен',
      data: `data-notification-channel="${key}"`,
    })));
    layer?.querySelectorAll('[data-notification-channel]').forEach((node) => node.addEventListener('click', () => {
      const key = node.dataset.notificationChannel;
      if (state.channels.has(key)) state.channels.delete(key);
      else state.channels.add(key);
      draw();
    }));
    layer?.querySelectorAll('[data-notification-mode]').forEach((node) => {
      if (node.dataset.notificationMode === state.mode) node.dataset.selected = 'true';
      else delete node.dataset.selected;
    });
  };

  layer?.querySelectorAll('[data-notification-mode]').forEach((node) => node.addEventListener('click', () => {
    state.mode = node.dataset.notificationMode === 'fallback' ? 'fallback' : 'always';
    draw();
  }));
  layer?.querySelector('[data-notification-save]')?.addEventListener('click', async () => {
    await saveNotificationRouting(event.type, { mode: state.mode, channels: [...state.channels] });
    layer?.remove();
    await render(root);
  });
  draw();
}

export async function render(root) {
  root.innerHTML = page([
    workspaceHeaderContext({ title: 'Уведомления' }),
    '<div data-notification-routing></div>',
  ]);
  const host = root.querySelector('[data-notification-routing]');
  if (host) host.innerHTML = emptyState('Загрузка', 'Загружаем настройки сообщений.');

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

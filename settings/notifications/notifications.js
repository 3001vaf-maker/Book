import { getNotificationRouting, saveNotificationRouting } from '../../core/notifications/routing.js';
import {
  button,
  emptyState,
  field,
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
  const channelRows = CHANNELS.map(([key, label]) => field({
    label,
    name: `channel-${key}`,
    type: 'checkbox',
    checked: current.channels.includes(key),
  })).join('');

  const layer = mountModal(document.body, modal(`
    <form class="form-grid" data-notification-policy-form>
      ${settingsPanel([
        { label: 'Во все выбранные', data: `data-notification-mode="always"${current.mode === 'always' ? ' data-selected="true"' : ''}` },
        { label: 'По очереди', data: `data-notification-mode="fallback"${current.mode === 'fallback' ? ' data-selected="true"' : ''}` },
      ])}
      ${channelRows}
      ${button('Сохранить', { type: 'submit' })}
    </form>
  `, { title: event.title, variant: 'q', surface: 'app' }));

  const form = layer?.querySelector('[data-notification-policy-form]');
  let mode = current.mode;
  layer?.querySelectorAll('[data-notification-mode]').forEach((node) => node.addEventListener('click', () => {
    mode = node.dataset.notificationMode === 'fallback' ? 'fallback' : 'always';
    layer.querySelectorAll('[data-notification-mode]').forEach((item) => {
      if (item.dataset.notificationMode === mode) item.dataset.selected = 'true';
      else delete item.dataset.selected;
    });
  }));

  form?.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const data = new FormData(form);
    const channels = CHANNELS.filter(([key]) => data.get(`channel-${key}`) !== null).map(([key]) => key);
    await saveNotificationRouting(event.type, { mode, channels });
    layer?.remove();
    await render(root);
  });
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

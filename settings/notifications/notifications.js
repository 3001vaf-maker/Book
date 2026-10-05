import { getNotificationRouting, saveNotificationRouting } from '../../core/notifications/routing.js';
import {
  button,
  emptyState,
  field,
  modal,
  mountModal,
  page,
  select,
  smallActionButton,
  textareaField,
  v2ListEntry,
  v2ListEntries,
  workspaceHeaderContext,
} from '../../ui/ui.js';

const DELIVERY_POLICY_TYPE = '__delivery__';
const EVENTS = [
  { type: 'booking.created', title: 'Запись создана', body: 'После создания записи' },
  { type: 'booking.rescheduled', title: 'Запись перенесена', body: 'После изменения даты или времени' },
  { type: 'booking.cancelled', title: 'Запись отменена', body: 'После отмены записи' },
];

const EXTERNAL_CHANNEL_OPTIONS = Object.freeze([
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'EMAIL', label: 'Email' },
  { value: '', label: 'Не использовать' },
]);

const ROUTING_MODE_OPTIONS = Object.freeze([
  { value: 'always', label: 'Во все выбранные каналы' },
  { value: 'fallback', label: 'По очереди, если предыдущий не доставлен' },
]);

function normalizedPolicy(routing, type) {
  const source = Array.isArray(routing) ? routing.find((item) => item?.eventType === type) : null;
  return {
    mode: source?.mode === 'fallback' ? 'fallback' : 'always',
    channels: Array.isArray(source?.channels) ? source.channels : ['PUSH'],
    titleTemplate: String(source?.titleTemplate || '').trim(),
    bodyTemplate: String(source?.bodyTemplate || '').trim(),
  };
}

function deliveryPolicy(items = []) {
  const source = (Array.isArray(items) ? items : []).find((item) => item?.eventType === DELIVERY_POLICY_TYPE)
    || (Array.isArray(items) ? items : []).find((item) => item?.eventType === 'booking.created');
  return {
    mode: source?.mode === 'fallback' ? 'fallback' : 'always',
    channels: Array.isArray(source?.channels) ? source.channels : ['PUSH'],
  };
}

function externalChannelValues(policy = {}) {
  const values = [];
  for (const value of Array.isArray(policy.channels) ? policy.channels : []) {
    const channel = String(value || '').trim().toUpperCase();
    if (!['TELEGRAM', 'EMAIL'].includes(channel) || values.includes(channel)) continue;
    values.push(channel);
  }
  while (values.length < 2) values.push('');
  return values.slice(0, 2);
}

function selectedExternalChannels(form) {
  const data = new FormData(form);
  const values = ['channel1', 'channel2']
    .map((name) => String(data.get(name) || '').trim().toUpperCase())
    .filter((value) => ['TELEGRAM', 'EMAIL'].includes(value));
  return [...new Set(values)];
}

function openPushInfo() {
  const content = '<div class="modal-title"><h2>Push</h2><p>Push отправляется всегда отдельно. Последовательность применяется только к Telegram и Email.</p></div>';
  return mountModal(document.body, modal(content, {
    title: 'О Push',
    variant: 's',
    surface: 'app',
  }));
}

async function openDeliverySettings() {
  const items = await getNotificationRouting();
  const policy = deliveryPolicy(items);
  const channels = externalChannelValues(policy);
  const pushInfo = `<div class="field-inline-label"><span>Push — всегда</span>${smallActionButton({
    icon: 'info',
    data: 'data-notification-push-info',
    aria: 'О Push',
  })}</div>`;
  const body = `<div data-notification-delivery-settings>
    <form class="form-grid" data-notification-delivery-form>
      ${pushInfo}
      ${select({
        label: 'Порядок отправки',
        name: 'mode',
        value: policy.mode,
        options: ROUTING_MODE_OPTIONS,
      })}
      ${select({ label: 'Канал 1', name: 'channel1', value: channels[0], options: EXTERNAL_CHANNEL_OPTIONS })}
      ${select({ label: 'Канал 2', name: 'channel2', value: channels[1], options: EXTERNAL_CHANNEL_OPTIONS })}
      <div class="muted" data-notification-delivery-status aria-live="polite"></div>
      ${button('Сохранить', { type: 'submit' })}
    </form>
  </div>`;
  const layer = mountModal(document.body, modal(body, {
    title: 'Настройки уведомлений',
    variant: 'x',
    className: 'modal--form-sheet',
  }));
  if (!layer) return null;

  layer.querySelector('[data-notification-push-info]')?.addEventListener('click', openPushInfo);
  const form = layer.querySelector('[data-notification-delivery-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = layer.querySelector('[data-notification-delivery-status]');
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    if (status) status.textContent = 'Сохраняем…';
    try {
      const data = new FormData(form);
      await saveNotificationRouting(DELIVERY_POLICY_TYPE, {
        mode: String(data.get('mode') || 'always'),
        channels: ['PUSH', ...selectedExternalChannels(form)],
      });
      layer.v2Close?.();
    } catch (error) {
      if (submit) submit.disabled = false;
      if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось сохранить';
    }
  });
  return layer;
}

function editPolicy(root, routing, event) {
  const current = normalizedPolicy(routing, event.type);
  const layer = mountModal(document.body, modal(`
    <form class="form-grid" data-notification-policy-form>
      ${field({ label: 'Заголовок сообщения', name: 'titleTemplate', value: current.titleTemplate, required: true })}
      ${textareaField({ label: 'Текст сообщения', name: 'bodyTemplate', value: current.bodyTemplate, rows: 5, required: true })}
      <div class="muted">Доступно: {{date}}, {{time}}, {{workplace}}, {{person.name}}, {{person.surname}}</div>
      ${button('Сохранить', { type: 'submit' })}
    </form>
  `, { title: event.title, variant: 'q', surface: 'app' }));

  layer?.querySelector('[data-notification-policy-form]')?.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const form = submitEvent.currentTarget;
    const data = new FormData(form);
    await saveNotificationRouting(event.type, {
      mode: current.mode,
      channels: current.channels,
      titleTemplate: data.get('titleTemplate'),
      bodyTemplate: data.get('bodyTemplate'),
    });
    layer?.remove();
    await render(root);
  });
}

export async function render(root) {
  root.innerHTML = page([
    workspaceHeaderContext({
      title: 'Уведомления',
      a: {
        kind: 'settings',
        data: 'data-notification-delivery-settings-open',
        aria: 'Настройки доставки уведомлений',
      },
    }),
    '<div data-notification-routing></div>',
  ]);
  root.querySelector('[data-notification-delivery-settings-open]')?.addEventListener('click', () => void openDeliverySettings());

  const host = root.querySelector('[data-notification-routing]');
  if (host) host.innerHTML = emptyState('Загрузка', 'Загружаем сообщения.');

  try {
    const routing = await getNotificationRouting();
    if (!host) return;
    host.innerHTML = v2ListEntries(EVENTS.map((event, index) => v2ListEntry({
      title: event.title,
      subtitle: event.body,
      data: `data-notification-event="${index}"`,
    })));
    host.querySelectorAll('[data-notification-event]').forEach((node) => node.addEventListener('click', () => {
      const event = EVENTS[Number(node.dataset.notificationEvent)];
      if (event) editPolicy(root, routing, event);
    }));
  } catch (error) {
    if (host) host.innerHTML = emptyState('Настройки недоступны', error instanceof Error ? error.message : 'Не удалось загрузить уведомления.');
  }
}

import { getNotificationRouting, saveNotificationRouting } from '../../core/notifications/routing.js';
import { actionBlock, button, emptyState, folderList, pageHeader, select } from '../../ui/ui.js';

const CHANNEL_OPTIONS = [
  { value: '', label: 'Не использовать' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'EMAIL', label: 'Email' },
];

function policyFrom(items = []) {
  const current = (Array.isArray(items) ? items : []).find((item) => item.eventType === 'booking.created') || { eventType: 'booking.created', mode: 'always', channels: ['PUSH'] };
  return { ...current, channels: ['PUSH', ...(Array.isArray(current.channels) ? current.channels : []).filter((channel) => String(channel || '').toUpperCase() !== 'PUSH')] };
}

function normalizedExternalChannels(form) {
  const data = new FormData(form);
  return [...new Set([data.get('channel1'), data.get('channel2')].map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))];
}

function renderRoutingForm(root, navigateBack, policy) {
  const channels = (Array.isArray(policy.channels) ? policy.channels : []).filter((channel) => String(channel || '').toUpperCase() !== 'PUSH');
  root.innerHTML = `${pageHeader('Настройки уведомлений')}
    <form class="form-grid" data-communications-routing>
      <div class="section-heading"><h2>Новая запись</h2></div>
      <div class="action-block"><strong>Push — всегда</strong><div class="muted">Системный Push отправляется автоматически, если человек разрешил уведомления на устройстве. Уведомление внутри Book создаётся всегда.</div></div>
      ${select({ label: 'Как отправлять во внешние каналы', name: 'mode', value: policy.mode || 'always', options: [
        { value: 'always', label: 'Всегда отправлять по выбранным каналам' },
        { value: 'fallback', label: 'Поэтапно — следующий, если предыдущий не доставлен' },
      ] })}
      ${select({ label: 'Внешний канал 1', name: 'channel1', value: channels[0] || 'TELEGRAM', options: CHANNEL_OPTIONS })}
      ${select({ label: 'Внешний канал 2', name: 'channel2', value: channels[1] || '', options: CHANNEL_OPTIONS })}
      <div class="muted" data-communications-status aria-live="polite"></div>
      ${actionBlock(`${button('Сохранить', { type: 'submit' })}${button('Назад', { variant: 'secondary', data: 'data-communications-routing-back' })}`)}
    </form>`;
  root.querySelector('[data-communications-routing-back]')?.addEventListener('click', navigateBack);
  root.querySelector('[data-communications-routing]')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; const status = root.querySelector('[data-communications-status]'); const data = new FormData(form);
    try { await saveNotificationRouting('booking.created', { mode: String(data.get('mode') || 'always'), channels: normalizedExternalChannels(form) }); if (status) status.textContent = 'Сохранено.'; }
    catch (error) { if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось сохранить'; }
  });
}

function openRouting(root, navigateBack) {
  root.innerHTML = `${pageHeader('Настройки уведомлений')}${emptyState('Загрузка', 'Получаем настройки каналов.')}`;
  void getNotificationRouting().then((items) => renderRoutingForm(root, navigateBack, policyFrom(items))).catch((error) => {
    root.innerHTML = `${pageHeader('Настройки уведомлений')}${emptyState('Настройки недоступны', error instanceof Error ? error.message : 'Не удалось загрузить настройки')}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-communications-routing-back' }))}`;
    root.querySelector('[data-communications-routing-back]')?.addEventListener('click', navigateBack);
  });
}

async function openBroadcasts(root, navigateBack) { const { render } = await import('./broadcasts/broadcasts.js'); render(root, navigateBack); }

function renderNotifications(root, navigateBack) {
  root.innerHTML = `${pageHeader('Уведомления')}${folderList([
    { title: 'Настройки уведомлений', data: 'data-communications-open="routing"' },
    { title: 'Рассылки', data: 'data-communications-open="broadcasts"' },
  ])}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-communications-back' }))}`;
  root.querySelector('[data-communications-open="routing"]')?.addEventListener('click', () => openRouting(root, () => renderNotifications(root, navigateBack)));
  root.querySelector('[data-communications-open="broadcasts"]')?.addEventListener('click', () => void openBroadcasts(root, () => renderNotifications(root, navigateBack)));
  root.querySelector('[data-communications-back]')?.addEventListener('click', navigateBack);
}

export function render(root, navigateBack = () => {}) { renderNotifications(root, navigateBack); }

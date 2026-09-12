import { apiRequest } from '../auth.js';

async function payload(response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value?.message || 'Не удалось сохранить настройки уведомлений');
  return value;
}

export async function getNotificationRouting() {
  return payload(await apiRequest('/notifications/routing'));
}

export async function saveNotificationRouting(eventType, { mode = 'always', channels = [] } = {}) {
  const external = (Array.isArray(channels) ? channels : [])
    .map((value) => String(value || '').trim().toUpperCase())
    .filter((value) => value && value !== 'PUSH');
  const normalizedChannels = ['PUSH', ...new Set(external)];
  return payload(await apiRequest(`/notifications/routing/${encodeURIComponent(eventType)}`, {
    method: 'PUT',
    body: JSON.stringify({ mode, channels: normalizedChannels }),
  }));
}

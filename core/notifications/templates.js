import { apiRequest } from '../auth.js';

async function payload(response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value?.message || 'Не удалось сохранить шаблон уведомления');
  return value;
}

export async function getNotificationTemplates(audience = '') {
  const query = new URLSearchParams();
  if (audience) query.set('audience', String(audience || '').toUpperCase());
  const suffix = query.toString() ? `?${query}` : '';
  return payload(await apiRequest(`/notifications/templates${suffix}`));
}

export async function saveNotificationTemplate(templateKey, { title = '', body = '' } = {}) {
  return payload(await apiRequest(`/notifications/templates/${encodeURIComponent(String(templateKey || ''))}`, {
    method: 'PUT',
    body: JSON.stringify({ title, body }),
  }));
}

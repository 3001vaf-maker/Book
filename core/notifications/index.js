import { getAccountToken } from '../account/index.js';
import { API_BASE } from '../environment.js';

async function request(tenantId, path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAccountToken(tenantId);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || 'Не удалось загрузить уведомления');
    error.code = payload?.code || '';
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function getBookingNotifications(tenantId) {
  return request(tenantId, `/online-booking/${encodeURIComponent(tenantId)}/account/notifications`);
}

export function markBookingNotificationRead(tenantId, notificationId) {
  return request(
    tenantId,
    `/online-booking/${encodeURIComponent(tenantId)}/account/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: 'POST' },
  );
}

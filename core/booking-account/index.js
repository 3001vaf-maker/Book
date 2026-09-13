import { API_BASE } from '../environment.js';

function tokenKey(tenantId) {
  return `book.booking-account.token.${String(tenantId || '')}`;
}

function emailKey(tenantId) {
  return `book.booking-account.email.${String(tenantId || '')}`;
}

export function getBookingAccountToken(tenantId) {
  return localStorage.getItem(tokenKey(tenantId)) || '';
}

export function getRememberedBookingEmail(tenantId) {
  return localStorage.getItem(emailKey(tenantId)) || '';
}

export function clearBookingAccount(tenantId) {
  localStorage.removeItem(tokenKey(tenantId));
}

async function request(path, { tenantId = '', auth = false, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (auth) {
    const token = getBookingAccountToken(tenantId);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

async function jsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

function storeSession(tenantId, payload) {
  if (payload?.accessToken) localStorage.setItem(tokenKey(tenantId), payload.accessToken);
  if (payload?.account?.email) localStorage.setItem(emailKey(tenantId), payload.account.email);
  return payload;
}

export async function getBookingContext(tenantId, workplaceKey = '') {
  const params = new URLSearchParams();
  if (workplaceKey) params.set('workplace', workplaceKey);
  const suffix = params.toString() ? `?${params}` : '';
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/context${suffix}`),
    'Не удалось загрузить онлайн-запись',
  );
}

export async function prepareBookingAccount(tenantId, email) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/prepare`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
    'Не удалось проверить аккаунт',
  );
}

export async function registerBookingAccount(tenantId, data) {
  const payload = await jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/register`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
    'Не удалось создать аккаунт',
  );
  return storeSession(tenantId, payload);
}

export async function loginBookingAccount(tenantId, email, password) {
  const payload = await jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
    'Не удалось войти',
  );
  return storeSession(tenantId, payload);
}

export async function getBookingAccount(tenantId) {
  const token = getBookingAccountToken(tenantId);
  if (!token) return null;
  const response = await request(`/online-booking/${encodeURIComponent(tenantId)}/account/me`, { tenantId, auth: true });
  if (response.status === 401) {
    clearBookingAccount(tenantId);
    return null;
  }
  return jsonResponse(response, 'Не удалось открыть аккаунт');
}

export async function updateBookingAccount(tenantId, data) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/me`, {
      tenantId,
      auth: true,
      method: 'PUT',
      body: JSON.stringify(data || {}),
    }),
    'Не удалось обновить аккаунт',
  );
}

export async function changeBookingPassword(tenantId, currentPassword, newPassword) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/password`, {
      tenantId,
      auth: true,
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
    'Не удалось изменить пароль',
  );
}

export async function createBookingRequest(tenantId, data) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/requests`, {
      tenantId,
      auth: true,
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
    'Не удалось подтвердить запись',
  );
}

export async function getBookingRequests(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/requests`, { tenantId, auth: true }),
    'Не удалось загрузить записи аккаунта',
  );
}

export async function getBookingConsentState(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/consent-state`, { tenantId, auth: true }),
    'Не удалось проверить согласия',
  );
}

export async function submitBookingConsents(tenantId, consents = []) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/consents`, {
      tenantId,
      auth: true,
      method: 'POST',
      body: JSON.stringify({ consents }),
    }),
    'Не удалось сохранить согласия',
  );
}

export async function revokeBookingConsent(tenantId, documentId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/consents/${encodeURIComponent(documentId)}/revoke`, {
      tenantId,
      auth: true,
      method: 'POST',
    }),
    'Не удалось отозвать согласие',
  );
}

export async function bindBookingTelegramEntry(tenantId, token) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/telegram-entry`, {
      tenantId,
      auth: true,
      method: 'POST',
      body: JSON.stringify({ token: String(token || '').trim() }),
    }),
    'Не удалось привязать Telegram',
  );
}

export async function getBookingNotifications(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/notifications`, { tenantId, auth: true }),
    'Не удалось загрузить уведомления',
  );
}

export async function markBookingNotificationRead(tenantId, notificationId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/notifications/${encodeURIComponent(notificationId)}/read`, {
      tenantId,
      auth: true,
      method: 'POST',
    }),
    'Не удалось открыть уведомление',
  );
}

export async function getBookingChat(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/chat`, { tenantId, auth: true }),
    'Не удалось загрузить чат',
  );
}

export async function getBookingChatSettings(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/chat/settings`, { tenantId, auth: true }),
    'Не удалось загрузить настройки чата',
  );
}

export async function setBookingTelegramConsent(tenantId, enabled) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/chat/telegram-consent`, {
      tenantId,
      auth: true,
      method: 'PUT',
      body: JSON.stringify({ enabled: Boolean(enabled) }),
    }),
    'Не удалось изменить Telegram',
  );
}

export async function sendBookingChatMessage(tenantId, body) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/chat/messages`, {
      tenantId,
      auth: true,
      method: 'POST',
      body: JSON.stringify({ body: String(body || '').trim() }),
    }),
    'Не удалось отправить сообщение',
  );
}

export async function getWebPushConfiguration(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/push/config`, { tenantId, auth: true }),
    'Не удалось проверить Push',
  );
}

export async function saveWebPushSubscription(tenantId, subscription) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/push/subscription`, {
      tenantId,
      auth: true,
      method: 'PUT',
      body: JSON.stringify({ subscription }),
    }),
    'Не удалось подключить Push',
  );
}

export async function deleteWebPushSubscription(tenantId, endpoint) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/push/subscription`, {
      tenantId,
      auth: true,
      method: 'DELETE',
      body: JSON.stringify({ endpoint: String(endpoint || '') }),
    }),
    'Не удалось отключить Push',
  );
}

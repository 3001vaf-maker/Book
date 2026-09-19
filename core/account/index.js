import { API_BASE } from '../environment.js';

function tokenKey(tenantId) {
  return `book.account.token.${String(tenantId || '')}`;
}

function emailKey(tenantId) {
  return `book.account.email.${String(tenantId || '')}`;
}

export function getAccountToken(tenantId) {
  return localStorage.getItem(tokenKey(tenantId)) || '';
}

export function getRememberedAccountEmail(tenantId) {
  return localStorage.getItem(emailKey(tenantId)) || '';
}

export function clearAccount(tenantId) {
  localStorage.removeItem(tokenKey(tenantId));
}

async function request(path, { tenantId = '', auth = false, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (auth) {
    const token = getAccountToken(tenantId);
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

export async function prepareAccount(tenantId, email) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/prepare`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
    'Не удалось проверить аккаунт',
  );
}

export async function registerAccount(tenantId, data) {
  const payload = await jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/register`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
    'Не удалось создать аккаунт',
  );
  return storeSession(tenantId, payload);
}

export async function loginAccount(tenantId, email, password) {
  const payload = await jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
    'Не удалось войти',
  );
  return storeSession(tenantId, payload);
}

export async function getAccount(tenantId) {
  const token = getAccountToken(tenantId);
  if (!token) return null;
  const response = await request(`/online-booking/${encodeURIComponent(tenantId)}/account/me`, { tenantId, auth: true });
  if (response.status === 401) {
    clearAccount(tenantId);
    return null;
  }
  return jsonResponse(response, 'Не удалось открыть аккаунт');
}

export async function updateAccount(tenantId, data) {
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

export async function changeAccountPassword(tenantId, currentPassword, newPassword) {
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

export async function getAccountRequests(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/requests`, { tenantId, auth: true }),
    'Не удалось загрузить записи аккаунта',
  );
}

export async function getAccountConsentState(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/consent-state`, { tenantId, auth: true }),
    'Не удалось проверить согласия',
  );
}

export async function submitAccountConsents(tenantId, consents = []) {
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

export async function revokeAccountConsent(tenantId, documentId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/consents/${encodeURIComponent(documentId)}/revoke`, {
      tenantId,
      auth: true,
      method: 'POST',
    }),
    'Не удалось отозвать согласие',
  );
}

export async function bindAccountTelegramEntry(tenantId, token) {
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

export async function getAccountNotifications(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/notifications`, { tenantId, auth: true }),
    'Не удалось загрузить уведомления',
  );
}

export async function markAccountNotificationRead(tenantId, notificationId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/notifications/${encodeURIComponent(notificationId)}/read`, {
      tenantId,
      auth: true,
      method: 'POST',
    }),
    'Не удалось открыть уведомление',
  );
}

export async function getAccountChat(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/chat`, { tenantId, auth: true }),
    'Не удалось загрузить чат',
  );
}

export async function getAccountChatSettings(tenantId) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/chat/settings`, { tenantId, auth: true }),
    'Не удалось загрузить настройки чата',
  );
}

export async function sendAccountChatMessage(tenantId, body, attachments = []) {
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/chat/messages`, {
      tenantId,
      auth: true,
      method: 'POST',
      body: JSON.stringify({ body: String(body || '').trim(), attachments: Array.isArray(attachments) ? attachments : [] }),
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

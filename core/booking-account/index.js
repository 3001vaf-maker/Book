import { API_BASE } from '../environment.js';

function tokenKey(tenantId) {
  return `book.booking-account.token.${String(tenantId || '')}`;
}

function emailKey(tenantId) {
  return `book.booking-account.email.${String(tenantId || '')}`;
}

function telegramEntryToken() {
  const params = new URLSearchParams(location.search);
  return String(params.get('tg_entry') || params.get('telegram_entry') || '').trim();
}

function clearTelegramEntryFromUrl() {
  const url = new URL(location.href);
  if (!url.searchParams.has('tg_entry') && !url.searchParams.has('telegram_entry')) return;
  url.searchParams.delete('tg_entry');
  url.searchParams.delete('telegram_entry');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function sanitizeAccountData(data = {}) {
  const source = { ...(data || {}) };
  delete source.telegramId;
  delete source.telegramUserId;
  delete source.telegramUsername;
  delete source.first_name;
  delete source.last_name;
  return source;
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
  if (!response.ok) {
    const error = new Error(payload?.message || fallbackMessage);
    error.code = payload?.code || '';
    error.payload = payload;
    throw error;
  }
  return payload;
}

function storeSession(tenantId, payload) {
  if (payload?.accessToken) localStorage.setItem(tokenKey(tenantId), payload.accessToken);
  if (payload?.account?.email) localStorage.setItem(emailKey(tenantId), payload.account.email);
  return payload;
}

async function bindTelegramEntryIfPresent(tenantId) {
  const entry = telegramEntryToken();
  if (!entry || !getBookingAccountToken(tenantId)) return null;
  try {
    const response = await request(`/online-booking/${encodeURIComponent(tenantId)}/account/telegram-entry`, {
      tenantId,
      auth: true,
      method: 'POST',
      body: JSON.stringify({ token: entry }),
    });
    if (!response.ok) {
      if (response.status === 404 || response.status === 409) clearTelegramEntryFromUrl();
      return null;
    }
    const payload = await response.json().catch(() => ({}));
    clearTelegramEntryFromUrl();
    return payload;
  } catch {
    return null;
  }
}

function consentFacts(state = {}) {
  return (Array.isArray(state?.consents) ? state.consents : []).map((item) => ({
    documentId: String(item?.documentId || ''),
    documentVersion: Math.max(1, Number(item?.documentVersion || 1)),
    accepted: Boolean(item?.accepted),
    acceptedAt: item?.accepted ? String(item?.eventAt || '') : '',
    status: String(item?.status || ''),
  })).filter((item) => item.documentId);
}

async function decorateAccountWithConsentState(tenantId, account) {
  if (!account) return null;
  const consentAccess = await getBookingConsentState(tenantId);
  return {
    ...account,
    consents: consentFacts(consentAccess),
    consentAccess,
  };
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

export async function prepareBookingAccount(tenantId, value = {}) {
  const data = typeof value === 'string' ? { email: value } : (value || {});
  return jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/prepare`, {
      method: 'POST',
      body: JSON.stringify({
        email: String(data.email || '').trim().toLowerCase(),
        phone: String(data.phone || '').trim(),
      }),
    }),
    'Не удалось проверить данные',
  );
}

export async function registerBookingAccount(tenantId, data) {
  const payload = await jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/register`, {
      method: 'POST',
      body: JSON.stringify(sanitizeAccountData(data || {})),
    }),
    'Не удалось создать аккаунт',
  );
  storeSession(tenantId, payload);
  await bindTelegramEntryIfPresent(tenantId);
  payload.account = await decorateAccountWithConsentState(tenantId, payload.account);
  return payload;
}

export async function loginBookingAccount(tenantId, email, password) {
  const payload = await jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
    'Не удалось войти',
  );
  storeSession(tenantId, payload);
  await bindTelegramEntryIfPresent(tenantId);
  return payload;
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

export async function getBookingAccount(tenantId) {
  const token = getBookingAccountToken(tenantId);
  if (!token) return null;
  const response = await request(`/online-booking/${encodeURIComponent(tenantId)}/account/me`, { tenantId, auth: true });
  if (response.status === 401) {
    clearBookingAccount(tenantId);
    return null;
  }
  const account = await jsonResponse(response, 'Не удалось открыть аккаунт');
  await bindTelegramEntryIfPresent(tenantId);
  const consentAccess = await getBookingConsentState(tenantId);
  if (!consentAccess?.allowed) return null;
  return {
    ...account,
    consents: consentFacts(consentAccess),
    consentAccess,
  };
}

export async function updateBookingAccount(tenantId, data) {
  const account = await jsonResponse(
    await request(`/online-booking/${encodeURIComponent(tenantId)}/account/me`, {
      tenantId,
      auth: true,
      method: 'PUT',
      body: JSON.stringify(sanitizeAccountData(data || {})),
    }),
    'Не удалось обновить аккаунт',
  );
  await bindTelegramEntryIfPresent(tenantId);
  return decorateAccountWithConsentState(tenantId, account);
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

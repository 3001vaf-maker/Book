import { API_BASE } from './environment.js';
import { clearRuntimePreloads, PROFESSIONAL_RUNTIME_PRELOADS, startRuntimePreload } from './runtime/preload.js';

const TOKEN_KEY = 'book.auth.token';
const PROFESSIONAL_STARTUP_PATHS = [
  [PROFESSIONAL_RUNTIME_PRELOADS.profile, '/profile'],
  [PROFESSIONAL_RUNTIME_PRELOADS.business, '/business-state'],
  [PROFESSIONAL_RUNTIME_PRELOADS.operational, '/business-state/operational'],
  [PROFESSIONAL_RUNTIME_PRELOADS.auxiliary, '/auxiliary-state'],
  [PROFESSIONAL_RUNTIME_PRELOADS.finance, '/finance'],
  [PROFESSIONAL_RUNTIME_PRELOADS.access, '/saas-access/me'],
  [PROFESSIONAL_RUNTIME_PRELOADS.documentBases, '/tenant-document-archive/platform-bases'],
];

function migrateSessionToken() {
  const persistent = localStorage.getItem(TOKEN_KEY) || '';
  if (persistent) return persistent;
  const sessionValue = sessionStorage.getItem(TOKEN_KEY) || '';
  if (!sessionValue) return '';
  localStorage.setItem(TOKEN_KEY, sessionValue);
  sessionStorage.removeItem(TOKEN_KEY);
  return sessionValue;
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || migrateSessionToken();
}

export function setAuthToken(token) {
  const value = String(token || '').trim();
  clearRuntimePreloads();
  sessionStorage.removeItem(TOKEN_KEY);
  if (!value) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, value);
}

export function clearAuthToken() {
  clearRuntimePreloads();
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

function preloadProfessionalRuntime() {
  for (const [key, path] of PROFESSIONAL_STARTUP_PATHS) {
    startRuntimePreload(key, () => apiRequest(path));
  }
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Не удалось войти');
  }

  setAuthToken(payload.accessToken);
  preloadProfessionalRuntime();
  return payload;
}

export async function getCurrentAccount() {
  const token = getAuthToken();
  if (!token) return null;

  const responsePromise = apiRequest('/auth/me');
  preloadProfessionalRuntime();
  const response = await responsePromise;

  if (response.status === 401) {
    clearAuthToken();
    return null;
  }

  if (!response.ok) {
    clearRuntimePreloads();
    throw new Error('Не удалось проверить вход');
  }

  return response.json();
}

export async function changePassword(currentPassword, newPassword) {
  const response = await apiRequest('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Не удалось изменить пароль');
  return payload;
}

export function logout() {
  clearAuthToken();
  window.dispatchEvent(new CustomEvent('book:auth-logout'));
}

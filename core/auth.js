import { API_BASE } from './environment.js';

const runtimePath = typeof globalThis.location?.pathname === 'string' ? globalThis.location.pathname : '';
const TOKEN_KEY = runtimePath.includes('/admin/') ? 'book.admin.auth.token' : 'book.auth.token';
let activeToken = '';

export function getAuthToken() {
  return activeToken || localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setAuthToken(token, remember = false) {
  const value = String(token || '').trim();
  activeToken = value;
  localStorage.setItem(TOKEN_KEY, '');
  sessionStorage.removeItem(TOKEN_KEY);
  if (!value) return;
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, value);
}

export function clearAuthToken() {
  activeToken = '';
  localStorage.setItem(TOKEN_KEY, '');
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export async function login(email, password, remember = false) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Не удалось войти');
  }

  setAuthToken(payload.accessToken, remember);
  return payload;
}

export async function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  const response = await apiRequest('/auth/me');

  if (response.status === 401) {
    clearAuthToken();
    return null;
  }

  if (!response.ok) {
    throw new Error('Не удалось проверить вход');
  }

  return response.json();
}

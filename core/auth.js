const API_BASE = 'https://book-api-volokovykh.amvera.io';
const TOKEN_KEY = 'book.auth.token';
const CLEAN_START_KEY = 'book.production.clean.v2';

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

export function clearAuthToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function prepareProductionWorkspace() {
  if (localStorage.getItem(CLEAN_START_KEY) === '1') return false;

  Object.keys(localStorage)
    .filter((key) => key.startsWith('book.') || key.startsWith('book:'))
    .forEach((key) => localStorage.removeItem(key));

  localStorage.setItem(CLEAN_START_KEY, '1');
  return true;
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

  sessionStorage.setItem(TOKEN_KEY, payload.accessToken);
  return payload;
}

export async function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    clearAuthToken();
    return null;
  }

  if (!response.ok) {
    throw new Error('Не удалось проверить вход');
  }

  return response.json();
}

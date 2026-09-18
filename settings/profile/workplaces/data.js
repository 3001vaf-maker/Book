import { apiRequest } from '../../../core/auth.js';
import { normalizePhoneForStorage } from '../../../core/phone/index.js';

const WORKPLACE_FALLBACK_COLOR = '#212529';
let workplacesState = [];
let serverReady = false;

function normalizeLinks(values) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => value && typeof value === 'object' && !Array.isArray(value))
    .map((value) => ({ type: String(value.type || ''), url: String(value.url || '') }));
}

export function normalizeWorkplace(workplace = {}) {
  return {
    key: String(workplace.key || ''),
    profileId: String(workplace.profileId || 'profile'),
    photo: String(workplace.photo || ''),
    name: String(workplace.name || ''),
    color: String(workplace.color || ''),
    city: String(workplace.city || ''),
    address: String(workplace.address || ''),
    phone: normalizePhoneForStorage(workplace.phone),
    currency: String(workplace.currency || 'RUB'),
    from: String(workplace.from || '09:00'),
    to: String(workplace.to || '18:00'),
    links: normalizeLinks(workplace.links),
    about: String(workplace.about || ''),
    createdAt: String(workplace.createdAt || ''),
    updatedAt: String(workplace.updatedAt || ''),
  };
}

function withPresentationFallback(workplace) {
  return { ...workplace, indicatorColor: workplace.color || WORKPLACE_FALLBACK_COLOR };
}

function requireServerReady() {
  if (!serverReady) throw new Error('Profile + Workplaces ещё не готовы к серверной записи');
}

async function responseJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

export function hydrateWorkplacesFromServer(values = []) {
  workplacesState = (Array.isArray(values) ? values : []).map(normalizeWorkplace);
  return getWorkplaces();
}

export function setWorkplacesServerReady(value) {
  serverReady = Boolean(value);
}

export function isWorkplacesServerReady() {
  return serverReady;
}

export function getWorkplaces() {
  return workplacesState.map((value) => withPresentationFallback(normalizeWorkplace(value)));
}

export async function saveWorkplaces(values) {
  requireServerReady();
  const next = (Array.isArray(values) ? values : []).map(normalizeWorkplace);
  const currentKeys = new Set(workplacesState.map((value) => value.key));
  const nextKeys = new Set(next.map((value) => value.key));

  for (const key of currentKeys) {
    if (nextKeys.has(key)) continue;
    const response = await apiRequest(`/profile/workplaces/${encodeURIComponent(key)}`, { method: 'DELETE' });
    const payload = await responseJson(response, 'Не удалось удалить рабочее место');
    hydrateWorkplacesFromServer(payload.workplaces);
  }
  for (const workplace of next) {
    const response = await apiRequest(`/profile/workplaces/${encodeURIComponent(workplace.key)}`, {
      method: 'PUT',
      body: JSON.stringify(workplace),
    });
    const payload = await responseJson(response, 'Не удалось сохранить рабочее место');
    hydrateWorkplacesFromServer(payload.workplaces);
  }
  return getWorkplaces();
}

export async function upsertWorkplace(workplace) {
  requireServerReady();
  const item = normalizeWorkplace(workplace);
  if (!item.key) throw new Error('У рабочего места отсутствует key');
  const response = await apiRequest(`/profile/workplaces/${encodeURIComponent(item.key)}`, {
    method: 'PUT',
    body: JSON.stringify(item),
  });
  const payload = await responseJson(response, 'Не удалось сохранить рабочее место');
  hydrateWorkplacesFromServer(payload.workplaces);
  return getWorkplaces().find((value) => value.key === item.key) || null;
}

export async function deleteWorkplace(key) {
  requireServerReady();
  const target = String(key || '');
  if (!target) return false;
  const response = await apiRequest(`/profile/workplaces/${encodeURIComponent(target)}`, { method: 'DELETE' });
  if (response.status === 404) return false;
  const payload = await responseJson(response, 'Не удалось удалить рабочее место');
  hydrateWorkplacesFromServer(payload.workplaces);
  return true;
}

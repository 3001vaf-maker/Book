import { apiRequest } from '../../core/auth.js';
import { normalizePhoneForStorage } from '../../core/phone/index.js';

let profileState = null;
let customProfessionsState = [];
let serverReady = false;

function normalizeList(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function normalizePhones(values) {
  return [...new Set(normalizeList(values).map((value) => normalizePhoneForStorage(value)).filter(Boolean))];
}

export function normalizeProfile(profile = {}) {
  const phones = normalizePhones(profile.phones?.length ? profile.phones : [profile.phone]);
  return {
    id: String(profile.id || ''),
    platformAccountId: String(profile.platformAccountId || ''),
    key: String(profile.key || 'profile'),
    name: String(profile.name || ''),
    surname: String(profile.surname || ''),
    phone: phones[0] || '',
    phones,
    telegrams: normalizeList(profile.telegrams),
    emails: normalizeList(profile.emails),
    about: String(profile.about || ''),
    photo: String(profile.photo || ''),
    profession: String(profile.profession || ''),
    experience: String(profile.experience || ''),
    professionAbout: String(profile.professionAbout || ''),
  };
}

function normalizeCustomProfessions(values) {
  return normalizeList(values);
}

async function responseJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

function requireServerReady() {
  if (!serverReady) throw new Error('Profile + Workplaces ещё не готовы к серверной записи');
}

function notifyProfileChanged(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('book:profile-changed', { detail }));
}

export function hydrateProfileFromServer(profile = {}, customProfessions = []) {
  profileState = normalizeProfile(profile);
  customProfessionsState = normalizeCustomProfessions(customProfessions);
  return profileState;
}

export function setProfileServerReady(value) {
  serverReady = Boolean(value);
}

export function isProfileServerReady() {
  return serverReady;
}

export function getProfile() {
  return normalizeProfile(profileState || {});
}

export async function saveProfile(profile) {
  requireServerReady();
  const normalized = normalizeProfile(profile);
  const response = await apiRequest('/profile', {
    method: 'PUT',
    body: JSON.stringify({ profile: normalized, customProfessions: customProfessionsState }),
  });
  const payload = await responseJson(response, 'Не удалось сохранить профиль');
  hydrateProfileFromServer(payload.profile, payload.customProfessions);
  notifyProfileChanged({ action: 'profile-saved' });
  return getProfile();
}

export function getCustomProfessions() {
  return [...customProfessionsState];
}

export async function addCustomProfession(value) {
  requireServerReady();
  const profession = String(value || '').trim();
  if (!profession) return getCustomProfessions();
  const next = customProfessionsState.includes(profession)
    ? customProfessionsState
    : [...customProfessionsState, profession];
  const response = await apiRequest('/profile', {
    method: 'PUT',
    body: JSON.stringify({ profile: getProfile(), customProfessions: next }),
  });
  const payload = await responseJson(response, 'Не удалось сохранить профессию');
  hydrateProfileFromServer(payload.profile, payload.customProfessions);
  notifyProfileChanged({ action: 'profession-saved' });
  return getCustomProfessions();
}

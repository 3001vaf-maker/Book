import { apiRequest } from '../../core/auth.js';
import {
  hasLegacyProfileFacts,
  hydrateProfileFromServer,
  normalizeProfile,
  readLegacyProfileSnapshot,
  setProfileServerReady,
} from './data.js';
import {
  hasLegacyWorkplaceFacts,
  hydrateWorkplacesFromServer,
  normalizeWorkplace,
  readLegacyWorkplacesSnapshot,
  setWorkplacesServerReady,
} from './workplaces/data.js';

function normalizeList(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function normalizeBundle(value = {}) {
  return {
    profile: normalizeProfile(value.profile || {}),
    customProfessions: normalizeList(value.customProfessions),
    workplaces: (Array.isArray(value.workplaces) ? value.workplaces : []).map(normalizeWorkplace),
  };
}

function legacyBundle() {
  const profile = readLegacyProfileSnapshot();
  return normalizeBundle({
    profile: profile.profile,
    customProfessions: profile.customProfessions,
    workplaces: readLegacyWorkplacesSnapshot(),
  });
}

function hasLegacyFacts(bundle) {
  return hasLegacyProfileFacts(bundle) || hasLegacyWorkplaceFacts(bundle.workplaces);
}

function sameBundle(left, right) {
  return JSON.stringify(normalizeBundle(left)) === JSON.stringify(normalizeBundle(right));
}

async function responseJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

function hydrate(bundle, ready) {
  hydrateProfileFromServer(bundle?.profile || {}, bundle?.customProfessions || []);
  hydrateWorkplacesFromServer(bundle?.workplaces || []);
  setProfileServerReady(ready);
  setWorkplacesServerReady(ready);
}

async function verifyLegacy(local, remote) {
  if (!sameBundle(local, remote)) {
    throw new Error('Profile + Workplaces на сервере не совпадают с production-данными браузера');
  }
  const response = await apiRequest('/profile/migrate/verify', {
    method: 'POST',
    body: JSON.stringify(local),
  });
  const verified = await responseJson(response, 'Не удалось подтвердить перенос Profile + Workplaces');
  if (!verified?.verified || !sameBundle(local, verified)) {
    throw new Error('Сервер не подтвердил точность переноса Profile + Workplaces');
  }
  return verified;
}

export async function initializeProfileWorkplaces(account = {}) {
  setProfileServerReady(false);
  setWorkplacesServerReady(false);

  const local = legacyBundle();
  const localHasFacts = hasLegacyFacts(local);
  const remoteResponse = await apiRequest('/profile');
  const remote = await responseJson(remoteResponse, 'Не удалось загрузить Profile + Workplaces');

  if (remote?.verified) {
    hydrate(remote, true);
    return { source: 'server', verified: true };
  }

  if (remote?.migrated) {
    if (!localHasFacts) {
      hydrate(remote, false);
      return { source: 'server-awaiting-verification', verified: false };
    }
    const verified = await verifyLegacy(local, remote);
    hydrate(verified, true);
    return { source: 'legacy-verified', verified: true };
  }

  if (localHasFacts) {
    const migrateResponse = await apiRequest('/profile/migrate', {
      method: 'POST',
      body: JSON.stringify(local),
    });
    const migrated = await responseJson(migrateResponse, 'Не удалось перенести Profile + Workplaces');
    if (!sameBundle(local, migrated)) {
      throw new Error('Перенос Profile + Workplaces остановлен: серверная копия не прошла сверку');
    }
    const verified = await verifyLegacy(local, migrated);
    hydrate(verified, true);
    return { source: 'legacy-migrated', verified: true };
  }

  if (account?.user?.workspaceUnlocked) {
    hydrate(remote, false);
    return { source: 'awaiting-populated-browser', verified: false };
  }

  const bootstrapResponse = await apiRequest('/profile/bootstrap', { method: 'POST' });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверный профиль');
  if (!bootstrapped?.verified) throw new Error('Серверный профиль не подтверждён');
  hydrate(bootstrapped, true);
  return { source: 'server-bootstrap', verified: true };
}

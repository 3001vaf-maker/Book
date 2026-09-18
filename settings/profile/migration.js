import { apiRequest } from '../../core/auth.js';
import { hydrateProfileFromServer, setProfileServerReady } from './data.js';
import { hydrateWorkplacesFromServer, setWorkplacesServerReady } from './workplaces/data.js';

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

function deviceTimeZone() {
  try {
    return String(Intl.DateTimeFormat().resolvedOptions().timeZone || '').trim();
  } catch {
    return '';
  }
}

async function bootstrapProfile() {
  return apiRequest('/profile/bootstrap', {
    method: 'POST',
    body: JSON.stringify({ timeZone: deviceTimeZone() }),
  });
}

async function loadRemoteProfile() {
  const response = await apiRequest('/profile');
  return responseJson(response, 'Не удалось загрузить Profile + Workplaces');
}

export async function initializeProfileWorkplaces() {
  setProfileServerReady(false);
  setWorkplacesServerReady(false);

  const remote = await loadRemoteProfile();

  if (remote?.verified) {
    hydrate(remote, true);
    return { source: 'server', verified: true };
  }

  const bootstrapResponse = await bootstrapProfile();
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось подтвердить серверный профиль');
  if (!bootstrapped?.verified) throw new Error('Серверный профиль не подтверждён');
  hydrate(bootstrapped, true);
  return { source: remote?.migrated ? 'server-reverified' : 'server-bootstrap', verified: true };
}

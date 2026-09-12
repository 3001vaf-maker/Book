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

export async function initializeProfileWorkplaces(account = {}) {
  setProfileServerReady(false);
  setWorkplacesServerReady(false);

  const remoteResponse = await apiRequest('/profile');
  const remote = await responseJson(remoteResponse, 'Не удалось загрузить Profile + Workplaces');

  if (remote?.verified) {
    hydrate(remote, true);
    return { source: 'server', verified: true };
  }

  if (remote?.migrated || account?.user?.workspaceUnlocked) {
    hydrate(remote, false);
    return { source: 'server-awaiting-verification', verified: false };
  }

  const bootstrapResponse = await apiRequest('/profile/bootstrap', { method: 'POST' });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверный профиль');
  if (!bootstrapped?.verified) throw new Error('Серверный профиль не подтверждён');
  hydrate(bootstrapped, true);
  return { source: 'server-bootstrap', verified: true };
}

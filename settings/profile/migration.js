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

async function loadRemoteProfile() {
  const response = await apiRequest('/profile');
  return responseJson(response, 'Не удалось загрузить Profile + Workplaces');
}

function isFreshRegisteredProfile(remote, account) {
  const email = String(account?.user?.email || '').trim().toLowerCase();
  const emails = Array.isArray(remote?.profile?.emails)
    ? remote.profile.emails.map((item) => String(item || '').trim().toLowerCase())
    : [];
  const workplaces = Array.isArray(remote?.workplaces) ? remote.workplaces : [];
  return Boolean(
    remote?.migrated
    && !remote?.verified
    && account?.user?.workspaceUnlocked === false
    && email
    && emails.includes(email)
    && workplaces.length === 0
  );
}

export async function initializeProfileWorkplaces(account = {}) {
  setProfileServerReady(false);
  setWorkplacesServerReady(false);

  let remote = await loadRemoteProfile();

  if (remote?.verified) {
    hydrate(remote, true);
    return { source: 'server', verified: true };
  }

  if (isFreshRegisteredProfile(remote, account)) {
    const verifyResponse = await apiRequest('/profile/migrate/verify', {
      method: 'POST',
      body: JSON.stringify({
        profile: remote.profile,
        customProfessions: remote.customProfessions || [],
        workplaces: remote.workplaces || [],
      }),
    });
    const verified = await responseJson(verifyResponse, 'Не удалось подтвердить профиль нового мастера');
    if (verified?.verified) {
      hydrate(verified, true);
      return { source: 'registration-verify', verified: true };
    }
  }

  if (remote?.migrated) {
    hydrate(remote, false);
    return { source: 'server-awaiting-verification', verified: false };
  }

  if (account?.user?.workspaceUnlocked) {
    hydrate(remote, false);
    return { source: 'server-awaiting-verification', verified: false };
  }

  const bootstrapResponse = await apiRequest('/profile/bootstrap', { method: 'POST' });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверный профиль');
  if (!bootstrapped?.verified) throw new Error('Серверный профиль не подтверждён');
  hydrate(bootstrapped, true);
  return { source: 'server-bootstrap', verified: true };
}

import { apiRequest } from './auth.js';

let currentAccess = {
  tenantId: '',
  status: 'LEGACY_COMPAT',
  isPlatformOwnerWorkspace: false,
  plan: null,
  capabilities: [],
};
let capabilityMap = new Map();
let currentFingerprint = '';
let previousEnabledKeys = [];
let lastAccessChange = { changed: false, newlyEnabled: [], newlyDisabled: [] };

function fingerprint(value) {
  const capabilities = Array.isArray(value?.capabilities)
    ? value.capabilities.map((item) => `${item.key}:${item.enabled}:${item.limit}`).sort()
    : [];
  return JSON.stringify({
    tenantId: value?.tenantId || '',
    status: value?.status || '',
    plan: value?.plan?.key || '',
    capabilities,
  });
}

function enabledBooleanKeys(value) {
  return (Array.isArray(value?.capabilities) ? value.capabilities : [])
    .filter((item) => item?.valueType === 'BOOLEAN' && item.enabled === true)
    .map((item) => String(item.key || '').trim())
    .filter(Boolean)
    .sort();
}

function publishAccessChange() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') return;
  window.dispatchEvent(new CustomEvent('workspace:access-updated', {
    detail: {
      access: currentAccess,
      changed: lastAccessChange.changed,
      newlyEnabled: [...lastAccessChange.newlyEnabled],
      newlyDisabled: [...lastAccessChange.newlyDisabled],
    },
  }));
}

function applyAccess(value) {
  const previousFingerprint = currentFingerprint;
  const hadPreviousAccess = Boolean(previousFingerprint);
  const previousSet = new Set(previousEnabledKeys);

  currentAccess = value && typeof value === 'object' ? value : currentAccess;
  capabilityMap = new Map((Array.isArray(currentAccess.capabilities) ? currentAccess.capabilities : []).map((item) => [item.key, item]));
  currentFingerprint = fingerprint(currentAccess);

  const enabled = enabledBooleanKeys(currentAccess);
  const enabledSet = new Set(enabled);
  lastAccessChange = {
    changed: Boolean(hadPreviousAccess && previousFingerprint !== currentFingerprint),
    newlyEnabled: hadPreviousAccess ? enabled.filter((key) => !previousSet.has(key)) : [],
    newlyDisabled: hadPreviousAccess ? previousEnabledKeys.filter((key) => !enabledSet.has(key)) : [],
  };
  previousEnabledKeys = enabled;
  publishAccessChange();
  return currentAccess;
}

async function requestJson(path, options = {}) {
  const response = await apiRequest(path, { cache: 'no-store', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Не удалось обновить доступы рабочего пространства');
  return payload;
}

async function fetchAccess() {
  return requestJson('/saas-access/me');
}

export async function loadAccess() {
  return applyAccess(await fetchAccess());
}

export async function refreshAccess() {
  const access = await loadAccess();
  return { access, ...lastAccessChange };
}

export async function getPendingCapabilityChanges() {
  return requestJson('/saas-access/changes');
}

export async function acknowledgeCapabilitySummary(batchId) {
  return requestJson(`/saas-access/changes/${encodeURIComponent(batchId)}/ack-summary`, { method: 'POST' });
}

export async function acknowledgeCapabilityIntroduction(eventId) {
  return requestJson(`/saas-access/changes/events/${encodeURIComponent(eventId)}/ack-detail`, { method: 'POST' });
}

export function getLastAccessChange() {
  return {
    changed: lastAccessChange.changed,
    newlyEnabled: [...lastAccessChange.newlyEnabled],
    newlyDisabled: [...lastAccessChange.newlyDisabled],
  };
}

export function getAccess() {
  return currentAccess;
}

export function getCapability(key) {
  return capabilityMap.get(String(key || '').trim()) || null;
}

export function canUseCapability(key) {
  if (currentAccess.status === 'SUSPENDED') return false;
  const capability = getCapability(key);
  if (!capability) return currentAccess.status === 'LEGACY_COMPAT' || currentAccess.isPlatformOwnerWorkspace === true;
  if (capability.valueType !== 'BOOLEAN') return true;
  return capability.enabled === true;
}

export function getLimit(key) {
  if (currentAccess.status === 'SUSPENDED') return 0;
  const capability = getCapability(key);
  if (!capability) return null;
  return capability.valueType === 'LIMIT' ? capability.limit : null;
}

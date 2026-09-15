import { apiRequest } from './auth.js';

const ACCESS_SEEN_PREFIX = 'book.access.seen.';

let currentAccess = {
  tenantId: '',
  status: 'LEGACY_COMPAT',
  isOwnerBook: false,
  plan: null,
  capabilities: [],
};
let capabilityMap = new Map();
let currentFingerprint = '';
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

function seenKey(tenantId) {
  return `${ACCESS_SEEN_PREFIX}${String(tenantId || '').trim()}`;
}

function readSeenCapabilities(tenantId) {
  if (!tenantId) return null;
  try {
    const raw = localStorage.getItem(seenKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : null;
  } catch {
    return null;
  }
}

function writeSeenCapabilities(tenantId, keys) {
  if (!tenantId) return;
  try {
    localStorage.setItem(seenKey(tenantId), JSON.stringify(keys));
  } catch {
    // Access still works when browser storage is unavailable.
  }
}

function publishAccessChange() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') return;
  window.dispatchEvent(new CustomEvent('book:access-updated', {
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
  currentAccess = value && typeof value === 'object' ? value : currentAccess;
  capabilityMap = new Map((Array.isArray(currentAccess.capabilities) ? currentAccess.capabilities : []).map((item) => [item.key, item]));
  currentFingerprint = fingerprint(currentAccess);

  const enabled = enabledBooleanKeys(currentAccess);
  const seen = readSeenCapabilities(currentAccess.tenantId);
  const seenSet = new Set(seen || []);
  const enabledSet = new Set(enabled);
  const newlyEnabled = seen ? enabled.filter((key) => !seenSet.has(key)) : [];
  const newlyDisabled = seen ? seen.filter((key) => !enabledSet.has(key)) : [];
  writeSeenCapabilities(currentAccess.tenantId, enabled);

  lastAccessChange = {
    changed: Boolean(previousFingerprint && previousFingerprint !== currentFingerprint),
    newlyEnabled,
    newlyDisabled,
  };
  publishAccessChange();
  return currentAccess;
}

async function fetchBookAccess() {
  const response = await apiRequest('/saas-access/me', { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Не удалось загрузить доступы Book');
  return payload;
}

export async function loadBookAccess() {
  return applyAccess(await fetchBookAccess());
}

export async function refreshBookAccess() {
  const access = await loadBookAccess();
  return { access, ...lastAccessChange };
}

export function getLastBookAccessChange() {
  return {
    changed: lastAccessChange.changed,
    newlyEnabled: [...lastAccessChange.newlyEnabled],
    newlyDisabled: [...lastAccessChange.newlyDisabled],
  };
}

export function getBookAccess() {
  return currentAccess;
}

export function getBookCapability(key) {
  return capabilityMap.get(String(key || '').trim()) || null;
}

export function canUseBookCapability(key) {
  if (currentAccess.status === 'SUSPENDED') return false;
  const capability = getBookCapability(key);
  if (!capability) return currentAccess.status === 'LEGACY_COMPAT' || currentAccess.isOwnerBook === true;
  if (capability.valueType !== 'BOOLEAN') return true;
  return capability.enabled === true;
}

export function getBookLimit(key) {
  if (currentAccess.status === 'SUSPENDED') return 0;
  const capability = getBookCapability(key);
  if (!capability) return null;
  return capability.valueType === 'LIMIT' ? capability.limit : null;
}

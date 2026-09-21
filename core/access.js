import { apiRequest } from './auth.js';

let currentAccess = {
  tenantId: '',
  status: 'LEGACY_COMPAT',
  isOwnerBook: false,
  commercialMode: '',
  demoActivatedAt: '',
  demoExpiresAt: '',
  plan: null,
  capabilities: [],
};
let capabilityMap = new Map();

function applyAccess(value) {
  currentAccess = value && typeof value === 'object' ? value : currentAccess;
  capabilityMap = new Map((Array.isArray(currentAccess.capabilities) ? currentAccess.capabilities : []).map((item) => [item.key, item]));
  return currentAccess;
}

export async function loadBookAccess() {
  const response = await apiRequest('/saas-access/me');
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Не удалось загрузить доступы');
  return applyAccess(payload);
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


export function canUseRealPersonalData() {
  if (currentAccess.status === 'SUSPENDED') return false;
  if (currentAccess.commercialMode && currentAccess.commercialMode !== 'LIVE') return false;
  return !(Array.isArray(currentAccess.capabilities)
    && currentAccess.capabilities.some((item) => item?.source === 'FIRST_RUN'));
}

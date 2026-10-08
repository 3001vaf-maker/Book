import { apiRequest } from '../auth.js';
import { flushBusinessPersistence, queueAuxiliaryDataset } from '../business-persistence.js';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function responseJson(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

export async function loadLoyaltyServerState() {
  const payload = await responseJson(await apiRequest('/auxiliary-state'), 'Не удалось загрузить Лояльность');
  return clone(payload?.loyalty && typeof payload.loyalty === 'object' && !Array.isArray(payload.loyalty) ? payload.loyalty : {});
}

export function queueLoyaltyState(value = {}) {
  return queueAuxiliaryDataset('loyalty', clone(value) || {});
}

export async function flushLoyaltyPersistence() {
  await flushBusinessPersistence();
}

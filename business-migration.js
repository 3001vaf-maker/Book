import { apiRequest } from './core/auth.js';
import { setBusinessServerReady } from './core/business-persistence.js';
import { hydrateUEIFromServer } from './core/uei.js';
import { hydrateRecordStateFromServer } from './core/record/index.js';
import { hydrateClientsFromServer } from './main/clients/data.js';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeUEI(value = {}) {
  return {
    entities: value?.entities && typeof value.entities === 'object' && !Array.isArray(value.entities) ? clone(value.entities) : {},
    relations: value?.relations && typeof value.relations === 'object' && !Array.isArray(value.relations) ? clone(value.relations) : {},
    revoked: Array.isArray(value?.revoked) ? clone(value.revoked) : [],
  };
}

function normalizeBundle(value = {}) {
  return {
    people: Array.isArray(value.people) ? clone(value.people) : [],
    uei: normalizeUEI(value.uei),
    records: Array.isArray(value.records) ? clone(value.records) : [],
    recordEvents: Array.isArray(value.recordEvents) ? clone(value.recordEvents) : [],
  };
}

async function responseJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

function hydrate(bundle, ready) {
  const normalized = normalizeBundle(bundle);
  hydrateClientsFromServer(normalized.people);
  hydrateUEIFromServer(normalized.uei);
  hydrateRecordStateFromServer({ records: normalized.records, recordEvents: normalized.recordEvents });
  setBusinessServerReady(ready);
}

export async function initializeBusinessState(account = {}) {
  setBusinessServerReady(false);
  const remoteResponse = await apiRequest('/business-state');
  const remote = await responseJson(remoteResponse, 'Не удалось загрузить Клиентов, UEI и Записи');

  if (remote?.verified) {
    hydrate(remote, true);
    return { source: 'server', verified: true };
  }

  if (remote?.migrated || account?.user?.workspaceUnlocked) {
    hydrate(remote, false);
    return { source: 'server-awaiting-verification', verified: false };
  }

  const bootstrapResponse = await apiRequest('/business-state/bootstrap', { method: 'POST' });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище Клиентов, UEI и Записей');
  if (!bootstrapped?.verified) throw new Error('Серверное хранилище Клиентов, UEI и Записей не подтверждено');
  hydrate(bootstrapped, true);
  return { source: 'server-bootstrap', verified: true };
}

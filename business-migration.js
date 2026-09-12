import { apiRequest } from './core/auth.js';
import { setBusinessServerReady } from './core/business-persistence.js';
import { hydrateUEIFromServer, readLegacyUEISnapshot } from './core/uei.js';
import { hydrateRecordStateFromServer, readLegacyRecordSnapshot } from './core/record/index.js';
import { hydrateClientsFromServer, readLegacyClientsSnapshot } from './main/clients/data.js';

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

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

function canonical(value) {
  return JSON.stringify(sortObject(normalizeBundle(value)));
}

function sameBundle(left, right) {
  return canonical(left) === canonical(right);
}

function legacyBundle() {
  const record = readLegacyRecordSnapshot();
  return normalizeBundle({
    people: readLegacyClientsSnapshot(),
    uei: readLegacyUEISnapshot(),
    records: record.records,
    recordEvents: record.recordEvents,
  });
}

function hasFacts(bundle) {
  return Boolean(
    bundle.people.length || bundle.records.length || bundle.recordEvents.length ||
    Object.keys(bundle.uei.entities || {}).length || Object.keys(bundle.uei.relations || {}).length || bundle.uei.revoked.length
  );
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

async function verifyLegacy(local, remote) {
  if (!sameBundle(local, remote)) throw new Error('Клиенты, UEI и записи на сервере не совпадают с production-данными браузера');
  const response = await apiRequest('/business-state/migrate/verify', {
    method: 'POST',
    body: JSON.stringify(local),
  });
  const verified = await responseJson(response, 'Не удалось подтвердить перенос Клиентов, UEI и Записей');
  if (!verified?.verified || !sameBundle(local, verified)) {
    throw new Error('Сервер не подтвердил точность переноса Клиентов, UEI и Записей');
  }
  return verified;
}

export async function initializeBusinessState(account = {}) {
  setBusinessServerReady(false);
  const local = legacyBundle();
  const localHasFacts = hasFacts(local);
  const remoteResponse = await apiRequest('/business-state');
  const remote = await responseJson(remoteResponse, 'Не удалось загрузить Клиентов, UEI и Записи');

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
    const migrateResponse = await apiRequest('/business-state/migrate', {
      method: 'POST',
      body: JSON.stringify(local),
    });
    const migrated = await responseJson(migrateResponse, 'Не удалось перенести Клиентов, UEI и Записи');
    if (!sameBundle(local, migrated)) throw new Error('Перенос остановлен: серверная копия Клиентов, UEI и Записей не прошла сверку');
    const verified = await verifyLegacy(local, migrated);
    hydrate(verified, true);
    return { source: 'legacy-migrated', verified: true };
  }

  if (account?.user?.workspaceUnlocked) {
    hydrate(remote, false);
    return { source: 'awaiting-populated-browser', verified: false };
  }

  const bootstrapResponse = await apiRequest('/business-state/bootstrap', { method: 'POST' });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище Клиентов, UEI и Записей');
  if (!bootstrapped?.verified) throw new Error('Серверное хранилище Клиентов, UEI и Записей не подтверждено');
  hydrate(bootstrapped, true);
  return { source: 'server-bootstrap', verified: true };
}

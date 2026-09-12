import { apiRequest } from './core/auth.js';
import { queueOperationalDataset } from './core/business-persistence.js';
import { hydrateDaysFromServer, readLegacyDaySnapshot } from './core/day/index.js';
import { configureBreakPersistence, hydrateBreaksFromServer, readLegacyBreakSnapshot } from './journal/break-data.js';
import { hydrateProceduresFromServer, readLegacyProcedureSnapshot } from './settings/service/procedures/data.js';
import { hydrateBookingSettingsFromServer, readLegacyBookingSettingsSnapshot } from './core/booking-settings/index.js';

configureBreakPersistence((rows) => queueOperationalDataset('breaks', rows));

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalize(value = {}) {
  return {
    days: Array.isArray(value.days) ? clone(value.days) : [],
    breaks: Array.isArray(value.breaks) ? clone(value.breaks) : [],
    procedures: Array.isArray(value.procedures) ? clone(value.procedures) : [],
    procedureHistory: Array.isArray(value.procedureHistory) ? clone(value.procedureHistory) : [],
    bookingSettings: value.bookingSettings && typeof value.bookingSettings === 'object' && !Array.isArray(value.bookingSettings)
      ? clone(value.bookingSettings)
      : null,
  };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonical(value) {
  return JSON.stringify(stable(normalize(value)));
}

function same(left, right) {
  return canonical(left) === canonical(right);
}

function legacyBundle() {
  const procedure = readLegacyProcedureSnapshot();
  return normalize({
    days: readLegacyDaySnapshot(),
    breaks: readLegacyBreakSnapshot(),
    procedures: procedure.procedures,
    procedureHistory: procedure.procedureHistory,
    bookingSettings: readLegacyBookingSettingsSnapshot(),
  });
}

function hasFacts(value) {
  return Boolean(value.days.length || value.breaks.length || value.procedures.length || value.procedureHistory.length || value.bookingSettings);
}

async function responseJson(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

function hydrate(value) {
  const bundle = normalize(value);
  hydrateDaysFromServer(bundle.days);
  hydrateBreaksFromServer(bundle.breaks);
  hydrateProceduresFromServer({ procedures: bundle.procedures, procedureHistory: bundle.procedureHistory });
  hydrateBookingSettingsFromServer(bundle.bookingSettings);
}

async function verify(local, remote) {
  if (!same(local, remote)) throw new Error('График, перерывы, процедуры и настройки онлайн-записи на сервере не совпадают с данными браузера');
  const response = await apiRequest('/business-state/operational/migrate/verify', {
    method: 'POST',
    body: JSON.stringify(local),
  });
  const verified = await responseJson(response, 'Не удалось подтвердить перенос Графика и онлайн-записи');
  if (!verified?.verified || !same(local, verified)) throw new Error('Сервер не подтвердил точность переноса Графика и онлайн-записи');
  return verified;
}

export async function initializeOperationalState(account = {}) {
  const local = legacyBundle();
  const localHasFacts = hasFacts(local);
  const response = await apiRequest('/business-state/operational');
  const remote = await responseJson(response, 'Не удалось загрузить График, процедуры и настройки онлайн-записи');

  if (remote?.verified) {
    hydrate(remote);
    return { source: 'server', verified: true };
  }

  if (remote?.migrated) {
    if (!localHasFacts) return { source: 'server-awaiting-verification', verified: false };
    const verified = await verify(local, remote);
    hydrate(verified);
    return { source: 'legacy-verified', verified: true };
  }

  if (localHasFacts) {
    const migrateResponse = await apiRequest('/business-state/operational/migrate', {
      method: 'POST',
      body: JSON.stringify(local),
    });
    const migrated = await responseJson(migrateResponse, 'Не удалось перенести График, процедуры и настройки онлайн-записи');
    if (!same(local, migrated)) throw new Error('Перенос Графика и онлайн-записи остановлен: серверная копия не прошла сверку');
    const verified = await verify(local, migrated);
    hydrate(verified);
    return { source: 'legacy-migrated', verified: true };
  }

  if (account?.user?.workspaceUnlocked) return { source: 'awaiting-populated-browser', verified: false };

  const bootstrapResponse = await apiRequest('/business-state/operational/bootstrap', { method: 'POST' });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище Графика и онлайн-записи');
  if (!bootstrapped?.verified) throw new Error('Серверное хранилище Графика и онлайн-записи не подтверждено');
  hydrate(bootstrapped);
  return { source: 'server-bootstrap', verified: true };
}

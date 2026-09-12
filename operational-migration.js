import { apiRequest } from './core/auth.js';
import { queueOperationalDataset } from './core/business-persistence.js';
import { hydrateDaysFromServer } from './core/day/index.js';
import { configureBreakPersistence, hydrateBreaksFromServer } from './journal/break-data.js';
import { hydrateProceduresFromServer } from './settings/service/procedures/data.js';
import { hydrateBookingSettingsFromServer } from './core/booking-settings/index.js';

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

export async function initializeOperationalState(account = {}) {
  const response = await apiRequest('/business-state/operational');
  const remote = await responseJson(response, 'Не удалось загрузить График, процедуры и настройки онлайн-записи');

  if (remote?.verified) {
    hydrate(remote);
    return { source: 'server', verified: true };
  }

  if (remote?.migrated || account?.user?.workspaceUnlocked) {
    return { source: 'server-awaiting-verification', verified: false };
  }

  const bootstrapResponse = await apiRequest('/business-state/operational/bootstrap', { method: 'POST' });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище Графика и онлайн-записи');
  if (!bootstrapped?.verified) throw new Error('Серверное хранилище Графика и онлайн-записи не подтверждено');
  hydrate(bootstrapped);
  return { source: 'server-bootstrap', verified: true };
}

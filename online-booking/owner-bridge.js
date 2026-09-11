import { apiRequest } from '../core/auth.js';
import { getBookingSettings } from '../core/booking-settings/index.js';
import { getDays } from '../core/day/index.js';
import { getRecordPaymentState } from '../core/finance/index.js';
import { createRecord, getRecords } from '../core/record/index.js';
import { getJournalBreaks } from '../journal/break-read.js';
import { findPersonByAccountId, upsertPersonFromBookingAccount } from '../main/clients/data.js';
import { getLatestClientConsent, recordConsent } from '../settings/documents/consents.js';
import { getDocuments } from '../settings/documents/data.js';
import { getProfile } from '../settings/profile/data.js';
import { getWorkplaces } from '../settings/profile/workplaces/data.js';
import { getProcedures } from '../settings/service/procedures/data.js';

const POLL_MS = 4000;
let timer = null;
let running = false;
let lastPublication = '';
let stopListeners = () => {};
const lastSnapshots = new Map();

function safeProfile(profile = {}) {
  return {
    name: String(profile.name || ''),
    surname: String(profile.surname || ''),
    photo: String(profile.photo || ''),
    profession: String(profile.profession || ''),
    about: String(profile.about || ''),
  };
}

function safeWorkplace(workplace = {}) {
  return {
    key: String(workplace.key || ''),
    photo: String(workplace.photo || ''),
    name: String(workplace.name || ''),
    color: String(workplace.color || ''),
    city: String(workplace.city || ''),
    address: String(workplace.address || ''),
    phone: String(workplace.phone || ''),
    currency: String(workplace.currency || 'RUB'),
    from: String(workplace.from || ''),
    to: String(workplace.to || ''),
    about: String(workplace.about || ''),
  };
}

function safeProcedure(procedure = {}) {
  return {
    id: String(procedure.id || ''),
    photo: String(procedure.photo || ''),
    name: String(procedure.name || ''),
    description: String(procedure.description || ''),
    duration: Math.max(0, Number(procedure.duration || 0)),
    breakDuration: Math.max(0, Number(procedure.breakDuration || 0)),
    cost: procedure.cost || {},
    workplaces: Array.isArray(procedure.workplaces) ? procedure.workplaces : [],
  };
}

function safeDay(day = {}) {
  return {
    date: String(day.date || '').slice(0, 10),
    workplaceId: String(day.workplaceId || ''),
    from: String(day.from || ''),
    to: String(day.to || ''),
  };
}

function safeDocument(document = {}) {
  return {
    id: String(document.id || ''),
    title: String(document.title || ''),
    text: String(document.text || ''),
    version: Math.max(1, Number(document.version || 1)),
    required: Boolean(document.required),
    clientConsent: Boolean(document.clientConsent),
  };
}

function publicationData() {
  const records = getRecords()
    .filter((record) => record?.status !== 'cancelled')
    .map((record) => ({
      id: String(record.id || ''),
      type: 'record',
      date: String(record.date || '').slice(0, 10),
      workplaceId: String(record.workplaceId || ''),
      from: String(record.from || ''),
      to: String(record.to || ''),
    }));
  const breaks = getJournalBreaks().map((item) => ({
    id: String(item.id || ''),
    type: 'break',
    date: String(item.date || '').slice(0, 10),
    workplaceId: String(item.workplaceId || ''),
    from: String(item.from || ''),
    to: String(item.to || ''),
  }));

  return {
    profile: safeProfile(getProfile()),
    settings: getBookingSettings(),
    workplaces: getWorkplaces().map(safeWorkplace).filter((item) => item.key),
    procedures: getProcedures().map(safeProcedure).filter((item) => item.id),
    days: getDays().map(safeDay).filter((item) => item.date && item.workplaceId),
    documents: getDocuments().filter((item) => item.clientConsent).map(safeDocument),
    occupancy: [...records, ...breaks].filter((item) => item.date && item.workplaceId && item.from && item.to),
  };
}

async function responseJson(response, fallback = 'Ошибка онлайн-записи') {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

async function publish(force = false) {
  const data = publicationData();
  const serialized = JSON.stringify(data);
  if (!force && serialized === lastPublication) return false;
  const response = await apiRequest('/online-booking/owner/publication', {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });
  await responseJson(response, 'Не удалось опубликовать онлайн-запись');
  lastPublication = serialized;
  return true;
}

async function markImported(requestId, recordId) {
  const response = await apiRequest(`/online-booking/owner/requests/${encodeURIComponent(requestId)}/imported`, {
    method: 'POST',
    body: JSON.stringify({ recordId }),
  });
  await responseJson(response);
}

async function markRejected(requestId) {
  const response = await apiRequest(`/online-booking/owner/requests/${encodeURIComponent(requestId)}/rejected`, {
    method: 'POST',
  });
  await responseJson(response);
}

function persistAccountConsents(person, account = {}) {
  if (!person?.key) return;
  for (const fact of Array.isArray(account.consents) ? account.consents : []) {
    if (!fact?.accepted || !fact?.documentId) continue;
    const documentId = String(fact.documentId);
    const version = Math.max(1, Number(fact.documentVersion || 1));
    const latest = getLatestClientConsent(person.key, documentId);
    if (latest?.status === 'accepted' && Number(latest.documentVersion || 1) === version) continue;
    recordConsent({
      clientId: person.key,
      documentId,
      documentVersion: version,
      status: 'accepted',
      source: 'online-booking-account',
      acceptedAt: String(fact.acceptedAt || new Date().toISOString()),
    });
  }
}

function accountPerson(request = {}) {
  const account = request.account || {};
  const person = upsertPersonFromBookingAccount(account);
  persistAccountConsents(person, account);
  return person;
}

function personSnapshot(person = {}, account = {}) {
  return {
    key: String(person?.key || ''),
    id: String(person?.id || ''),
    accountId: String(account?.id || ''),
    name: String(person?.name || account?.name || ''),
    surname: String(person?.surname || account?.surname || ''),
    phone: String(person?.phones?.[0] || account?.phone || ''),
    email: String(person?.emails?.[0] || account?.email || ''),
    telegramId: String(account?.telegramId || ''),
    discountPercent: Number(person?.discountPercent || 0),
  };
}

async function importRequest(request) {
  const requestId = String(request?.id || '');
  if (!requestId) return false;
  const existing = getRecords().find((record) => String(record?.sourceRequestId || '') === requestId);
  if (existing) {
    await markImported(requestId, existing.id);
    return false;
  }

  const person = accountPerson(request);
  const record = createRecord({
    date: request.date,
    workplaceId: request.workplaceKey,
    from: request.from,
    to: request.to,
    client: personSnapshot(person, request.account || {}),
    procedures: Array.isArray(request.procedures) ? request.procedures : [],
    source: 'online-booking',
    sourceRequestId: requestId,
  });
  if (!record) {
    await markRejected(requestId);
    return false;
  }
  await markImported(requestId, record.id);
  return true;
}

async function pullRequests() {
  const response = await apiRequest('/online-booking/owner/requests');
  const requests = await responseJson(response, 'Не удалось получить онлайн-записи');
  let changed = false;
  for (const request of Array.isArray(requests) ? requests : []) {
    try {
      if (await importRequest(request)) changed = true;
    } catch {
      // The next poll retries the request; canonical Record remains the final import gate.
    }
  }
  return changed;
}

function recordSnapshot(record = {}) {
  const finance = record.finance || {};
  const payment = getRecordPaymentState(record);
  const subtotal = Math.max(0, Number(finance.serviceTotal || 0));
  const total = Math.max(0, Number(finance.planTotal || 0));
  const discountPercent = Math.max(0, Number(finance.discountPercent ?? record?.client?.discountPercent ?? 0));
  return {
    recordId: String(record.id || ''),
    procedures: (Array.isArray(record.procedures) ? record.procedures : []).map((item) => ({
      id: String(item.id || ''),
      name: String(item.name || ''),
      cost: item.cost ?? '',
      duration: Math.max(0, Number(item.duration || 0)),
    })),
    pricing: { subtotal, discountPercent, total },
    payment: {
      state: payment.fullyPaid ? 'paid' : payment.partiallyPaid ? 'partial' : 'unpaid',
      paid: Math.max(0, Number(payment.paidTotal || 0)),
      due: Math.max(0, Number(payment.remaining ?? total)),
    },
    updatedAt: String(record.updatedAt || new Date().toISOString()),
  };
}

async function syncRecordSnapshots() {
  const records = getRecords().filter((record) => record?.source === 'online-booking' && record?.sourceRequestId);
  for (const record of records) {
    const requestId = String(record.sourceRequestId || '');
    const snapshot = recordSnapshot(record);
    const serialized = JSON.stringify(snapshot);
    if (lastSnapshots.get(requestId) === serialized) continue;
    const response = await apiRequest(`/online-booking/owner/requests/${encodeURIComponent(requestId)}/snapshot`, {
      method: 'PUT',
      body: JSON.stringify({ snapshot }),
    });
    await responseJson(response, 'Не удалось обновить карточку записи');
    lastSnapshots.set(requestId, serialized);
  }
}

async function syncAccounts() {
  const response = await apiRequest('/online-booking/owner/accounts');
  const accounts = await responseJson(response, 'Не удалось получить аккаунты онлайн-записи');
  const masterFacts = [];
  for (const account of Array.isArray(accounts) ? accounts : []) {
    const person = upsertPersonFromBookingAccount(account);
    persistAccountConsents(person, account);
    const current = findPersonByAccountId(account.id) || person;
    if (!current) continue;
    masterFacts.push({
      accountId: account.id,
      uei: current.uei || '',
      discountPercent: Number(current.discountPercent || 0),
      visits: Number(current.visits || 0),
      totalSpent: Number(current.totalSpent || 0),
      lastVisit: String(current.lastVisit || ''),
      programs: Array.isArray(current.programs) ? current.programs : [],
    });
  }
  if (!masterFacts.length) return;
  const syncResponse = await apiRequest('/online-booking/owner/accounts/sync', {
    method: 'PUT',
    body: JSON.stringify({ accounts: masterFacts }),
  });
  await responseJson(syncResponse, 'Не удалось обновить данные аккаунтов');
}

async function run() {
  if (running) return;
  running = true;
  try {
    await publish();
    await syncAccounts();
    const changed = await pullRequests();
    await syncRecordSnapshots();
    if (changed) await publish(true);
  } catch {
    // Owner UI keeps working if the public booking server is temporarily unavailable.
  } finally {
    running = false;
  }
}

export function startOnlineBookingBridge() {
  if (timer) return () => stopOnlineBookingBridge();
  void run();
  timer = window.setInterval(() => void run(), POLL_MS);
  const refresh = () => void run();
  window.addEventListener('book:records-changed', refresh);
  window.addEventListener('book:time-usage-changed', refresh);
  window.addEventListener('book:booking-settings-changed', refresh);
  document.addEventListener('visibilitychange', refresh);
  stopListeners = () => {
    window.removeEventListener('book:records-changed', refresh);
    window.removeEventListener('book:time-usage-changed', refresh);
    window.removeEventListener('book:booking-settings-changed', refresh);
    document.removeEventListener('visibilitychange', refresh);
  };
  return () => stopOnlineBookingBridge();
}

export function stopOnlineBookingBridge() {
  if (timer) window.clearInterval(timer);
  timer = null;
  stopListeners();
  stopListeners = () => {};
}

export { publicationData as buildOnlineBookingPublication };
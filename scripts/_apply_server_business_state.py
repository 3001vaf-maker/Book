from pathlib import Path
import json


def write(path, content):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:100]}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# ---------------------------------------------------------------------------
# Frontend server persistence queue.
# ---------------------------------------------------------------------------
write('core/business-persistence.js', r'''import { apiRequest } from './auth.js';

let serverReady = false;
let running = false;
let lastError = null;
const queue = [];
const idleWaiters = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function responseJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

function reportError(error) {
  lastError = error instanceof Error ? error : new Error(String(error || 'Ошибка серверного сохранения'));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('book:business-persistence-error', { detail: { message: lastError.message } }));
  }
}

function resolveIdle() {
  if (queue.length || running) return;
  while (idleWaiters.length) idleWaiters.shift()?.();
}

async function send(item) {
  const response = await apiRequest(item.path, {
    ...item.options,
    keepalive: true,
  });
  return responseJson(response, item.fallbackMessage);
}

async function runQueue() {
  if (running || !serverReady) return;
  running = true;
  try {
    while (serverReady && queue.length) {
      const item = queue[0];
      try {
        await send(item);
        queue.shift();
        lastError = null;
        item.resolve?.();
      } catch (error) {
        reportError(error);
        await sleep(1200);
      }
    }
  } finally {
    running = false;
    resolveIdle();
    if (serverReady && queue.length) void runQueue();
  }
}

function enqueue(path, options, fallbackMessage) {
  if (!serverReady) return Promise.resolve();
  let resolve;
  const done = new Promise((doneResolve) => { resolve = doneResolve; });
  queue.push({ path, options, fallbackMessage, resolve });
  void runQueue();
  return done;
}

export function setBusinessServerReady(value) {
  serverReady = Boolean(value);
  if (serverReady) void runQueue();
}

export function isBusinessServerReady() {
  return serverReady;
}

export function getBusinessPersistenceError() {
  return lastError;
}

export function queuePersonUpsert(person, position = 0) {
  const key = String(person?.key || '').trim();
  if (!key) return Promise.resolve();
  return enqueue(`/business-state/people/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ person, position }),
  }, 'Не удалось сохранить клиента на сервере');
}

export function queuePersonDelete(key) {
  const id = String(key || '').trim();
  if (!id) return Promise.resolve();
  return enqueue(`/business-state/people/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Не удалось удалить клиента на сервере');
}

export function queueUEIStore(uei) {
  return enqueue('/business-state/uei', {
    method: 'PUT',
    body: JSON.stringify({ uei }),
  }, 'Не удалось сохранить UEI на сервере');
}

export function queueRecordUpsert(record, position = 0) {
  const id = String(record?.id || '').trim();
  if (!id) return Promise.resolve();
  return enqueue(`/business-state/records/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ record, position }),
  }, 'Не удалось сохранить запись на сервере');
}

export function queueRecordDelete(id) {
  const recordId = String(id || '').trim();
  if (!recordId) return Promise.resolve();
  return enqueue(`/business-state/records/${encodeURIComponent(recordId)}`, { method: 'DELETE' }, 'Не удалось удалить запись на сервере');
}

export function queueRecordEventUpsert(event, position = 0) {
  const id = String(event?.id || '').trim();
  if (!id) return Promise.resolve();
  return enqueue(`/business-state/record-events/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ event, position }),
  }, 'Не удалось сохранить историю записи на сервере');
}

export function queueRecordEventsDelete(recordId) {
  const id = String(recordId || '').trim();
  if (!id) return Promise.resolve();
  return enqueue(`/business-state/records/${encodeURIComponent(id)}/events`, { method: 'DELETE' }, 'Не удалось удалить историю записи на сервере');
}

export async function flushBusinessPersistence({ timeoutMs = 12000 } = {}) {
  if (!serverReady || (!queue.length && !running)) return;
  let timer;
  await Promise.race([
    new Promise((resolve) => {
      idleWaiters.push(resolve);
      resolveIdle();
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(lastError || new Error('Серверное сохранение не завершено')), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}
''')


# ---------------------------------------------------------------------------
# Clients/Person: runtime state comes from server after bootstrap; localStorage
# remains read-only legacy migration input.
# ---------------------------------------------------------------------------
write('main/clients/data.js', r'''import { normalizePhoneForStorage, phonesMatch } from '../../core/phone/index.js';
import { getMembers, getUEI } from '../../core/uei.js';
import { queuePersonDelete, queuePersonUpsert } from '../../core/business-persistence.js';
import { getTags } from '../../settings/tags/data.js';
import { getLatestClientConsent, migrateLegacyConsents } from '../../settings/documents/consents.js';

const STORAGE_KEY = 'book.people';
let peopleState = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readLegacyClients() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readStoredClients() {
  return peopleState === null ? readLegacyClients() : clone(peopleState);
}

function normalizeTagAssignments(values = []) {
  const catalog = getTags();
  const ids = new Set(catalog.map((tag) => tag.id));
  const byName = new Map(catalog.map((tag) => [tag.name, tag.id]));
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => ids.has(value) ? value : (byName.get(value) || String(value || '').trim()))
    .filter(Boolean))];
}

function normalizeDiscount(person = {}) {
  const raw = person.discountPercent ?? person.discount ?? 0;
  const value = Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function normalizePhones(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizePhoneForStorage(value))
    .filter(Boolean))];
}

function normalizeStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

export function normalizeClient(person = {}) {
  return {
    key: String(person.key || ''),
    id: String(person.id || ''),
    name: String(person.name || ''),
    surname: String(person.surname || ''),
    photo: String(person.photo || ''),
    gender: String(person.gender || ''),
    birthDate: String(person.birthDate || ''),
    phones: normalizePhones(person.phones),
    telegrams: Array.isArray(person.telegrams) ? person.telegrams : [],
    emails: normalizeStrings(person.emails),
    accounts: normalizeStrings(person.accounts),
    links: Array.isArray(person.links) ? person.links : [],
    tags: normalizeTagAssignments(person.tags),
    discountPercent: normalizeDiscount(person),
    agreements: {
      personalData: Boolean(person.agreements?.personalData),
      mailings: Boolean(person.agreements?.mailings),
    },
    visits: Number(person.visits || 0),
    totalSpent: Number(person.totalSpent || 0),
    lastVisit: String(person.lastVisit || ''),
    programs: Array.isArray(person.programs) ? person.programs : [],
    createdAt: String(person.createdAt || ''),
  };
}

export function readLegacyClientsSnapshot() {
  return readLegacyClients().map(normalizeClient).filter((person) => person.key);
}

export function hasLegacyClientFacts(people = readLegacyClientsSnapshot()) {
  return Array.isArray(people) && people.length > 0;
}

export function hydrateClientsFromServer(people = []) {
  peopleState = (Array.isArray(people) ? people : []).map(normalizeClient).filter((person) => person.key);
  return clone(peopleState);
}

function accepted(fact) {
  return Boolean(fact && fact.status === 'accepted');
}

export function getAllClients() {
  const stored = readStoredClients().map(normalizeClient).filter((person) => person.key);
  migrateLegacyConsents(stored);
  return stored.map((person) => ({
    ...person,
    agreements: {
      personalData: accepted(getLatestClientConsent(person.key, 'pdn-consent')),
      mailings: accepted(getLatestClientConsent(person.key, 'messages-consent')),
    },
    uei: getUEI('person', person.key) || '',
  }));
}

export function getClients() {
  const people = getAllClients();
  const linkedSecondary = new Set();

  for (const person of people) {
    if (!person.uei) continue;
    const members = getMembers(person.uei);
    members.slice(1).forEach((member) => {
      linkedSecondary.add(member.startsWith('person:') ? member.slice(7) : member);
    });
  }

  return people.filter((person) => !linkedSecondary.has(person.key));
}

function personKeyFromUEIMember(member) {
  const value = String(member || '');
  if (value.startsWith('person:')) return value.slice(7);
  if (!value.includes(':')) return value;
  return '';
}

function identityKeysForUEI(uei, people = []) {
  if (!uei) return [];
  const known = new Set(people.map((person) => person.key));
  return [...new Set(getMembers(uei)
    .map(personKeyFromUEIMember)
    .filter((key) => key && known.has(key)))];
}

export function getIdentityMemberKeys(key) {
  const target = String(key || '').trim();
  if (!target) return [];
  const people = getAllClients();
  const person = people.find((item) => item.key === target);
  if (!person) return [target];
  if (!person.uei) return [target];
  const keys = identityKeysForUEI(person.uei, people);
  return keys.length ? keys : [target];
}

export function getIdentityPeople(key) {
  const keys = new Set(getIdentityMemberKeys(key));
  if (!keys.size) return [];
  return getAllClients().filter((person) => keys.has(person.key));
}

export function getIdentityOwner(key) {
  return getIdentityPeople(key)[0] || null;
}

export function findIdentityOwnerByAccountId(accountId) {
  const person = findPersonByAccountId(accountId);
  return person ? (getIdentityOwner(person.key) || person) : null;
}

export function findPeopleByPhone(phone) {
  const target = String(phone || '').trim();
  if (!target) return [];
  return getAllClients().filter((person) => (person.phones || []).some((value) => phonesMatch(value, target)));
}

export function findPersonByAccountId(accountId) {
  const id = String(accountId || '').trim();
  if (!id) return null;
  return getAllClients().find((person) => (person.accounts || []).includes(id)) || null;
}

export function getClientCount() {
  return getClients().length;
}

export function saveClients(people = []) {
  const normalized = (Array.isArray(people) ? people : []).map(normalizeClient).filter((person) => person.key);
  if (peopleState === null) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return;
  }

  const previous = peopleState;
  const previousByKey = new Map(previous.map((person, position) => [person.key, { person, position }]));
  const nextByKey = new Map(normalized.map((person, position) => [person.key, { person, position }]));
  peopleState = clone(normalized);

  for (const [key] of previousByKey) {
    if (!nextByKey.has(key)) void queuePersonDelete(key);
  }
  for (const [key, next] of nextByKey) {
    const before = previousByKey.get(key);
    if (!before || before.position !== next.position || JSON.stringify(before.person) !== JSON.stringify(next.person)) {
      void queuePersonUpsert(next.person, next.position);
    }
  }
}

export function createClient(name, surname, phone = '') {
  const normalizedPhone = normalizePhoneForStorage(phone);
  return normalizeClient({
    key: crypto.randomUUID(),
    name,
    surname,
    phones: normalizedPhone ? [normalizedPhone] : [],
    createdAt: new Date().toISOString(),
  });
}

export function upsertPersonFromBookingAccount(account = {}) {
  const accountId = String(account.id || '').trim();
  if (!accountId) return null;
  const people = getAllClients();
  const existingIndex = people.findIndex((person) => (person.accounts || []).includes(accountId));
  const previous = existingIndex >= 0 ? people[existingIndex] : null;
  const phone = normalizePhoneForStorage(account.phone);
  const telegramId = String(account.telegramId || '').trim();
  const email = String(account.email || '').trim().toLowerCase();
  const profileData = account.profileData && typeof account.profileData === 'object' ? account.profileData : {};
  const incomingGender = String(profileData.gender || '').trim();
  const incomingBirthDate = String(profileData.birthDate || '').trim();
  const person = normalizeClient({
    ...(previous || {}),
    key: previous?.key || `account-${accountId}`,
    name: String(account.name || previous?.name || ''),
    surname: String(account.surname || previous?.surname || ''),
    gender: incomingGender || previous?.gender || '',
    birthDate: incomingBirthDate || previous?.birthDate || '',
    phones: phone ? [...(previous?.phones || []), phone] : previous?.phones || [],
    telegrams: telegramId ? [...(previous?.telegrams || []), telegramId] : previous?.telegrams || [],
    emails: email ? [...(previous?.emails || []), email] : previous?.emails || [],
    accounts: [...(previous?.accounts || []), accountId],
    programs: previous?.programs || [],
    createdAt: previous?.createdAt || new Date().toISOString(),
  });
  if (existingIndex >= 0) people[existingIndex] = person;
  else people.push(person);
  saveClients(people);
  return getAllClients().find((item) => item.key === person.key) || person;
}
''')


# ---------------------------------------------------------------------------
# UEI keeps its canonical rules but persists to the server-owned state after
# migration. Legacy localStorage stays only as migration input / test fallback.
# ---------------------------------------------------------------------------
write('core/uei.js', r'''import { queueUEIStore } from './business-persistence.js';

const STORAGE_KEY = 'book.uei';
const EMPTY = '0000';
const MAX_LENGTH = 4;
const ALLOWED = /^[A-Za-zА-Яа-яЁё0-9]+$/;
let storeState = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeStore(value = {}) {
  return {
    entities: value.entities && typeof value.entities === 'object' && !Array.isArray(value.entities) ? clone(value.entities) : {},
    relations: value.relations && typeof value.relations === 'object' && !Array.isArray(value.relations) ? clone(value.relations) : {},
    revoked: Array.isArray(value.revoked) ? clone(value.revoked) : [],
  };
}

function readLegacyStore() {
  try {
    return normalizeStore(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return normalizeStore();
  }
}

function readStore() {
  return storeState === null ? readLegacyStore() : clone(storeState);
}

function writeStore(store) {
  const normalized = normalizeStore(store);
  if (storeState === null) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return;
  }
  storeState = clone(normalized);
  void queueUEIStore(normalized);
}

export function readLegacyUEISnapshot() {
  return readLegacyStore();
}

export function hydrateUEIFromServer(value = {}) {
  storeState = normalizeStore(value);
  return clone(storeState);
}

function relationKey(type, id) { return `${String(type)}:${String(id)}`; }

export function normalizeUEI(value) {
  const source = String(value ?? '').trim();
  if (!source) return EMPTY;
  if (source.length > MAX_LENGTH) throw Error('UEI должен содержать не более 4 символов.');
  if (!ALLOWED.test(source)) throw Error('UEI может содержать только цифры и латинские или кириллические буквы.');
  const normalized = source.toUpperCase().padStart(MAX_LENGTH, '0');
  return normalized === EMPTY ? EMPTY : normalized;
}

export function isValidUEI(value) {
  try { return normalizeUEI(value) !== EMPTY; } catch { return false; }
}

function ensureEntity(store, uei, entityType, entityId) {
  const entity = store.entities[uei] || { uei, owner: null, members: [], history: [], reserved: true };
  if (!entity.owner) entity.owner = { type: entityType, id: entityId };
  if (!entity.members.includes(relationKey(entityType, entityId))) entity.members.push(relationKey(entityType, entityId));
  store.entities[uei] = entity;
  return entity;
}

function recordHistory(entity, entityType, entityId, identifiers = []) {
  const key = relationKey(entityType, entityId);
  const existing = entity.history.find(item => item.key === key);
  const values = [...new Set((identifiers || []).map(v => String(v || '').trim()).filter(Boolean))];
  if (!existing) entity.history.push({ key, type: entityType, id: entityId, identifiers: values });
  else existing.identifiers = [...new Set([...(existing.identifiers || []), ...values])];
}

function addRevocation(store, entityType, entityId, uei) {
  const item = { key: relationKey(entityType, entityId), uei };
  if (!store.revoked.some(x => x.key === item.key && x.uei === item.uei)) store.revoked.push(item);
}

export function listUEIs() {
  return Object.values(readStore().entities)
    .filter(entity => entity && entity.uei && entity.uei !== EMPTY)
    .sort((a, b) => a.uei.localeCompare(b.uei));
}

export function getUEI(entityType, entityId) { return readStore().relations[relationKey(entityType, entityId)] || ''; }

export function getMembers(uei) {
  const normalized = normalizeUEI(uei);
  if (normalized === EMPTY) return [];
  return [...(readStore().entities[normalized]?.members || [])];
}

export function getOptions(entityType, entityId) {
  const current = getUEI(entityType, entityId);
  return listUEIs().filter(entity => entity.uei !== current).map(entity => ({ value: entity.uei, label: entity.uei }));
}

export function createUEI({ entityType, entityId, value, identifiers = [] } = {}) {
  const uei = normalizeUEI(value);
  if (uei === EMPTY) throw Error('0000 не является действительным UEI.');
  const store = readStore();
  if (store.entities[uei]) throw Error('Этот UEI уже существует. Для связи с существующим UEI используйте поле «Связать».');
  const key = relationKey(entityType, entityId);
  if (store.relations[key]) throw Error('Профиль уже связан с UEI.');
  const entity = ensureEntity(store, uei, entityType, entityId);
  recordHistory(entity, entityType, entityId, identifiers);
  store.relations[key] = uei;
  writeStore(store);
  return uei;
}

export function linkUEI({ entityType, entityId, value, identifiers = [] } = {}) {
  const uei = normalizeUEI(value);
  if (uei === EMPTY) throw Error('0000 не является действительным UEI.');
  const store = readStore();
  if (!store.entities[uei]) throw Error('Такого UEI ещё нет. Сначала создайте его.');
  const key = relationKey(entityType, entityId);
  const current = store.relations[key] || '';
  if (current === uei) return uei;
  if (current && store.entities[current]) store.entities[current].members = store.entities[current].members.filter(member => member !== key);
  const entity = ensureEntity(store, uei, entityType, entityId);
  recordHistory(entity, entityType, entityId, identifiers);
  store.relations[key] = uei;
  writeStore(store);
  return uei;
}

export function detachUEI({ entityType, entityId, uei, explicit = true } = {}) {
  const normalized = normalizeUEI(uei || getUEI(entityType, entityId));
  if (normalized === EMPTY) return '';
  const store = readStore();
  const key = relationKey(entityType, entityId);
  if (store.relations[key] !== normalized) return store.relations[key] || '';
  const entity = store.entities[normalized];
  if (entity) {
    entity.members = entity.members.filter(member => member !== key);
    recordHistory(entity, entityType, entityId, []);
    if (entity.owner?.type === entityType && entity.owner?.id === entityId) {
      const nextOwner = entity.members[0] || null;
      if (nextOwner) {
        const separator = nextOwner.indexOf(':');
        entity.owner = { type: nextOwner.slice(0, separator), id: nextOwner.slice(separator + 1) };
      }
    }
  }
  delete store.relations[key];
  if (explicit) addRevocation(store, entityType, entityId, normalized);
  writeStore(store);
  return '';
}

export function findHistoricalUEI(entityType, identifier) {
  const needle = String(identifier || '').trim();
  if (!needle) return '';
  const store = readStore();
  for (const entity of Object.values(store.entities)) {
    if (entity.uei === EMPTY) continue;
    const match = (entity.history || []).some(item => item.type === entityType && (item.identifiers || []).includes(needle));
    if (match) return entity.uei;
  }
  return '';
}

export function applyUEI({ entityType, entityId, currentUEI = '', value = '', linkValue = '', identifiers = [] } = {}) {
  const current = normalizeUEI(currentUEI);

  if (linkValue) {
    return { uei: linkUEI({ entityType, entityId, value: linkValue, identifiers }), linked: true };
  }

  if (value && normalizeUEI(value) !== EMPTY) {
    const requested = normalizeUEI(value);
    if (current === requested) return { uei: requested };
    if (current !== EMPTY) detachUEI({ entityType, entityId, uei: current, explicit: false });
    return { uei: createUEI({ entityType, entityId, value: requested, identifiers }), created: true };
  }

  if (current !== EMPTY) {
    return { uei: detachUEI({ entityType, entityId, uei: current, explicit: true }) };
  }

  return { uei: '' };
}

export function clearTestState() {
  if (storeState === null) localStorage.removeItem(STORAGE_KEY);
  else writeStore(normalizeStore());
}
''')


# ---------------------------------------------------------------------------
# Record persistence gateway: synchronous runtime cache + server write queue.
# ---------------------------------------------------------------------------
write('core/record/data.js', r'''// Persistence gateway for Record facts.
// Runtime reads are synchronous from an in-memory cache hydrated from the server.
// localStorage is retained only as legacy migration/test fallback.
import {
  queueRecordDelete,
  queueRecordEventUpsert,
  queueRecordEventsDelete,
  queueRecordUpsert,
} from '../business-persistence.js';

const RECORDS_KEY = 'book.records';
const EVENTS_KEY = 'book.recordEvents';
let recordRowsState = null;
let eventRowsState = null;

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function readLegacyRows(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readRows(key) {
  if (key === RECORDS_KEY && recordRowsState !== null) return clone(recordRowsState);
  if (key === EVENTS_KEY && eventRowsState !== null) return clone(eventRowsState);
  return readLegacyRows(key);
}

function writeRows(key, rows) {
  const normalized = Array.isArray(rows) ? clone(rows) : [];
  if (key === RECORDS_KEY && recordRowsState !== null) {
    recordRowsState = normalized;
    return;
  }
  if (key === EVENTS_KEY && eventRowsState !== null) {
    eventRowsState = normalized;
    return;
  }
  localStorage.setItem(key, JSON.stringify(normalized));
}

function normalizeId(value) {
  return String(value || '');
}

export function readLegacyRecordSnapshot() {
  return {
    records: readLegacyRows(RECORDS_KEY).map((row) => clone(row)),
    recordEvents: readLegacyRows(EVENTS_KEY).map((row) => clone(row)),
  };
}

export function hydrateRecordStateFromServer({ records = [], recordEvents = [] } = {}) {
  recordRowsState = (Array.isArray(records) ? records : []).map((row) => clone(row));
  eventRowsState = (Array.isArray(recordEvents) ? recordEvents : []).map((row) => clone(row));
  return { records: clone(recordRowsState), recordEvents: clone(eventRowsState) };
}

export function getRecordRows() {
  return readRows(RECORDS_KEY).map((row) => clone(row));
}

export function getRecordRow(id) {
  const recordId = normalizeId(id);
  const row = readRows(RECORDS_KEY).find((item) => normalizeId(item?.id) === recordId) || null;
  return clone(row);
}

export function insertRecordRow(row = null) {
  if (!row?.id || getRecordRow(row.id)) return null;
  const rows = readRows(RECORDS_KEY);
  const stored = clone(row);
  rows.push(stored);
  writeRows(RECORDS_KEY, rows);
  if (recordRowsState !== null) void queueRecordUpsert(stored, rows.length - 1);
  return clone(stored);
}

export function patchRecordRow(id, patch = {}) {
  const recordId = normalizeId(id);
  const rows = readRows(RECORDS_KEY);
  const index = rows.findIndex((item) => normalizeId(item?.id) === recordId);
  if (index < 0) return null;
  rows[index] = { ...rows[index], ...clone(patch) };
  writeRows(RECORDS_KEY, rows);
  if (recordRowsState !== null) void queueRecordUpsert(rows[index], index);
  return clone(rows[index]);
}

export function deleteRecordRow(id) {
  const recordId = normalizeId(id);
  const rows = readRows(RECORDS_KEY);
  const index = rows.findIndex((item) => normalizeId(item?.id) === recordId);
  if (index < 0) return null;
  const [removed] = rows.splice(index, 1);
  writeRows(RECORDS_KEY, rows);
  if (recordRowsState !== null) void queueRecordDelete(recordId);
  return clone(removed);
}

export function getRecordEventRows(recordId = '') {
  const id = normalizeId(recordId);
  return readRows(EVENTS_KEY)
    .filter((row) => !id || normalizeId(row?.recordId) === id)
    .map((row) => clone(row));
}

export function insertRecordEventRow(row = null) {
  if (!row?.id || !row?.recordId) return null;
  const rows = readRows(EVENTS_KEY);
  if (rows.some((item) => normalizeId(item?.id) === normalizeId(row.id))) return null;
  const stored = clone(row);
  rows.push(stored);
  writeRows(EVENTS_KEY, rows);
  if (eventRowsState !== null) void queueRecordEventUpsert(stored, rows.length - 1);
  return clone(stored);
}

export function deleteRecordEventRows(recordId) {
  const id = normalizeId(recordId);
  if (!id) return 0;
  const rows = readRows(EVENTS_KEY);
  const next = rows.filter((row) => normalizeId(row?.recordId) !== id);
  const removed = rows.length - next.length;
  if (removed) {
    writeRows(EVENTS_KEY, next);
    if (eventRowsState !== null) void queueRecordEventsDelete(id);
  }
  return removed;
}
''')


# ---------------------------------------------------------------------------
# Safe migration/bootstrap of people + UEI + Record facts.
# ---------------------------------------------------------------------------
write('core/business-migration.js', r'''import { apiRequest } from './auth.js';
import { setBusinessServerReady } from './business-persistence.js';
import { hydrateUEIFromServer, readLegacyUEISnapshot } from './uei.js';
import { hydrateRecordStateFromServer, readLegacyRecordSnapshot } from './record/data.js';
import { hydrateClientsFromServer, readLegacyClientsSnapshot } from '../main/clients/data.js';

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
''')


# Core startup: business facts must be hydrated before online bridge or UI.
replace_once(
    'core.js',
    "import { initializeProfileWorkplaces } from './settings/profile/migration.js';\n",
    "import { initializeProfileWorkplaces } from './settings/profile/migration.js';\nimport { initializeBusinessState } from './core/business-migration.js';\n",
)
replace_once(
    'core.js',
    "  const migration = await initializeProfileWorkplaces(authenticatedAccount);\n  if (!migration.verified) {\n    renderMigrationPending();\n    return;\n  }\n  ensureBookingBridge();\n",
    "  const migration = await initializeProfileWorkplaces(authenticatedAccount);\n  if (!migration.verified) {\n    renderMigrationPending();\n    return;\n  }\n  const businessMigration = await initializeBusinessState(authenticatedAccount);\n  if (!businessMigration.verified) {\n    renderMigrationPending();\n    return;\n  }\n  ensureBookingBridge();\n",
)


# Online booking import is acknowledged only after canonical Person/Record facts
# have reached the server persistence layer.
replace_once(
    'online-booking/owner-bridge.js',
    "import { apiRequest } from '../core/auth.js';\n",
    "import { apiRequest } from '../core/auth.js';\nimport { flushBusinessPersistence } from '../core/business-persistence.js';\n",
)
replace_once(
    'online-booking/owner-bridge.js',
    "  if (existing) {\n    await markImported(requestId, existing.id);\n    return false;\n  }\n",
    "  if (existing) {\n    await flushBusinessPersistence();\n    await markImported(requestId, existing.id);\n    return false;\n  }\n",
)
replace_once(
    'online-booking/owner-bridge.js',
    "  if (!record) {\n    await markRejected(requestId);\n    return false;\n  }\n  await markImported(requestId, record.id);\n",
    "  if (!record) {\n    await markRejected(requestId);\n    return false;\n  }\n  await flushBusinessPersistence();\n  await markImported(requestId, record.id);\n",
)
replace_once(
    'online-booking/owner-bridge.js',
    "  if (!masterFacts.length) return;\n  const syncResponse = await apiRequest('/online-booking/owner/accounts/sync', {\n",
    "  if (!masterFacts.length) return;\n  await flushBusinessPersistence();\n  const syncResponse = await apiRequest('/online-booking/owner/accounts/sync', {\n",
)


# ---------------------------------------------------------------------------
# Server relational persistence owner.
# ---------------------------------------------------------------------------
write('server/src/business-state/business-state.module.ts', r'''import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { BusinessStateController } from './business-state.controller';
import { BusinessStateService } from './business-state.service';

@Module({
  imports: [AuthModule],
  controllers: [BusinessStateController],
  providers: [BusinessStateService, PrismaService],
})
export class BusinessStateModule {}
''')

write('server/src/business-state/business-state.controller.ts', r'''import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BusinessStateService } from './business-state.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('business-state')
@UseGuards(JwtAuthGuard)
export class BusinessStateController {
  constructor(private readonly businessState: BusinessStateService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.businessState.get(request.auth!.tenantId);
  }

  @Post('migrate')
  migrate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.businessState.migrate(request.auth!.tenantId, body);
  }

  @Post('migrate/verify')
  verify(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.businessState.verifyMigration(request.auth!.tenantId, body);
  }

  @Post('bootstrap')
  bootstrap(@Req() request: AuthenticatedRequest) {
    return this.businessState.bootstrap(request.auth!.tenantId);
  }

  @Put('people/:key')
  upsertPerson(@Req() request: AuthenticatedRequest, @Param('key') key: string, @Body() body: unknown) {
    return this.businessState.upsertPerson(request.auth!.tenantId, key, body);
  }

  @Delete('people/:key')
  deletePerson(@Req() request: AuthenticatedRequest, @Param('key') key: string) {
    return this.businessState.deletePerson(request.auth!.tenantId, key);
  }

  @Put('uei')
  updateUEI(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.businessState.updateUEI(request.auth!.tenantId, body);
  }

  @Put('records/:recordId')
  upsertRecord(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string, @Body() body: unknown) {
    return this.businessState.upsertRecord(request.auth!.tenantId, recordId, body);
  }

  @Delete('records/:recordId')
  deleteRecord(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string) {
    return this.businessState.deleteRecord(request.auth!.tenantId, recordId);
  }

  @Delete('records/:recordId/events')
  deleteRecordEvents(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string) {
    return this.businessState.deleteRecordEvents(request.auth!.tenantId, recordId);
  }

  @Put('record-events/:eventId')
  upsertRecordEvent(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: unknown) {
    return this.businessState.upsertRecordEvent(request.auth!.tenantId, eventId, body);
  }
}
''')

write('server/src/business-state/business-state.service.ts', r'''import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
type BusinessBundle = {
  people: JsonObject[];
  uei: { entities: JsonObject; relations: JsonObject; revoked: any[] };
  records: JsonObject[];
  recordEvents: JsonObject[];
};

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function positionValue(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeRows(value: unknown, key: string, label: string): JsonObject[] {
  const rows = (Array.isArray(value) ? value : []).map((item) => clone(objectValue(item)));
  const ids = rows.map((row) => text(row[key]));
  if (ids.some((id) => !id)) throw new BadRequestException(`${label}: отсутствует ${key}`);
  if (new Set(ids).size !== ids.length) throw new BadRequestException(`${label}: дублирующийся ${key}`);
  rows.forEach((row, index) => { row[key] = ids[index]; });
  return rows;
}

function normalizeUEI(value: unknown) {
  const source = objectValue(value);
  return {
    entities: clone(objectValue(source.entities)),
    relations: clone(objectValue(source.relations)),
    revoked: Array.isArray(source.revoked) ? clone(source.revoked) : [],
  };
}

function normalizeBundle(value: unknown): BusinessBundle {
  const source = objectValue(value);
  return {
    people: normalizeRows(source.people, 'key', 'Клиенты'),
    uei: normalizeUEI(source.uei),
    records: normalizeRows(source.records, 'id', 'Записи'),
    recordEvents: normalizeRows(source.recordEvents, 'id', 'История записей'),
  };
}

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonical(value: BusinessBundle) {
  return JSON.stringify(stable(value));
}

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

@Injectable()
export class BusinessStateService {
  constructor(private readonly prisma: PrismaService) {}

  private async bundle(tenantId: string) {
    const [meta, people, identity, records, recordEvents] = await Promise.all([
      this.prisma.businessStateMeta.findUnique({ where: { tenantId } }),
      this.prisma.businessPerson.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.businessIdentityState.findUnique({ where: { tenantId } }),
      this.prisma.businessRecord.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.businessRecordEvent.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    ]);

    return {
      migrated: Boolean(meta),
      verified: Boolean(meta?.migrationVerifiedAt),
      migrationVerifiedAt: meta?.migrationVerifiedAt || null,
      people: people.map((row) => clone(row.data)),
      uei: normalizeUEI(identity?.data || {}),
      records: records.map((row) => clone(row.data)),
      recordEvents: recordEvents.map((row) => clone(row.data)),
    };
  }

  get(tenantId: string) {
    return this.bundle(tenantId);
  }

  private async requireVerified(tenantId: string) {
    const meta = await this.prisma.businessStateMeta.findUnique({ where: { tenantId } });
    if (!meta?.migrationVerifiedAt) throw new ConflictException('Перенос Клиентов, UEI и Записей ещё не подтверждён');
  }

  async migrate(tenantId: string, body: unknown) {
    const expected = normalizeBundle(body);
    const existing = await this.prisma.businessStateMeta.findUnique({ where: { tenantId } });
    if (existing) return this.bundle(tenantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.businessStateMeta.create({ data: { tenantId } });
      await tx.businessIdentityState.create({ data: { tenantId, data: json(expected.uei) } });
      for (const [position, person] of expected.people.entries()) {
        await tx.businessPerson.create({ data: { tenantId, key: text(person.key), position, data: json(person) } });
      }
      for (const [position, record] of expected.records.entries()) {
        await tx.businessRecord.create({ data: { tenantId, recordId: text(record.id), position, data: json(record) } });
      }
      for (const [position, event] of expected.recordEvents.entries()) {
        await tx.businessRecordEvent.create({
          data: { tenantId, eventId: text(event.id), recordId: text(event.recordId), position, data: json(event) },
        });
      }
    });

    return this.bundle(tenantId);
  }

  async verifyMigration(tenantId: string, body: unknown) {
    const expected = normalizeBundle(body);
    const current = await this.bundle(tenantId);
    if (!current.migrated) throw new ConflictException('Клиенты, UEI и Записи ещё не перенесены');
    const actual = normalizeBundle(current);
    if (canonical(actual) !== canonical(expected)) {
      throw new ConflictException('Проверка переноса Клиентов, UEI и Записей не пройдена');
    }
    await this.prisma.businessStateMeta.update({ where: { tenantId }, data: { migrationVerifiedAt: new Date() } });
    return this.bundle(tenantId);
  }

  async bootstrap(tenantId: string) {
    const existing = await this.prisma.businessStateMeta.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.businessStateMeta.create({ data: { tenantId, migrationVerifiedAt: new Date() } });
        await tx.businessIdentityState.create({ data: { tenantId, data: json(normalizeUEI({})) } });
      });
    }
    return this.bundle(tenantId);
  }

  async upsertPerson(tenantId: string, key: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const person = clone(objectValue(source.person ?? source));
    const normalizedKey = text(key);
    if (!normalizedKey) throw new BadRequestException('У клиента отсутствует key');
    person.key = normalizedKey;
    await this.prisma.businessPerson.upsert({
      where: { tenantId_key: { tenantId, key: normalizedKey } },
      create: { tenantId, key: normalizedKey, position: positionValue(source.position), data: json(person) },
      update: { position: positionValue(source.position), data: json(person) },
    });
    return person;
  }

  async deletePerson(tenantId: string, key: string) {
    await this.requireVerified(tenantId);
    const normalizedKey = text(key);
    const result = await this.prisma.businessPerson.deleteMany({ where: { tenantId, key: normalizedKey } });
    return { deleted: result.count };
  }

  async updateUEI(tenantId: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const uei = normalizeUEI(source.uei ?? source);
    await this.prisma.businessIdentityState.upsert({
      where: { tenantId },
      create: { tenantId, data: json(uei) },
      update: { data: json(uei) },
    });
    return uei;
  }

  async upsertRecord(tenantId: string, recordId: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const record = clone(objectValue(source.record ?? source));
    const id = text(recordId);
    if (!id) throw new BadRequestException('У записи отсутствует id');
    record.id = id;
    await this.prisma.businessRecord.upsert({
      where: { tenantId_recordId: { tenantId, recordId: id } },
      create: { tenantId, recordId: id, position: positionValue(source.position), data: json(record) },
      update: { position: positionValue(source.position), data: json(record) },
    });
    return record;
  }

  async deleteRecord(tenantId: string, recordId: string) {
    await this.requireVerified(tenantId);
    const id = text(recordId);
    const [events, record] = await this.prisma.$transaction([
      this.prisma.businessRecordEvent.deleteMany({ where: { tenantId, recordId: id } }),
      this.prisma.businessRecord.deleteMany({ where: { tenantId, recordId: id } }),
    ]);
    return { deleted: record.count, deletedEvents: events.count };
  }

  async deleteRecordEvents(tenantId: string, recordId: string) {
    await this.requireVerified(tenantId);
    const result = await this.prisma.businessRecordEvent.deleteMany({ where: { tenantId, recordId: text(recordId) } });
    return { deleted: result.count };
  }

  async upsertRecordEvent(tenantId: string, eventId: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const event = clone(objectValue(source.event ?? source));
    const id = text(eventId);
    const recordId = text(event.recordId);
    if (!id || !recordId) throw new BadRequestException('У события записи отсутствует id или recordId');
    event.id = id;
    event.recordId = recordId;
    await this.prisma.businessRecordEvent.upsert({
      where: { tenantId_eventId: { tenantId, eventId: id } },
      create: { tenantId, eventId: id, recordId, position: positionValue(source.position), data: json(event) },
      update: { recordId, position: positionValue(source.position), data: json(event) },
    });
    return event;
  }
}
''')


# App module registration.
replace_once(
    'server/src/app.module.ts',
    "import { OnlineBookingModule } from './online-booking/online-booking.module';\n",
    "import { OnlineBookingModule } from './online-booking/online-booking.module';\nimport { BusinessStateModule } from './business-state/business-state.module';\n",
)
replace_once(
    'server/src/app.module.ts',
    "  imports: [AuthModule, WorkspaceModule, ProfileModule, OnlineBookingModule],\n",
    "  imports: [AuthModule, WorkspaceModule, ProfileModule, BusinessStateModule, OnlineBookingModule],\n",
)


# Prisma schema: tenant-owned relational envelopes for Person / UEI / Record facts.
schema_path = Path('server/prisma/schema.prisma')
schema = schema_path.read_text(encoding='utf-8')
schema = schema.replace(
    "  bookingRequests    BookingRequest[]\n",
    "  bookingRequests    BookingRequest[]\n  businessStateMeta   BusinessStateMeta?\n  businessPeople      BusinessPerson[]\n  businessIdentity    BusinessIdentityState?\n  businessRecords     BusinessRecord[]\n  businessRecordEvents BusinessRecordEvent[]\n",
    1,
)
schema += r'''

model BusinessStateMeta {
  id                  String   @id @default(cuid())
  tenantId            String   @unique
  migrationVerifiedAt DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model BusinessPerson {
  id        String   @id @default(cuid())
  tenantId  String
  key       String
  position  Int      @default(0)
  data      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, key])
  @@index([tenantId, position])
}

model BusinessIdentityState {
  id        String   @id @default(cuid())
  tenantId  String   @unique
  data      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model BusinessRecord {
  id        String   @id @default(cuid())
  tenantId  String
  recordId  String
  position  Int      @default(0)
  data      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, recordId])
  @@index([tenantId, position])
}

model BusinessRecordEvent {
  id        String   @id @default(cuid())
  tenantId  String
  eventId   String
  recordId  String
  position  Int      @default(0)
  data      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, eventId])
  @@index([tenantId, recordId])
  @@index([tenantId, position])
}
'''
schema_path.write_text(schema, encoding='utf-8')


# Production migration.
write('server/prisma/migrations/20260912080000_business_state/migration.sql', r'''CREATE TABLE "BusinessStateMeta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "migrationVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessStateMeta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessPerson" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessPerson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessIdentityState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessIdentityState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessRecordEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessRecordEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessStateMeta_tenantId_key" ON "BusinessStateMeta"("tenantId");
CREATE UNIQUE INDEX "BusinessPerson_tenantId_key_key" ON "BusinessPerson"("tenantId", "key");
CREATE INDEX "BusinessPerson_tenantId_position_idx" ON "BusinessPerson"("tenantId", "position");
CREATE UNIQUE INDEX "BusinessIdentityState_tenantId_key" ON "BusinessIdentityState"("tenantId");
CREATE UNIQUE INDEX "BusinessRecord_tenantId_recordId_key" ON "BusinessRecord"("tenantId", "recordId");
CREATE INDEX "BusinessRecord_tenantId_position_idx" ON "BusinessRecord"("tenantId", "position");
CREATE UNIQUE INDEX "BusinessRecordEvent_tenantId_eventId_key" ON "BusinessRecordEvent"("tenantId", "eventId");
CREATE INDEX "BusinessRecordEvent_tenantId_recordId_idx" ON "BusinessRecordEvent"("tenantId", "recordId");
CREATE INDEX "BusinessRecordEvent_tenantId_position_idx" ON "BusinessRecordEvent"("tenantId", "position");

ALTER TABLE "BusinessStateMeta" ADD CONSTRAINT "BusinessStateMeta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessPerson" ADD CONSTRAINT "BusinessPerson_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessIdentityState" ADD CONSTRAINT "BusinessIdentityState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessRecord" ADD CONSTRAINT "BusinessRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessRecordEvent" ADD CONSTRAINT "BusinessRecordEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
''')


# Health now verifies the new storage schema exists after deploy migration.
replace_once(
    'server/src/health.controller.ts',
    '      await this.prisma.$queryRaw`SELECT 1 FROM "Workplace" LIMIT 1`;\n      return { status: \'ok\', database: \'ok\', profileStorage: \'ok\' };\n',
    '      await this.prisma.$queryRaw`SELECT 1 FROM "Workplace" LIMIT 1`;\n      await this.prisma.$queryRaw`SELECT 1 FROM "BusinessStateMeta" LIMIT 1`;\n      return { status: \'ok\', database: \'ok\', profileStorage: \'ok\', businessStorage: \'ok\' };\n',
)


# ---------------------------------------------------------------------------
# Regression: server-hydrated runtime must ignore legacy browser facts and must
# persist mutations through authenticated server endpoints instead of rewriting
# the legacy localStorage keys.
# ---------------------------------------------------------------------------
write('tests/business-server-owner.test.mjs', r'''import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};
globalThis.sessionStorage = {
  getItem: () => 'test-token',
  setItem: () => {},
  removeItem: () => {},
};

const legacyPeople = JSON.stringify([{ key: 'legacy-person', name: 'Legacy', phones: [] }]);
const legacyUEI = JSON.stringify({ entities: { L001: { uei: 'L001', owner: { type: 'person', id: 'legacy-person' }, members: ['person:legacy-person'], history: [], reserved: true } }, relations: { 'person:legacy-person': 'L001' }, revoked: [] });
const legacyRecords = JSON.stringify([{ id: 'legacy-record', date: '2026-01-01' }]);
const legacyEvents = JSON.stringify([]);
localStorage.setItem('book.people', legacyPeople);
localStorage.setItem('book.uei', legacyUEI);
localStorage.setItem('book.records', legacyRecords);
localStorage.setItem('book.recordEvents', legacyEvents);

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || 'GET', body: options.body || '' });
  return { ok: true, status: 200, json: async () => ({}) };
};

const clients = await import('../main/clients/data.js');
const uei = await import('../core/uei.js');
const recordData = await import('../core/record/data.js');
const persistence = await import('../core/business-persistence.js');

clients.hydrateClientsFromServer([{ key: 'server-person', name: 'Server', phones: ['+79030000000'], tags: ['future-tag'] }]);
uei.hydrateUEIFromServer({ entities: {}, relations: {}, revoked: [] });
recordData.hydrateRecordStateFromServer({
  records: [{ id: 'server-record', date: '2026-09-12', from: '10:00', to: '11:00' }],
  recordEvents: [],
});
persistence.setBusinessServerReady(true);

assert.deepEqual(clients.getAllClients().map((person) => person.key), ['server-person']);
assert.deepEqual(recordData.getRecordRows().map((record) => record.id), ['server-record']);
assert.deepEqual(uei.listUEIs(), []);
assert.deepEqual(clients.getAllClients()[0].tags, ['future-tag'], 'unknown tag ids must survive until Tags owner moves server-side');

const people = clients.getAllClients();
people[0].surname = 'Updated';
clients.saveClients(people);
uei.createUEI({ entityType: 'person', entityId: 'server-person', value: 'A1' });
recordData.patchRecordRow('server-record', { from: '10:30' });
recordData.insertRecordEventRow({ id: 'event-1', recordId: 'server-record', type: 'created', at: '2026-09-12T10:00:00.000Z', payload: {} });

await persistence.flushBusinessPersistence({ timeoutMs: 2000 });

assert.equal(localStorage.getItem('book.people'), legacyPeople);
assert.equal(localStorage.getItem('book.uei'), legacyUEI);
assert.equal(localStorage.getItem('book.records'), legacyRecords);
assert.equal(localStorage.getItem('book.recordEvents'), legacyEvents);
assert.ok(calls.some((call) => call.url.includes('/business-state/people/server-person') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.includes('/business-state/uei') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.includes('/business-state/records/server-record') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.includes('/business-state/record-events/event-1') && call.method === 'PUT'));

console.log('business server owner tests: OK');
''')

write('scripts/check-business-server-ownership.mjs', r'''import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const failures = [];
const core = read('core.js');
const clients = read('main/clients/data.js');
const uei = read('core/uei.js');
const records = read('core/record/data.js');
const bridge = read('online-booking/owner-bridge.js');
const app = read('server/src/app.module.ts');
const schema = read('server/prisma/schema.prisma');

if (!core.includes('await initializeBusinessState(authenticatedAccount)')) failures.push('Authenticated Book must hydrate Clients/UEI/Record from server before rendering.');
if (!clients.includes('hydrateClientsFromServer') || !clients.includes('queuePersonUpsert')) failures.push('Person owner must use server-hydrated runtime state and server writes.');
if (!uei.includes('hydrateUEIFromServer') || !uei.includes('queueUEIStore')) failures.push('UEI owner must use server-hydrated runtime state and server writes.');
if (!records.includes('hydrateRecordStateFromServer') || !records.includes('queueRecordUpsert') || !records.includes('queueRecordEventUpsert')) failures.push('Record persistence gateway must use server-hydrated rows and server writes.');
if (!bridge.includes('await flushBusinessPersistence();')) failures.push('Online booking import must flush Person/Record facts before marking a request imported.');
if (!app.includes('BusinessStateModule')) failures.push('Nest application must register BusinessStateModule.');
for (const model of ['BusinessStateMeta', 'BusinessPerson', 'BusinessIdentityState', 'BusinessRecord', 'BusinessRecordEvent']) {
  if (!schema.includes(`model ${model}`)) failures.push(`Prisma schema is missing ${model}.`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('business server ownership check: OK');
''')


# Wire checks/tests into normal CI.
package_path = Path('package.json')
package_data = json.loads(package_path.read_text(encoding='utf-8'))
if 'check-business-server-ownership.mjs' not in package_data['scripts']['check']:
    package_data['scripts']['check'] += ' && node scripts/check-business-server-ownership.mjs'
if 'business-server-owner.test.mjs' not in package_data['scripts']['test']:
    package_data['scripts']['test'] += ' && node tests/business-server-owner.test.mjs'
package_path.write_text(json.dumps(package_data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

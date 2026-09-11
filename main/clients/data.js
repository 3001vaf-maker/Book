import { normalizePhoneForStorage, phonesMatch } from '../../core/phone/index.js';
import { getMembers, getUEI } from '../../core/uei.js';
import { getTags } from '../../settings/tags/data.js';
import { getLatestClientConsent, migrateLegacyConsents } from '../../settings/documents/consents.js';

const STORAGE_KEY = 'book.people';

function readStoredClients() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function normalizeTagAssignments(values = []) {
  const catalog = getTags();
  const ids = new Set(catalog.map((tag) => tag.id));
  const byName = new Map(catalog.map((tag) => [tag.name, tag.id]));
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => ids.has(value) ? value : byName.get(value))
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

function normalizeClient(person = {}) {
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
    createdAt: String(person.createdAt || ''),
  };
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people.map(normalizeClient)));
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
  const person = normalizeClient({
    ...(previous || {}),
    key: previous?.key || `account-${accountId}`,
    name: String(account.name || previous?.name || ''),
    surname: String(account.surname || previous?.surname || ''),
    phones: phone ? [...(previous?.phones || []), phone] : previous?.phones || [],
    telegrams: telegramId ? [...(previous?.telegrams || []), telegramId] : previous?.telegrams || [],
    emails: email ? [...(previous?.emails || []), email] : previous?.emails || [],
    accounts: [...(previous?.accounts || []), accountId],
    createdAt: previous?.createdAt || new Date().toISOString(),
  });
  if (existingIndex >= 0) people[existingIndex] = person;
  else people.push(person);
  saveClients(people);
  return getAllClients().find((item) => item.key === person.key) || person;
}

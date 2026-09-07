import { getMembers, getUEI } from '../../core/uei.js';
import { getTags } from '../../settings/tags/data.js';

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

function normalizeClient(person = {}) {
  return {
    key: String(person.key || ''),
    name: String(person.name || ''),
    surname: String(person.surname || ''),
    photo: String(person.photo || ''),
    gender: String(person.gender || ''),
    birthDate: String(person.birthDate || ''),
    phones: Array.isArray(person.phones) ? person.phones : [],
    telegrams: Array.isArray(person.telegrams) ? person.telegrams : [],
    emails: Array.isArray(person.emails) ? person.emails : [],
    links: Array.isArray(person.links) ? person.links : [],
    tags: normalizeTagAssignments(person.tags),
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

export function getAllClients() {
  return readStoredClients()
    .map(normalizeClient)
    .filter((person) => person.key)
    .map((person) => ({ ...person, uei: getUEI('person', person.key) || '' }));
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

export function getClientCount() {
  return getClients().length;
}

export function saveClients(people = []) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people.map(normalizeClient)));
}

export function createClient(name, surname, phone) {
  return normalizeClient({
    key: crypto.randomUUID(),
    name,
    surname,
    phones: [phone],
    createdAt: new Date().toISOString(),
  });
}

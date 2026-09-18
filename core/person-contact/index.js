import { normalizePhoneForStorage } from '../phone/index.js';

function text(value) {
  return String(value ?? '').trim();
}

function canonicalEmail(value) {
  return text(value).toLowerCase();
}

function canonicalTelegram(value) {
  const raw = text(value);
  if (!raw) return '';
  if (/^\d+$/.test(raw)) return `id:${raw}`;
  const username = raw.replace(/^@+/, '').toLowerCase();
  return username ? `username:${username}` : '';
}

function contacts(person = {}) {
  const result = [];
  for (const value of Array.isArray(person.phones) ? person.phones : []) {
    const normalized = normalizePhoneForStorage(value);
    if (normalized) result.push({ type: 'Телефон', key: `phone:${normalized}`, value: normalized });
  }
  for (const value of Array.isArray(person.emails) ? person.emails : []) {
    const normalized = canonicalEmail(value);
    if (normalized) result.push({ type: 'Email', key: `email:${normalized}`, value: normalized });
  }
  for (const value of Array.isArray(person.telegrams) ? person.telegrams : []) {
    const normalized = canonicalTelegram(value);
    if (normalized) result.push({ type: 'Telegram', key: `telegram:${normalized}`, value: text(value) });
  }
  return result;
}

function ownersByContact(people = []) {
  const map = new Map();
  for (const person of Array.isArray(people) ? people : []) {
    const personKey = text(person?.key);
    if (!personKey) continue;
    for (const contact of contacts(person)) {
      const owners = map.get(contact.key) || [];
      owners.push({ personKey, person, contact });
      map.set(contact.key, owners);
    }
  }
  return map;
}

function personLabel(person = {}) {
  const code = text(person.uei);
  if (code) return code;
  const fullName = [text(person.name), text(person.surname)].filter(Boolean).join(' ');
  return fullName || 'другому человеку';
}

export function assertNoNewPersonContactConflicts(previousPeople = [], nextPeople = []) {
  const previous = ownersByContact(previousPeople);
  const next = ownersByContact(nextPeople);

  for (const [contactKey, owners] of next) {
    const uniqueOwners = [...new Map(owners.map((item) => [item.personKey, item])).values()];
    if (uniqueOwners.length <= 1) continue;

    const beforeOwners = new Set((previous.get(contactKey) || []).map((item) => item.personKey));
    const introduced = uniqueOwners.find((item) => !beforeOwners.has(item.personKey));
    if (!introduced) continue;

    const other = uniqueOwners.find((item) => item.personKey !== introduced.personKey) || uniqueOwners[0];
    throw new Error(`${introduced.contact.type} уже принадлежит человеку ${personLabel(other.person)}.`);
  }
}

export function normalizePersonEmail(value) {
  return canonicalEmail(value);
}

export function normalizePersonTelegram(value) {
  return canonicalTelegram(value);
}

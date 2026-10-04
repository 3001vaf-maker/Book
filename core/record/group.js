function personKey(person = {}) {
  return String(person?.key || person?.id || '').trim();
}

function clonePerson(person = {}) {
  if (!person || typeof person !== 'object') return null;
  const snapshot = {
    key: String(person?.key || ''),
    id: String(person?.id || ''),
    name: String(person?.name || ''),
    surname: String(person?.surname || ''),
    phone: String(person?.phone || person?.phones?.[0] || ''),
    discountPercent: Math.max(0, Math.min(100, Number(person?.discountPercent) || 0)),
  };
  return personKey(snapshot) ? snapshot : null;
}

export function normalizeRecordGroup(group = null, fallbackPerson = null) {
  if (!group || typeof group !== 'object') return null;
  const requestedCapacity = Math.floor(Number(group?.capacity) || 0);
  if (requestedCapacity < 2) return null;

  const capacity = Math.max(2, Math.min(999, requestedCapacity));
  const source = Array.isArray(group?.participants) ? group.participants : [];
  const participants = [];
  const seen = new Set();

  for (const value of source) {
    const person = clonePerson(value);
    const key = personKey(person);
    if (!person || !key || seen.has(key)) continue;
    if (participants.length >= capacity) break;
    seen.add(key);
    participants.push(person);
  }

  const fallback = clonePerson(fallbackPerson);
  const fallbackKey = personKey(fallback);
  if (fallback && fallbackKey && !seen.has(fallbackKey) && participants.length < capacity) {
    participants.unshift(fallback);
  }

  return { capacity, participants: participants.slice(0, capacity) };
}

export function isGroupRecord(record = {}) {
  return Boolean(normalizeRecordGroup(record?.group, record?.person));
}

export function recordParticipants(record = {}) {
  const group = normalizeRecordGroup(record?.group, record?.person);
  if (group) return group.participants;
  const person = clonePerson(record?.person);
  return person ? [person] : [];
}

export function recordCapacity(record = {}) {
  return normalizeRecordGroup(record?.group, record?.person)?.capacity || 1;
}

export function recordParticipantCount(record = {}) {
  return recordParticipants(record).length;
}

export function recordAvailableSpots(record = {}) {
  return Math.max(0, recordCapacity(record) - recordParticipantCount(record));
}

export function recordGroupIsFull(record = {}) {
  return isGroupRecord(record) && recordAvailableSpots(record) === 0;
}

export function setRecordGroupCapacity(record = {}, capacity = 1) {
  const requested = Math.floor(Number(capacity) || 0);
  if (requested < 2) return { ...record, group: null };
  const current = normalizeRecordGroup(record?.group || { capacity: requested, participants: [] }, record?.person)
    || { capacity: requested, participants: recordParticipants(record) };
  if (requested < current.participants.length) return null;
  return {
    ...record,
    group: {
      capacity: Math.min(999, requested),
      participants: current.participants,
    },
  };
}

export function setRecordParticipants(record = {}, participants = []) {
  const group = normalizeRecordGroup(record?.group, record?.person);
  if (!group) return null;
  const normalized = normalizeRecordGroup({ capacity: group.capacity, participants }, record?.person);
  if (!normalized || normalized.participants.length > group.capacity) return null;
  return {
    ...record,
    person: normalized.participants[0] || record?.person || null,
    group: normalized,
  };
}

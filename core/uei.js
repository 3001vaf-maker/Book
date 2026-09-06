const STORAGE_KEY = 'book.uei';
const EMPTY = '0000';
const MAX_LENGTH = 4;
const ALLOWED = /^[A-Za-zА-Яа-яЁё0-9]+$/;

function readStore() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      entities: value.entities && typeof value.entities === 'object' ? value.entities : {},
      relations: value.relations && typeof value.relations === 'object' ? value.relations : {},
      revoked: Array.isArray(value.revoked) ? value.revoked : [],
    };
  } catch {
    return { entities: {}, relations: {}, revoked: [] };
  }
}

function writeStore(store) { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
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

export function getUEI(entityType, entityId) {
  return readStore().relations[relationKey(entityType, entityId)] || '';
}

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
  if (store.entities[uei]) throw Error('Этот UEI уже существует.');
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
  if (store.entities[normalized]) {
    store.entities[normalized].members = store.entities[normalized].members.filter(member => member !== key);
    recordHistory(store.entities[normalized], entityType, entityId, []);
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
  if (linkValue) return { uei: linkUEI({ entityType, entityId, value: linkValue, identifiers }), linked: true };
  if (value && normalizeUEI(value) !== EMPTY) {
    const requested = normalizeUEI(value);
    if (current === requested) return { uei: requested };
    if (current !== EMPTY) detachUEI({ entityType, entityId, uei: current, explicit: false });
    const result = listUEIs().some(entity => entity.uei === requested)
      ? linkUEI({ entityType, entityId, value: requested, identifiers })
      : createUEI({ entityType, entityId, value: requested, identifiers });
    return { uei: result };
  }
  if (current !== EMPTY) return { uei: detachUEI({ entityType, entityId, uei: current, explicit: true }) };
  return { uei: '' };
}

export function clearTestState() { localStorage.removeItem(STORAGE_KEY); }

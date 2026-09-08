const WORKPLACES_KEY = 'book.workplaces';
const WORKPLACE_FALLBACK_COLOR = '#212529';

function read(fallback) {
  try { return JSON.parse(localStorage.getItem(WORKPLACES_KEY) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function write(value) {
  localStorage.setItem(WORKPLACES_KEY, JSON.stringify(value));
}

function normalizeWorkplace(workplace = {}) {
  return {
    key: String(workplace.key || ''),
    profileId: String(workplace.profileId || 'profile'),
    photo: String(workplace.photo || ''),
    name: String(workplace.name || ''),
    color: String(workplace.color || ''),
    city: String(workplace.city || ''),
    address: String(workplace.address || ''),
    phone: String(workplace.phone || ''),
    currency: String(workplace.currency || 'RUB'),
    from: String(workplace.from || '09:00'),
    to: String(workplace.to || '18:00'),
    links: Array.isArray(workplace.links) ? workplace.links : [],
    about: String(workplace.about || ''),
    createdAt: String(workplace.createdAt || ''),
    updatedAt: String(workplace.updatedAt || ''),
  };
}

function withPresentationFallback(workplace) {
  return { ...workplace, indicatorColor: workplace.color || WORKPLACE_FALLBACK_COLOR };
}

export function getWorkplaces() {
  const values = read([]);
  return Array.isArray(values) ? values.map((value) => withPresentationFallback(normalizeWorkplace(value))) : [];
}

export function saveWorkplaces(values) {
  const normalized = (Array.isArray(values) ? values : []).map(normalizeWorkplace);
  write(normalized);
  return normalized.map(withPresentationFallback);
}

export function upsertWorkplace(workplace) {
  const item = normalizeWorkplace(workplace);
  const values = getWorkplaces().map(normalizeWorkplace);
  const next = values.some((value) => value.key === item.key)
    ? values.map((value) => value.key === item.key ? item : value)
    : [...values, item];
  return saveWorkplaces(next);
}

export function deleteWorkplace(key) {
  const target = String(key || '');
  if (!target) return false;
  const values = getWorkplaces().map(normalizeWorkplace);
  const next = values.filter((value) => value.key !== target);
  if (next.length === values.length) return false;
  saveWorkplaces(next);
  return true;
}

const CONTEXT_KEY = 'book:workplace-context';

function readContext() {
  try {
    const value = JSON.parse(localStorage.getItem(CONTEXT_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeContext(value) {
  localStorage.setItem(CONTEXT_KEY, JSON.stringify(value || {}));
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getWorkplaceContext(workplaces = []) {
  const items = Array.isArray(workplaces) ? workplaces : [];
  const context = readContext();
  const first = items[0]?.key || '';
  const workplaceId = items.some((item) => item.key === context.workplaceId) ? context.workplaceId : first;
  const parsedDate = typeof context.date === 'string' ? new Date(`${context.date}T00:00:00`) : null;
  const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();
  return { workplaceId, date };
}

export function setWorkplaceContext({ workplaceId, date } = {}) {
  const next = { ...readContext() };
  if (workplaceId !== undefined) next.workplaceId = String(workplaceId || '');
  if (date instanceof Date && !Number.isNaN(date.getTime())) next.date = dateKey(date);
  writeContext(next);
  return next;
}

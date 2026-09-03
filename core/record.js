const KEY = 'book.records';

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function write(records) {
  localStorage.setItem(KEY, JSON.stringify(records));
}

export function getRecords() {
  return read();
}

export function getRecordsForDay(date, workplaceId = '') {
  const key = String(date || '');
  return read().filter((record) => record.date === key && (!workplaceId || record.workplaceId === workplaceId));
}

export function createRecord({ date, workplaceId, from, to, client, procedures = [] } = {}) {
  const record = {
    id: crypto.randomUUID(),
    date: String(date || ''),
    workplaceId: String(workplaceId || ''),
    from: String(from || ''),
    to: String(to || ''),
    client: client || null,
    procedures: Array.isArray(procedures) ? procedures : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const records = read();
  records.push(record);
  write(records);
  return record;
}

export function updateRecord(id, patch = {}) {
  const records = read();
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) return null;
  records[index] = { ...records[index], ...patch, updatedAt: new Date().toISOString() };
  write(records);
  return records[index];
}

export function removeRecord(id) {
  const records = read();
  const next = records.filter((record) => record.id !== id);
  write(next);
  return next.length !== records.length;
}

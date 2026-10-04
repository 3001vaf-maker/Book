import { getLedgerEntries } from '../finance/index.js';
import { getRecords } from '../record/index.js';
import { getIdentityMemberKeys, getIdentityOwner } from './data.js';

const text = (value) => String(value ?? '').trim();

function recordMoment(record = {}) {
  const date = text(record.date);
  const time = text(record.from);
  return date ? `${date}T${time || '00:00'}:00` : '';
}

function recordDetails(record = {}) {
  const procedures = (Array.isArray(record.procedures) ? record.procedures : []).map((item) => text(item?.name)).filter(Boolean);
  const products = (Array.isArray(record.products) ? record.products : []).map((item) => text(item?.name)).filter(Boolean);
  return [...procedures, ...products].join(', ');
}

function financeTitle(entry = {}) {
  const kind = text(entry.operationKind);
  if (kind === 'payment') return 'Оплата';
  if (kind === 'refund') return 'Возврат';
  if (kind === 'manual-income') return 'Доход';
  if (kind === 'manual-expense') return 'Расход';
  return 'Финансовая операция';
}

export function getPersonHistory(key = '') {
  const identityKeys = new Set(getIdentityMemberKeys(key).map(text).filter(Boolean));
  const owner = getIdentityOwner(key);
  const uei = text(owner?.uei);
  const records = getRecords().filter((record) => identityKeys.has(text(record?.person?.key)));
  const recordIds = new Set(records.map((record) => text(record?.id)).filter(Boolean));

  const recordItems = records.map((record) => ({
    id: `record:${text(record.id)}`,
    kind: 'record',
    occurredAt: recordMoment(record),
    title: recordDetails(record) || 'Запись',
    subtitle: record?.status === 'cancelled' ? 'Запись отменена' : 'Запись',
    amount: null,
  }));

  const operations = new Map();
  for (const entry of getLedgerEntries()) {
    const entryKey = text(entry?.person?.key);
    const entryUei = text(entry?.person?.uei);
    const sourceRecord = text(entry?.source?.type).toLowerCase() === 'record' && recordIds.has(text(entry?.source?.id));
    if (!identityKeys.has(entryKey) && !(uei && entryUei === uei) && !sourceRecord) continue;
    const operationId = text(entry?.operationId || entry?.id);
    if (!operationId) continue;
    const current = operations.get(operationId) || {
      id: `finance:${operationId}`,
      kind: 'finance',
      occurredAt: text(entry?.occurredAt),
      title: financeTitle(entry),
      subtitle: text(entry?.sourceDetails || entry?.workplace),
      amount: 0,
    };
    const amount = Math.max(0, Number(entry?.amount) || 0);
    current.amount += text(entry?.direction) === 'OUT' ? -amount : amount;
    if (!current.subtitle) current.subtitle = text(entry?.sourceDetails || entry?.workplace);
    operations.set(operationId, current);
  }

  return [...recordItems, ...operations.values()]
    .sort((left, right) => text(right.occurredAt).localeCompare(text(left.occurredAt)));
}

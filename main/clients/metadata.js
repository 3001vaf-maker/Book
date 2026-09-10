import { getDDSMovements } from '../../core/dds.js';
import { getRecords } from '../../journal/record-data.js';

const clientKey = (value) => String(value || '');

function clientRecords(key) {
  const target = clientKey(key);
  if (!target) return [];
  return getRecords().filter((record) => record?.status !== 'cancelled' && clientKey(record?.client?.key) === target);
}

export function getClientMetadata(key) {
  const records = clientRecords(key);
  const recordIds = new Set(records.map((record) => String(record?.id || '')).filter(Boolean));
  const movements = getDDSMovements();
  const completed = movements.filter((movement) => movement?.movementType === 'income'
    && movement?.source?.type === 'record'
    && recordIds.has(String(movement?.source?.id || '')));
  const completedIds = new Set(completed.map((movement) => String(movement.id || '')));
  const paid = completed.reduce((sum, movement) => {
    const value = Number(movement?.total);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const refunded = movements
    .filter((movement) => movement?.movementType === 'expense'
      && movement?.expenseType === 'refund'
      && completedIds.has(String(movement?.originalPaymentId || '')))
    .reduce((sum, movement) => {
      const value = Number(movement?.total);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  const dated = records
    .filter((record) => record?.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return {
    recordCount: records.length,
    paidTotal: Math.max(0, paid - refunded),
    lastVisit: dated[0]?.date || '',
  };
}

export function formatClientVisitDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '—';
}

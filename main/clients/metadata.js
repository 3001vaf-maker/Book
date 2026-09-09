import { getPayments } from '../../core/payment.js';
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
  const paidTotal = getPayments()
    .filter((payment) => payment?.status === 'completed'
      && payment?.source?.type === 'record'
      && recordIds.has(String(payment?.source?.id || '')))
    .reduce((sum, payment) => {
      const value = Number(payment?.total);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  const arrived = records
    .filter((record) => record?.attendance === 'arrived' && record?.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return {
    recordCount: records.length,
    paidTotal,
    lastVisit: arrived[0]?.date || '',
  };
}

export function formatClientVisitDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '—';
}

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
  const payments = getPayments();
  const completed = payments.filter((payment) => payment?.status === 'completed'
    && payment?.source?.type === 'record'
    && recordIds.has(String(payment?.source?.id || '')));
  const completedIds = new Set(completed.map((payment) => String(payment.id || '')));
  const paid = completed.reduce((sum, payment) => {
    const value = Number(payment?.total);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const refunded = payments
    .filter((payment) => payment?.status === 'refund' && completedIds.has(String(payment?.originalPaymentId || '')))
    .reduce((sum, payment) => {
      const value = Number(payment?.total);
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

import { getBusinessFactForRecords } from '../../core/business-model.js';
import { getRecords } from '../../journal/record-data.js';

const clientKey = (value) => String(value || '');

function clientRecords(key) {
  const target = clientKey(key);
  if (!target) return [];
  return getRecords().filter((record) => record?.status !== 'cancelled' && clientKey(record?.client?.key) === target);
}

export function getClientMetadata(key) {
  const records = clientRecords(key);
  const fact = getBusinessFactForRecords(records.map((record) => record?.id));
  const dated = records
    .filter((record) => record?.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return {
    recordCount: records.length,
    paidTotal: Math.max(0, Number(fact.factTotal) || 0),
    lastVisit: dated[0]?.date || '',
  };
}

export function formatClientVisitDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '—';
}

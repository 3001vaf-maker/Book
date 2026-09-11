import { shortDate } from '../../ui/ui.js';
import { getFinancialFactForRecords } from '../../core/financial-model.js';
import { getRecords } from '../../journal/record-read.js';

const clientKey = (value) => String(value || '');

function clientRecords(key) {
  const target = clientKey(key);
  if (!target) return [];
  return getRecords().filter((record) => record?.status !== 'cancelled' && clientKey(record?.client?.key) === target);
}

export function getClientMetadata(key) {
  const records = clientRecords(key);
  const fact = getFinancialFactForRecords(records.map((record) => record?.id));
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
  return shortDate(value, '—');
}

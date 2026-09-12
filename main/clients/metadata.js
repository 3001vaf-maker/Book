import { shortDate } from '../../ui/ui.js';
import { getFinancialFactForRecords } from '../../core/finance/index.js';
import { getRecords } from '../../core/record/index.js';
import { getIdentityMemberKeys } from './data.js';

const clientKey = (value) => String(value || '');

function clientRecords(key) {
  const identityKeys = new Set(getIdentityMemberKeys(key).map(clientKey).filter(Boolean));
  if (!identityKeys.size) return [];
  return getRecords().filter((record) => record?.status !== 'cancelled' && identityKeys.has(clientKey(record?.client?.key)));
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

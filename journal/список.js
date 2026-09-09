import { emptyState, listEntries, listEntry } from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getCompletedPaymentForSource, paymentTotal } from '../core/payment.js';
import { getRecords } from './record-data.js';

function formatDate(value = '') {
  const [year, month, day] = String(value || '').slice(0, 10).split('-');
  return year && month && day ? `${day}.${month}.${year}` : '';
}

function formatMoney(value = 0) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  return `${amount.toLocaleString('ru-RU').replaceAll('\u00a0', ' ')} ₽`;
}

function clientName(client = {}) {
  return [client?.name, client?.surname].filter(Boolean).join(' ').trim() || 'Клиент';
}

function workplaceName(workplaces, workplaceId) {
  const workplace = workplaces.find((item) => String(item?.key || '') === String(workplaceId || ''));
  return workplace?.name || 'Рабочее место';
}

function sortRecords(records) {
  return [...records].sort((a, b) => {
    const left = `${a?.date || ''} ${a?.from || ''}`;
    const right = `${b?.date || ''} ${b?.from || ''}`;
    return right.localeCompare(left);
  });
}

function recordStatusClass(record) {
  if (record?.status === 'cancelled') return 'journal-list-record--deleted';
  if (getCompletedPaymentForSource('record', record?.id)) return 'journal-list-record--paid';
  if (record?.attendance === 'no-show') return 'journal-list-record--no-show';
  return 'journal-list-record--active';
}

export function renderJournalList(root) {
  const workplaces = getWorkplaces();
  const records = sortRecords(getRecords());

  if (!records.length) {
    root.innerHTML = emptyState('Список', 'Записей пока нет.');
    return;
  }

  root.innerHTML = listEntries(records.map((record) => listEntry({
    overline: workplaceName(workplaces, record?.workplaceId),
    title: clientName(record?.client),
    subtitle: record?.client?.phone || '',
    rightTop: [formatDate(record?.date), String(record?.from || '')].filter(Boolean).join(' · '),
    rightBottom: formatMoney(paymentTotal(record?.procedures || [])),
    interactive: false,
    className: recordStatusClass(record),
    initial: (clientName(record?.client) || '?').slice(0, 1).toUpperCase(),
  })));
}

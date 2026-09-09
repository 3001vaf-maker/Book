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

function appointmentTime(record, field = 'from') {
  const date = String(record?.date || '').slice(0, 10);
  const time = String(record?.[field] || '');
  const value = Date.parse(`${date}T${time}:00`);
  return Number.isFinite(value) ? value : 0;
}

function paymentFor(record) {
  return getCompletedPaymentForSource('record', record?.id);
}

function activityTime(record, payment = null) {
  const paidAt = Date.parse(String(payment?.paidAt || payment?.createdAt || ''));
  if (Number.isFinite(paidAt)) return paidAt;
  const updatedAt = Date.parse(String(record?.updatedAt || record?.createdAt || ''));
  if (Number.isFinite(updatedAt)) return updatedAt;
  return appointmentTime(record, 'to') || appointmentTime(record, 'from');
}

function isCompletedSide(record, payment, now) {
  return record?.status === 'cancelled'
    || record?.attendance === 'no-show'
    || Boolean(payment)
    || appointmentTime(record, 'to') <= now;
}

function recordStatusClass(record, payment = null) {
  if (record?.status === 'cancelled') return 'journal-list-record--deleted';
  if (payment) return 'journal-list-record--paid';
  if (record?.attendance === 'no-show') return 'journal-list-record--no-show';
  return 'journal-list-record--active';
}

function recordEntry(record, workplaces, { focus = false, payment = null } = {}) {
  const classes = [recordStatusClass(record, payment), focus ? 'journal-list-focus' : ''].filter(Boolean).join(' ');
  return listEntry({
    overline: workplaceName(workplaces, record?.workplaceId),
    title: clientName(record?.client),
    subtitle: record?.client?.phone || '',
    rightTop: [formatDate(record?.date), String(record?.from || '')].filter(Boolean).join(' · '),
    rightBottom: formatMoney(paymentTotal(record?.procedures || [])),
    interactive: false,
    className: classes,
    initial: (clientName(record?.client) || '?').slice(0, 1).toUpperCase(),
  });
}

function scrollToFocus(root, selector) {
  requestAnimationFrame(() => {
    const node = root.querySelector(selector);
    if (!node) return;
    const rootTop = root.getBoundingClientRect().top;
    const nodeTop = node.getBoundingClientRect().top;
    root.scrollTop += nodeTop - rootTop;
  });
}

function renderTimeMode(root, records, workplaces) {
  const now = Date.now();
  const ordered = [...records].sort((a, b) => appointmentTime(a, 'from') - appointmentTime(b, 'from'));
  const focus = ordered.find((record) => appointmentTime(record, 'from') <= now && appointmentTime(record, 'to') > now)
    || ordered.find((record) => appointmentTime(record, 'from') >= now)
    || ordered[ordered.length - 1]
    || null;

  root.innerHTML = listEntries(ordered.map((record) => {
    const payment = paymentFor(record);
    return recordEntry(record, workplaces, { focus: record === focus, payment });
  }));
  scrollToFocus(root, '.journal-list-focus');
}

function renderFlowMode(root, records, workplaces) {
  const now = Date.now();
  const prepared = records.map((record) => ({ record, payment: paymentFor(record) }));
  const completed = prepared
    .filter(({ record, payment }) => isCompletedSide(record, payment, now))
    .sort((a, b) => activityTime(a.record, a.payment) - activityTime(b.record, b.payment));
  const pending = prepared
    .filter(({ record, payment }) => !isCompletedSide(record, payment, now))
    .sort((a, b) => activityTime(b.record, b.payment) - activityTime(a.record, a.payment));

  const entries = [
    ...completed.map(({ record, payment }) => recordEntry(record, workplaces, { payment })),
    '<div class="journal-list-flow-anchor" data-journal-list-flow-anchor aria-hidden="true"></div>',
    ...pending.map(({ record, payment }) => recordEntry(record, workplaces, { payment })),
  ];
  root.innerHTML = listEntries(entries);
  scrollToFocus(root, '[data-journal-list-flow-anchor]');
}

export function renderJournalList(root, { mode = 'flow' } = {}) {
  const workplaces = getWorkplaces();
  const records = getRecords();

  if (!records.length) {
    root.innerHTML = emptyState('Список', 'Записей пока нет.');
    return;
  }

  if (mode === 'time') renderTimeMode(root, records, workplaces);
  else renderFlowMode(root, records, workplaces);
}

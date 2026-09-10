import { emptyState, listEntries, listEntry } from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getCompletedPaymentForSource, paymentTotal } from '../core/payment.js';
import { getRecords } from './record-data.js';
import { isRecordCompletedSide, recordActivityTime, recordAppointmentTime, recordVisualState } from './record-state.js';

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

function paymentFor(record) {
  return getCompletedPaymentForSource('record', record?.id);
}

function recordStatusClass(record, payment = null) {
  return `journal-list-record--${recordVisualState(record, { paid: Boolean(payment) })}`;
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

function anchorEntry() {
  return '<div class="journal-list-anchor" data-journal-list-anchor aria-hidden="true"></div>';
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
  const ordered = [...records].sort((a, b) => recordAppointmentTime(a, 'from') - recordAppointmentTime(b, 'from'));
  const focusIndex = ordered.findIndex((record) => recordAppointmentTime(record, 'to') > now);
  const splitIndex = focusIndex >= 0 ? focusIndex : ordered.length;
  const entries = ordered.flatMap((record, index) => {
    const payment = paymentFor(record);
    const row = recordEntry(record, workplaces, { focus: index === splitIndex, payment });
    return index === splitIndex ? [anchorEntry(), row] : [row];
  });
  if (splitIndex === ordered.length) entries.push(anchorEntry());

  root.innerHTML = listEntries(entries);
  scrollToFocus(root, '[data-journal-list-anchor]');
}

function renderFlowMode(root, records, workplaces) {
  const now = Date.now();
  const prepared = records.map((record) => {
    const payment = paymentFor(record);
    const completed = isRecordCompletedSide(record, { paid: Boolean(payment), now });
    return { record, payment, completed };
  });
  const completed = prepared
    .filter((item) => item.completed)
    .sort((a, b) => recordActivityTime(a.record, a.payment, { completed: true }) - recordActivityTime(b.record, b.payment, { completed: true }));
  const pending = prepared
    .filter((item) => !item.completed)
    .sort((a, b) => recordActivityTime(b.record, b.payment) - recordActivityTime(a.record, a.payment));

  const entries = [
    ...completed.map(({ record, payment }) => recordEntry(record, workplaces, { payment })),
    anchorEntry(),
    ...pending.map(({ record, payment }) => recordEntry(record, workplaces, { payment })),
  ];
  root.innerHTML = listEntries(entries);
  scrollToFocus(root, '[data-journal-list-anchor]');
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
import { ALL_WORKPLACES_ID, emptyState, escapeHtml, listEntries, listEntry, shortDate } from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getRecordPaymentState, recordPlanTotal } from '../core/finance/index.js';
import { getRecords } from '../core/record/index.js';
import { isRecordCompletedSide, recordActivityTime, recordAppointmentTime, recordVisualState } from '../core/record/index.js';
import { openRecordView } from './record-view.js';

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
  const state = getRecordPaymentState(record);
  return state.fullyPaid ? state.latestPayment : null;
}

function recordStatusClass(record, payment = null) {
  return `journal-list-record--${recordVisualState(record, { paid: Boolean(payment) })}`;
}

function recordId(record) {
  return String(record?.id || record?.sourceId || '');
}

function recordEntry(record, workplaces, { focus = false, payment = null } = {}) {
  const classes = [recordStatusClass(record, payment), focus ? 'journal-list-focus' : ''].filter(Boolean).join(' ');
  const id = recordId(record);
  return listEntry({
    overline: workplaceName(workplaces, record?.workplaceId),
    title: clientName(record?.client),
    subtitle: record?.client?.phone || '',
    rightTop: [shortDate(record?.date), String(record?.from || '')].filter(Boolean).join(' · '),
    rightBottom: formatMoney(recordPlanTotal(record)),
    interactive: Boolean(id),
    data: id ? `data-journal-list-record="${escapeHtml(id)}"` : '',
    aria: id ? `Открыть запись ${clientName(record?.client)}` : '',
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

function bindRecordClicks(root, records) {
  const byId = new Map(records.map((record) => [recordId(record), record]).filter(([id]) => Boolean(id)));
  root.querySelectorAll('[data-journal-list-record]').forEach((node) => node.addEventListener('click', () => {
    const record = byId.get(String(node.dataset.journalListRecord || ''));
    if (record) openRecordView(record);
  }));
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
  bindRecordClicks(root, ordered);
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
  bindRecordClicks(root, records);
  scrollToFocus(root, '[data-journal-list-anchor]');
}

export function renderJournalList(root, { mode = 'flow', workplaceId = ALL_WORKPLACES_ID } = {}) {
  const workplaces = getWorkplaces();
  const allRecords = getRecords();
  const records = workplaceId === ALL_WORKPLACES_ID
    ? allRecords
    : allRecords.filter((record) => String(record?.workplaceId || '') === String(workplaceId || ''));

  if (!records.length) {
    root.innerHTML = emptyState('Список', 'Записей пока нет.');
    return;
  }

  if (mode === 'time') renderTimeMode(root, records, workplaces);
  else renderFlowMode(root, records, workplaces);
}

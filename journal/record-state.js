import { RECORD_EVENT_TYPES } from './record-events.js';

function orderedEvents(events = []) {
  return (Array.isArray(events) ? events : [])
    .filter((event) => event?.type)
    .slice()
    .sort((left, right) => Date.parse(left?.at || '') - Date.parse(right?.at || ''));
}

export function projectRecordLifecycle(record = {}, events = []) {
  // Legacy fields are read-only migration fallback. New lifecycle facts live in Record Events.
  let status = record?.status === 'cancelled' ? 'cancelled' : 'active';
  let confirmed = Boolean(record?.confirmed);
  let attendance = record?.attendance === 'arrived' || record?.attendance === 'no-show' ? record.attendance : '';
  let confirmedAt = String(record?.confirmedAt || '');
  let attendanceAt = String(record?.attendanceAt || '');
  let cancelledAt = String(record?.cancelledAt || '');
  let lifecycleUpdatedAt = record?.updatedAt || record?.createdAt || '';

  for (const event of orderedEvents(events)) {
    const at = String(event?.at || '');
    if (event.type === RECORD_EVENT_TYPES.CONFIRMED) {
      confirmed = true;
      confirmedAt = at;
    } else if (event.type === RECORD_EVENT_TYPES.UNCONFIRMED) {
      confirmed = false;
      confirmedAt = at;
    } else if (event.type === RECORD_EVENT_TYPES.ARRIVED) {
      attendance = 'arrived';
      attendanceAt = at;
    } else if (event.type === RECORD_EVENT_TYPES.NO_SHOW) {
      attendance = 'no-show';
      attendanceAt = at;
    } else if (event.type === RECORD_EVENT_TYPES.ATTENDANCE_CLEARED) {
      attendance = '';
      attendanceAt = at;
    } else if (event.type === RECORD_EVENT_TYPES.CANCELLED) {
      status = 'cancelled';
      cancelledAt = at;
    }
    if (at) lifecycleUpdatedAt = at;
  }

  return {
    ...record,
    status,
    confirmed,
    attendance,
    confirmedAt,
    attendanceAt,
    cancelledAt,
    lifecycleUpdatedAt,
  };
}

export function recordAppointmentTime(record, field = 'from') {
  const date = String(record?.date || '').slice(0, 10);
  const time = String(record?.[field] || '');
  const value = Date.parse(`${date}T${time}:00`);
  return Number.isFinite(value) ? value : 0;
}

export function recordVisualState(record, { paid = false } = {}) {
  if (record?.status === 'cancelled') return 'cancelled';
  if (paid) return 'paid';
  if (record?.attendance === 'no-show') return 'no-show';
  return 'active';
}

export function isRecordCompletedSide(record, { paid = false, now = Date.now() } = {}) {
  return record?.status === 'cancelled'
    || record?.attendance === 'no-show'
    || paid
    || recordAppointmentTime(record, 'to') <= now;
}

export function recordActivityTime(record, payment = null, { completed = false } = {}) {
  if (record?.status === 'cancelled') {
    const cancelledAt = Date.parse(String(record?.cancelledAt || record?.lifecycleUpdatedAt || record?.updatedAt || ''));
    if (Number.isFinite(cancelledAt)) return cancelledAt;
  }
  if (payment) {
    const paidAt = Date.parse(String(payment?.paidAt || payment?.createdAt || ''));
    if (Number.isFinite(paidAt)) return paidAt;
  }
  if (record?.attendance === 'no-show') {
    const attendanceAt = Date.parse(String(record?.attendanceAt || record?.lifecycleUpdatedAt || record?.updatedAt || record?.createdAt || ''));
    if (Number.isFinite(attendanceAt)) return attendanceAt;
  }
  if (completed) return recordAppointmentTime(record, 'to') || recordAppointmentTime(record, 'from');
  const updatedAt = Date.parse(String(record?.lifecycleUpdatedAt || record?.updatedAt || record?.createdAt || ''));
  if (Number.isFinite(updatedAt)) return updatedAt;
  return recordAppointmentTime(record, 'from') || recordAppointmentTime(record, 'to');
}

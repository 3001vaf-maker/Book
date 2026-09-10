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
    const cancelledAt = Date.parse(String(record?.cancelledAt || record?.updatedAt || ''));
    if (Number.isFinite(cancelledAt)) return cancelledAt;
  }
  if (payment) {
    const paidAt = Date.parse(String(payment?.paidAt || payment?.createdAt || ''));
    if (Number.isFinite(paidAt)) return paidAt;
  }
  if (record?.attendance === 'no-show') {
    const attendanceAt = Date.parse(String(record?.updatedAt || record?.createdAt || ''));
    if (Number.isFinite(attendanceAt)) return attendanceAt;
  }
  if (completed) return recordAppointmentTime(record, 'to') || recordAppointmentTime(record, 'from');
  const updatedAt = Date.parse(String(record?.updatedAt || record?.createdAt || ''));
  if (Number.isFinite(updatedAt)) return updatedAt;
  return recordAppointmentTime(record, 'from') || recordAppointmentTime(record, 'to');
}

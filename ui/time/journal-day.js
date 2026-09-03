function toMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}
function formatMinutes(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
const escape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
function recordMarkup(record) {
  const client = record?.client || {}, name = [client.name, client.surname].filter(Boolean).join(' ') || 'Без имени';
  const id = client.id ? `${escape(client.id)} ` : '';
  const phone = client.phone ? `<span>${escape(client.phone)}</span>` : '';
  const services = (record.procedures || []).map((item) => `<span>${escape(item.name)}</span>`).join('');
  return `<span class="journal-record" data-journal-record="${escape(record.id)}"><strong>${id}${escape(name)}</strong>${phone}${services}</span>`;
}
export function journalDayTimeline({ from = '09:00', to = '18:00', records = [] } = {}) {
  const start = toMinutes(from), end = toMinutes(to);
  if (start == null || end == null || end <= start) return '';
  const slots = [], sortedRecords = [...records].sort((a, b) => (toMinutes(a.from) ?? 0) - (toMinutes(b.from) ?? 0));
  const firstSlot = Math.ceil(start / 30) * 30;
  for (let minutes = firstSlot; minutes < end; minutes += 30) {
    const next = Math.min(minutes + 30, end), label = minutes % 60 === 0 ? formatMinutes(minutes) : '';
    const inSlot = sortedRecords.filter((record) => { const recordStart = toMinutes(record.from); return recordStart != null && recordStart >= minutes && recordStart < next; });
    slots.push(`<button type="button" class="time-timeline__slot" data-time-slot-from="${formatMinutes(minutes)}" data-time-slot-to="${formatMinutes(next)}" aria-label="${formatMinutes(minutes)}–${formatMinutes(next)}"><span class="time-timeline__hour">${label}</span><span class="time-timeline__line">${inSlot.map(recordMarkup).join('')}<span class="time-timeline__quarter" aria-hidden="true"></span></span></button>`);
  }
  return `<section class="time-timeline" data-time-timeline data-time-from="${from}" data-time-to="${to}">${slots.join('')}</section>`;
}
export function initJournalDayTimeline(root, { onSlotClick = () => {} } = {}) {
  root.querySelectorAll('[data-time-slot-from]').forEach((slot) => slot.addEventListener('click', () => onSlotClick({ from: slot.dataset.timeSlotFrom || '', to: slot.dataset.timeSlotTo || '' })));
}

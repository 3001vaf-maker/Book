function toMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}
function formatMinutes(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
const escape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
function recordMarkup(usage) {
  const client = usage?.client || {}, name = [client.name, client.surname].filter(Boolean).join(' ') || 'Без имени';
  const id = client.id ? `${escape(client.id)} ` : '';
  const phone = client.phone ? `<span>${escape(client.phone)}</span>` : '';
  const services = (usage.procedures || []).map((item) => `<span>${escape(item.name)}</span>`).join('');
  return `<span class="journal-record" data-journal-record="${escape(usage.id)}"><strong>${id}${escape(name)}</strong>${phone}${services}</span>`;
}
export function journalDayTimeline({ from = '09:00', to = '18:00', usages = [] } = {}) {
  const start = toMinutes(from), end = toMinutes(to);
  if (start == null || end == null || end <= start) return '';
  const slots = [], activeUsages = Array.isArray(usages) ? usages : [];
  const firstSlot = Math.ceil(start / 30) * 30;
  for (let minutes = firstSlot; minutes < end; minutes += 30) {
    const next = Math.min(minutes + 30, end);
    const usage = activeUsages.find((item) => {
      const usageStart = toMinutes(item?.from), usageEnd = toMinutes(item?.to);
      return usageStart != null && usageEnd != null && usageStart < next && usageEnd > minutes;
    }) || null;
    const body = usage?.type === 'record' ? recordMarkup(usage) : '';
    slots.push(`<button type="button" class="time-timeline__slot${usage ? ' is-occupied' : ''}" data-time-slot-from="${formatMinutes(minutes)}" data-time-slot-to="${formatMinutes(next)}" data-time-slot-usage="${escape(usage?.id || '')}" aria-label="${formatMinutes(minutes)}–${formatMinutes(next)}"><span class="time-timeline__hour">${formatMinutes(minutes)}</span><span class="time-timeline__line">${body}<span class="time-timeline__quarter" aria-hidden="true"></span></span></button>`);
  }
  return `<section class="time-timeline" data-time-timeline data-time-from="${from}" data-time-to="${to}">${slots.join('')}</section>`;
}

function releaseUsageFromTimeline(root, usageId) {
  if (!usageId) return;
  root.querySelectorAll(`[data-time-slot-usage="${CSS.escape(String(usageId))}"]`).forEach((slot) => {
    slot.classList.remove('is-occupied');
    slot.dataset.timeSlotUsage = '';
    slot.querySelector('[data-journal-record]')?.remove();
  });
}

export function initJournalDayTimeline(root, { onSlotClick = () => {}, usages = [] } = {}) {
  if (root.__bookTimeUsageChangeHandler) window.removeEventListener('book:time-usage-changed', root.__bookTimeUsageChangeHandler);
  root.__bookTimeUsageChangeHandler = (event) => {
    const detail = event.detail || {};
    if (detail.action === 'release') releaseUsageFromTimeline(root, detail.usageId);
  };
  window.addEventListener('book:time-usage-changed', root.__bookTimeUsageChangeHandler);

  root.querySelectorAll('[data-time-slot-from]').forEach((slot) => slot.addEventListener('click', () => {
    const clickedFrom = slot.dataset.timeSlotFrom || '';
    const clickedMinutes = toMinutes(clickedFrom);
    const hourStart = clickedMinutes == null ? clickedFrom : formatMinutes(Math.floor(clickedMinutes / 60) * 60);
    const hourEnd = clickedMinutes == null ? (slot.dataset.timeSlotTo || '') : formatMinutes(Math.floor(clickedMinutes / 60) * 60 + 60);
    const usage = (Array.isArray(usages) ? usages : []).find((item) => item?.id === slot.dataset.timeSlotUsage) || null;
    onSlotClick({ from: hourStart, to: hourEnd, slotFrom: clickedFrom, slotTo: slot.dataset.timeSlotTo || '', usage });
  }));
}

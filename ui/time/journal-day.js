function toMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}
function formatMinutes(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
const escape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function recordMarkup(usage, timelineStart, timelineEnd) {
  const usageStart = toMinutes(usage?.from), usageEnd = toMinutes(usage?.to);
  if (usageStart == null || usageEnd == null || usageEnd <= usageStart) return '';
  const total = timelineEnd - timelineStart;
  const top = Math.max(0, usageStart - timelineStart);
  const height = Math.max(30, usageEnd - usageStart);
  const client = usage?.client || {};
  const name = [client.name, client.surname].filter(Boolean).join(' ') || 'Без имени';
  const id = client.id ? `${escape(client.id)} ` : '';
  const phone = client.phone ? `<span>${escape(client.phone)}</span>` : '';
  const services = (usage.procedures || []).map((item) => `<span>${escape(item.name)}</span>`).join('');
  const topPercent = total > 0 ? (top / total) * 100 : 0;
  const heightPercent = total > 0 ? ((usageEnd - usageStart) / total) * 100 : 0;
  return `<button type="button" class="journal-record" data-journal-record="${escape(usage.id || usage.sourceId || '')}" style="--record-top:${topPercent}%;--record-height:${heightPercent}%;" aria-label="${escape(`${usage.from}–${usage.to} ${name}`)}"><strong>${id}${escape(name)}</strong>${phone}${services}</button>`;
}

export function journalDayTimeline({ from = '09:00', to = '18:00', usages = [] } = {}) {
  const start = toMinutes(from), end = toMinutes(to);
  if (start == null || end == null || end <= start) return '';
  const activeUsages = Array.isArray(usages) ? usages : [];
  const slots = [];
  const firstSlot = Math.floor(start / 30) * 30;
  for (let minutes = firstSlot; minutes < end; minutes += 30) {
    const slotStart = Math.max(minutes, start);
    const slotEnd = Math.min(minutes + 30, end);
    if (slotEnd <= slotStart) continue;
    const usage = activeUsages.find((item) => {
      const usageStart = toMinutes(item?.from), usageEnd = toMinutes(item?.to);
      return usageStart != null && usageEnd != null && usageStart < slotEnd && usageEnd > slotStart;
    }) || null;
    slots.push(`<button type="button" class="time-timeline__slot${usage ? ' is-occupied' : ''}" data-time-slot-from="${formatMinutes(slotStart)}" data-time-slot-to="${formatMinutes(slotEnd)}" data-time-slot-usage="${escape(usage?.id || usage?.sourceId || '')}" aria-label="${formatMinutes(slotStart)}–${formatMinutes(slotEnd)}"><span class="time-timeline__hour">${formatMinutes(slotStart)}</span><span class="time-timeline__line"></span></button>`);
  }
  const records = activeUsages.filter((item) => item?.type === 'record');
  const usageMarkup = records.map((usage) => recordMarkup(usage, start, end)).join('');
  return `<section class="time-timeline" data-time-timeline data-time-from="${escape(from)}" data-time-to="${escape(to)}"><div class="time-timeline__grid">${slots.join('')}</div><div class="time-timeline__usage-layer">${usageMarkup}</div></section>`;
}

function releaseUsageFromTimeline(root, usageId) {
  if (!usageId) return;
  root.querySelector(`[data-journal-record="${CSS.escape(String(usageId))}"]`)?.remove();
  root.querySelectorAll(`[data-time-slot-usage="${CSS.escape(String(usageId))}"]`).forEach((slot) => {
    slot.classList.remove('is-occupied');
    slot.dataset.timeSlotUsage = '';
  });
}

export function initJournalDayTimeline(root, { onSlotClick = () => {}, usages = [] } = {}) {
  if (root.__bookTimeUsageChangeHandler) window.removeEventListener('book:time-usage-changed', root.__bookTimeUsageChangeHandler);
  root.__bookTimeUsageChangeHandler = (event) => {
    const detail = event.detail || {};
    if (detail.action === 'release') releaseUsageFromTimeline(root, detail.usageId);
  };
  window.addEventListener('book:time-usage-changed', root.__bookTimeUsageChangeHandler);

  root.querySelectorAll('[data-journal-record]').forEach((recordNode) => recordNode.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const usage = (Array.isArray(usages) ? usages : []).find((item) => String(item?.id || item?.sourceId || '') === String(recordNode.dataset.journalRecord || '')) || null;
    if (!usage) return;
    onSlotClick({ from: usage.from, to: usage.to, slotFrom: usage.from, slotTo: usage.to, usage });
  }));

  root.querySelectorAll('[data-time-slot-from]').forEach((slot) => slot.addEventListener('click', () => {
    const clickedFrom = slot.dataset.timeSlotFrom || '';
    const clickedTo = slot.dataset.timeSlotTo || '';
    const usage = (Array.isArray(usages) ? usages : []).find((item) => String(item?.id || item?.sourceId || '') === String(slot.dataset.timeSlotUsage || '')) || null;
    if (usage) return;
    onSlotClick({ from: clickedFrom, to: clickedTo, slotFrom: clickedFrom, slotTo: clickedTo, usage: null });
  }));
}

import { timeToMinutes, minutesToTime } from '../../core/time.js';

const escape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function recordMarkup(usage) {
  const client = usage?.client || {};
  const name = [client.name, client.surname].filter(Boolean).join(' ') || 'Без имени';
  const id = client.id ? `${escape(client.id)} ` : '';
  const phone = client.phone ? `<span>${escape(client.phone)}</span>` : '';
  const services = (usage.procedures || []).map((item) => `<span>${escape(item.name)}</span>`).join('');
  return `<button type="button" class="journal-record" data-journal-record="${escape(usage.id)}"><strong>${id}${escape(name)}</strong>${phone}${services}</button>`;
}

export function journalDayTimeline({ from = '09:00', to = '18:00', usages = [] } = {}) {
  const start = timeToMinutes(from), end = timeToMinutes(to);
  if (start == null || end == null || end <= start) return '';
  const total = end - start;
  const slots = [];
  for (let minutes = Math.ceil(start / 30) * 30; minutes < end; minutes += 30) {
    const next = Math.min(minutes + 30, end);
    const relative = minutes - start;
    const label = minutesToTime(minutes);
    slots.push(`<button type="button" class="time-timeline__slot" data-time-slot-from="${label}" data-time-slot-to="${minutesToTime(next)}" aria-label="${label}–${minutesToTime(next)}"><span class="time-timeline__hour">${label}</span><span class="time-timeline__line"></span></button>`);
  }

  const overlays = (Array.isArray(usages) ? usages : []).map((usage) => {
    const usageStart = timeToMinutes(usage?.from), usageEnd = timeToMinutes(usage?.to);
    if (usageStart == null || usageEnd == null || usageEnd <= usageStart || usageEnd <= start || usageStart >= end) return '';
    const clippedStart = Math.max(start, usageStart), clippedEnd = Math.min(end, usageEnd);
    const top = ((clippedStart - start) / total) * 100;
    const height = ((clippedEnd - clippedStart) / total) * 100;
    const body = usage?.type === 'record' ? recordMarkup(usage) : `<button type="button" class="journal-record journal-record--break" data-journal-break="${escape(usage.id)}"><strong>Занято</strong></button>`;
    return `<div class="time-timeline__usage" style="top:${top}%;height:${height}%" data-time-usage="${escape(usage.id)}">${body}</div>`;
  }).join('');

  return `<section class="time-timeline" data-time-timeline data-time-from="${escape(from)}" data-time-to="${escape(to)}" style="--time-total-minutes:${total}">${slots.join('')}<div class="time-timeline__usages">${overlays}</div></section>`;
}

export function initJournalDayTimeline(root, { onSlotClick = () => {}, usages = [] } = {}) {
  if (root.__bookTimeUsageChangeHandler) window.removeEventListener('book:time-usage-changed', root.__bookTimeUsageChangeHandler);
  root.__bookTimeUsageChangeHandler = () => {};
  window.addEventListener('book:time-usage-changed', root.__bookTimeUsageChangeHandler);

  root.querySelectorAll('[data-time-slot-from]').forEach((slot) => slot.addEventListener('click', () => {
    const from = slot.dataset.timeSlotFrom || '';
    const to = slot.dataset.timeSlotTo || '';
    const point = timeToMinutes(from);
    const usage = (Array.isArray(usages) ? usages : []).find((item) => {
      const start = timeToMinutes(item?.from), end = timeToMinutes(item?.to);
      return point != null && start != null && end != null && start <= point && point < end;
    }) || null;
    onSlotClick({ from, to, usage });
  }));

  root.querySelectorAll('[data-journal-record]').forEach((node) => node.addEventListener('click', (event) => {
    event.stopPropagation();
    const usage = (Array.isArray(usages) ? usages : []).find((item) => String(item?.id) === String(node.dataset.journalRecord));
    if (usage) onSlotClick({ from: usage.from, to: usage.to, usage });
  }));
}

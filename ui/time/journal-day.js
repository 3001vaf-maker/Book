import { timeToMinutes, minutesToTime } from '../../core/time.js';

const escape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const moneyText = (value) => `${Math.max(0, Number(value) || 0).toLocaleString('ru-RU')} ₽`;

function recordMarkup(usage) {
  const client = usage?.client || {};
  const name = [client.name, client.surname].filter(Boolean).join(' ') || 'Без имени';
  const id = String(client.uei || client.id || '').trim();
  const identity = id ? `${escape(id)} - ${escape(name)}` : escape(name);
  const total = moneyText(usage?.financialTotal ?? usage?.finance?.dueTotal ?? 0);
  const phone = client.phone ? `<span class="journal-record__phone">${escape(client.phone)}</span>` : '';
  const services = (usage.procedures || []).map((item) => `<span class="journal-record__service">${escape(item.name)}</span>`).join('');
  const statusClass = usage?.paid ? ' journal-record--paid' : usage?.attendance === 'no-show' ? ' journal-record--no-show' : '';
  return `<button type="button" class="journal-record${statusClass}" data-journal-record="${escape(usage.id)}"><span class="journal-record__head"><strong class="journal-record__identity">${identity}</strong><strong class="journal-record__total">${escape(total)}</strong></span>${phone}${services}</button>`;
}

function usageMarkup(usage) {
  return usage?.type === 'record'
    ? recordMarkup(usage)
    : `<button type="button" class="journal-record journal-record--break" data-journal-break="${escape(usage.id)}"><strong>Перерыв</strong></button>`;
}

function slotsMarkup(start, end, { interactive = true } = {}) {
  const slots = [];
  for (let minutes = Math.ceil(start / 30) * 30; minutes < end; minutes += 30) {
    const next = Math.min(minutes + 30, end);
    const label = minutesToTime(minutes);
    const inner = `<span class="time-timeline__hour">${label}</span><span class="time-timeline__line"></span>`;
    slots.push(interactive
      ? `<button type="button" class="time-timeline__slot" data-time-slot-from="${label}" data-time-slot-to="${minutesToTime(next)}" aria-label="${label}–${minutesToTime(next)}">${inner}</button>`
      : `<div class="time-timeline__slot time-timeline__slot--readonly" aria-hidden="true">${inner}</div>`);
  }
  return slots.join('');
}

function aggregateTimeline(columns = []) {
  const prepared = (Array.isArray(columns) ? columns : []).map((column) => {
    const start = timeToMinutes(column?.from);
    const end = timeToMinutes(column?.to);
    if (start == null || end == null || end <= start) return null;
    return { ...column, start, end, usages: Array.isArray(column?.usages) ? column.usages : [] };
  }).filter(Boolean);
  if (!prepared.length) return '';

  const start = Math.min(...prepared.map((column) => column.start));
  const end = Math.max(...prepared.map((column) => column.end));
  const total = end - start;
  const minWidth = 56 + prepared.length * 104;
  const headings = prepared.map((column) => `<strong class="journal-day-columns__heading">${escape(column?.name || 'Рабочее место')}</strong>`).join('');

  const fields = prepared.map((column) => {
    const top = ((column.start - start) / total) * 100;
    const height = ((column.end - column.start) / total) * 100;
    const fieldDuration = column.end - column.start;
    const usages = column.usages.map((usage) => {
      const usageStart = timeToMinutes(usage?.from);
      const usageEnd = timeToMinutes(usage?.to);
      if (usageStart == null || usageEnd == null || usageEnd <= usageStart || usageEnd <= column.start || usageStart >= column.end) return '';
      const clippedStart = Math.max(column.start, usageStart);
      const clippedEnd = Math.min(column.end, usageEnd);
      const usageTop = ((clippedStart - column.start) / fieldDuration) * 100;
      const usageHeight = ((clippedEnd - clippedStart) / fieldDuration) * 100;
      return `<div class="journal-work-field__usage" style="top:${usageTop}%;height:${usageHeight}%" data-time-usage="${escape(usage.id)}">${usageMarkup(usage)}</div>`;
    }).join('');
    return `<div class="journal-work-column"><div class="journal-work-field${column?.conflict ? ' is-conflict' : ''}" style="top:${top}%;height:${height}%" data-journal-work-field="${escape(column?.workplaceId || '')}">${usages}</div></div>`;
  }).join('');

  return `<div class="journal-day-columns" data-journal-day-columns><div class="journal-day-columns__inner" style="min-width:${minWidth}px;--journal-column-count:${prepared.length}"><div class="journal-day-columns__headings"><span aria-hidden="true"></span>${headings}</div><section class="time-timeline time-timeline--columns" data-time-timeline data-time-from="${escape(minutesToTime(start))}" data-time-to="${escape(minutesToTime(end))}" style="--time-total-minutes:${total}">${slotsMarkup(start, end, { interactive: false })}<div class="journal-work-columns">${fields}</div></section></div></div>`;
}

export function journalDayTimeline({ from = '09:00', to = '18:00', usages = [], columns = [] } = {}) {
  if (Array.isArray(columns) && columns.length) return aggregateTimeline(columns);
  const start = timeToMinutes(from), end = timeToMinutes(to);
  if (start == null || end == null || end <= start) return '';
  const total = end - start;
  const overlays = (Array.isArray(usages) ? usages : []).map((usage) => {
    const usageStart = timeToMinutes(usage?.from), usageEnd = timeToMinutes(usage?.to);
    if (usageStart == null || usageEnd == null || usageEnd <= usageStart || usageEnd <= start || usageStart >= end) return '';
    const clippedStart = Math.max(start, usageStart), clippedEnd = Math.min(end, usageEnd);
    const top = ((clippedStart - start) / total) * 100;
    const height = ((clippedEnd - clippedStart) / total) * 100;
    return `<div class="time-timeline__usage" style="top:${top}%;height:${height}%" data-time-usage="${escape(usage.id)}">${usageMarkup(usage)}</div>`;
  }).join('');

  return `<section class="time-timeline" data-time-timeline data-time-from="${escape(from)}" data-time-to="${escape(to)}" style="--time-total-minutes:${total}">${slotsMarkup(start, end)}<div class="time-timeline__usages">${overlays}</div></section>`;
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

  root.querySelectorAll('[data-journal-record],[data-journal-break]').forEach((node) => node.addEventListener('click', (event) => {
    event.stopPropagation();
    const usageId = node.dataset.journalRecord || node.dataset.journalBreak || '';
    const usage = (Array.isArray(usages) ? usages : []).find((item) => String(item?.id) === String(usageId));
    if (usage) onSlotClick({ from: usage.from, to: usage.to, usage });
  }));
}

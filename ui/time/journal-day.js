function toMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatMinutes(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function journalDayTimeline({ from = '09:00', to = '18:00' } = {}) {
  const start = toMinutes(from);
  const end = toMinutes(to);
  if (start == null || end == null || end <= start) return '';

  const slots = [];
  const firstSlot = Math.ceil(start / 30) * 30;
  for (let minutes = firstSlot; minutes < end; minutes += 30) {
    const next = Math.min(minutes + 30, end);
    slots.push(`<button type="button" class="time-timeline__slot" data-time-slot-from="${formatMinutes(minutes)}" data-time-slot-to="${formatMinutes(next)}" aria-label="${formatMinutes(minutes)}–${formatMinutes(next)}"><span class="time-timeline__hour">${formatMinutes(minutes)}</span><span class="time-timeline__line"><span class="time-timeline__quarter" aria-hidden="true"></span></span></button>`);
  }

  return `<section class="time-timeline" data-time-timeline data-time-from="${from}" data-time-to="${to}">${slots.join('')}</section>`;
}

export function initJournalDayTimeline(root, { onSlotClick = () => {} } = {}) {
  root.querySelectorAll('[data-time-slot-from]').forEach((slot) => {
    slot.addEventListener('click', () => onSlotClick({
      from: slot.dataset.timeSlotFrom || '',
      to: slot.dataset.timeSlotTo || '',
    }));
  });
}

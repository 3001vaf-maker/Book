import { escapeHtml } from '../utils/escape-html.js';

const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const weekDays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function gridDays(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthLastDay = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = startOffset; i > 0; i -= 1) cells.push(new Date(year, month - 1, previousMonthLastDay - i + 1));
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  for (let day = 1; cells.length < 42; day += 1) cells.push(new Date(year, month + 1, day));

  return cells;
}

export function calendar({ year, month, states = {}, selected = [], multiple = true } = {}) {
  const cells = gridDays(year, month);
  const selectedSet = new Set(selected);
  const header = `<div class="calendar__header"><button type="button" class="icon-button calendar__nav" data-calendar-prev aria-label="Предыдущий месяц">‹</button><strong>${monthNames[month]} ${year}</strong><button type="button" class="icon-button calendar__nav" data-calendar-next aria-label="Следующий месяц">›</button></div>`;
  const weekdays = `<div class="calendar__weekdays">${weekDays.map((day) => `<span>${day}</span>`).join('')}</div>`;
  const days = `<div class="calendar__grid" data-calendar-multiple="${multiple ? 'true' : 'false'}">${cells.map((date) => {
    const key = isoDate(date);
    const state = states[key];
    const outside = date.getMonth() !== month || date.getFullYear() !== year;
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const working = state?.working === true;
    const selectedNow = selectedSet.has(key);
    const classes = ['calendar__day'];
    if (outside) classes.push('is-outside');
    if (weekend) classes.push('is-weekend');
    if (working) classes.push('is-working');
    if (selectedNow) classes.push(working ? 'is-selected-working' : 'is-selected-off');
    return `<button type="button" class="${classes.join(' ')}" data-calendar-date="${key}" data-calendar-working="${working}" aria-pressed="${selectedNow}"><span class="calendar__day-number">${date.getDate()}</span>${working && !outside ? `<small class="calendar__day-time"><span>${escapeHtml(state.start)}</span><span>${escapeHtml(state.end)}</span></small>` : ''}</button>`;
  }).join('')}</div>`;

  return `<section class="calendar" data-calendar data-calendar-year="${year}" data-calendar-month="${month}" data-calendar-multiple="${multiple ? 'true' : 'false'}">${header}${weekdays}${days}</section>`;
}

export function initCalendarSelection(root) {
  const host = root.querySelector('[data-calendar]');
  if (!host) return;
  const multiple = host.dataset.calendarMultiple !== 'false';
  host.querySelectorAll('[data-calendar-date]').forEach((element) => {
    element.addEventListener('click', () => {
      host.dispatchEvent(new CustomEvent('calendar:date-select', {
        bubbles: true,
        detail: { date: element.dataset.calendarDate, working: element.dataset.calendarWorking === 'true', multiple }
      }));
    });
  });
}

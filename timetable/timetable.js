import { button, calendar, pageHeader, timePicker, initTimePickers } from '../ui/ui.js';

const STORAGE_KEY = 'book.schedule.dates';
const DEFAULT_START = '10:00';
const DEFAULT_END = '18:00';

function readDates() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeDates(dates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dates));
}

function dateKey(value) {
  if (typeof value === 'string') return value;
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : NaN;
}

function validRange(start, end) {
  const from = toMinutes(start);
  const until = toMinutes(end);
  return Number.isFinite(from) && Number.isFinite(until) && from < until;
}

export function getDateResource(value) {
  const key = dateKey(value);
  const state = readDates()[key];
  if (!state?.working) return { date: key, working: false, start: null, end: null };
  return { date: key, working: true, start: state.start, end: state.end };
}

export function isTimeAvailable(value, start, end, occupied = []) {
  const resource = getDateResource(value);
  if (!resource.working || !validRange(start, end)) return false;
  const from = toMinutes(start);
  const until = toMinutes(end);
  if (from < toMinutes(resource.start) || until > toMinutes(resource.end)) return false;
  return !occupied.some((item) => validRange(item.start, item.end) && from < toMinutes(item.end) && until > toMinutes(item.start));
}

export function changeDateState(values) {
  const dates = readDates();
  const keys = Array.isArray(values?.dates) ? values.dates.map(dateKey) : [dateKey(values?.date)];
  if (!keys.length || keys.some((key) => !key)) return false;

  if (values.state === 'working') {
    if (!validRange(values.start, values.end)) return false;
    keys.forEach((key) => {
      dates[key] = { working: true, start: values.start, end: values.end };
    });
  } else if (values.state === 'off') {
    keys.forEach((key) => delete dates[key]);
  } else {
    return false;
  }

  writeDates(dates);
  return true;
}

function render(root, viewDate, selected) {
  const dates = readDates();
  const keys = [...selected];
  const first = keys.length ? dates[keys[0]] : null;
  const mode = keys.length ? (first?.working ? 'working' : 'off') : null;
  const interval = mode === 'off' ? `<section class="schedule-interval" aria-label="Рабочий интервал"><h2>Рабочий интервал</h2><div class="schedule-interval__fields">${timePicker({ name: 'scheduleStart', label: 'Начало', value: DEFAULT_START, step: 15 })}${timePicker({ name: 'scheduleEnd', label: 'Окончание', value: DEFAULT_END, step: 15 })}</div></section>` : '';
  const action = mode === 'off'
    ? button('Применить рабочий день', { data: 'data-schedule-working' })
    : mode === 'working'
      ? button('Применить выходной', { className: 'ui-button--secondary', data: 'data-schedule-off' })
      : '';

  root.innerHTML = `${pageHeader('График')}${calendar({ year: viewDate.getFullYear(), month: viewDate.getMonth(), states: dates, selected: keys })}${keys.length ? `<section class="schedule-controls"><div class="schedule-selection">Выбрано дат: <strong>${keys.length}</strong></div>${interval}<div class="schedule-actions">${action}</div></section>` : ''}`;

  initTimePickers(root);

  root.querySelector('[data-calendar-prev]')?.addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    render(root, viewDate, selected);
  });
  root.querySelector('[data-calendar-next]')?.addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    render(root, viewDate, selected);
  });

  root.querySelectorAll('[data-calendar-date]').forEach((element) => element.addEventListener('click', () => {
    const key = element.dataset.calendarDate;
    const state = dates[key]?.working === true;
    if (!keys.length) {
      selected.add(key);
    } else {
      const firstState = dates[keys[0]]?.working === true;
      if (state !== firstState) return;
      if (selected.has(key)) selected.delete(key); else selected.add(key);
    }
    render(root, viewDate, selected);
  }));

  root.querySelector('[data-schedule-working]')?.addEventListener('click', () => {
    const form = root.querySelector('.schedule-interval');
    const start = form?.querySelector('[data-time-value][name="scheduleStart"]')?.value;
    const end = form?.querySelector('[data-time-value][name="scheduleEnd"]')?.value;
    if (!validRange(start, end)) return;
    changeDateState({ dates: keys, state: 'working', start, end });
    selected.clear();
    render(root, viewDate, selected);
  });

  root.querySelector('[data-schedule-off]')?.addEventListener('click', () => {
    changeDateState({ dates: keys, state: 'off' });
    selected.clear();
    render(root, viewDate, selected);
  });
}

export function renderTimetable(root) {
  render(root, new Date(), new Set());
}

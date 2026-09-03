import { dateKey } from '../ui/calendar/calendar.js';

const DAY_FORMATTER = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function dayLabel(date) {
  const label = DAY_FORMATTER.format(date);
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} г.`;
}

function parseDate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function renderNavigator(date) {
  return `<header class="calendar__header" data-journal-day-navigator><button type="button" class="calendar__month-button" data-journal-day-prev aria-label="Предыдущий день">←</button><div class="calendar__month" aria-live="polite">${dayLabel(date)}</div><button type="button" class="calendar__month-button" data-journal-day-next aria-label="Следующий день">→</button></header>`;
}

export function renderJournalDay(root, initialDate = new Date()) {
  let selectedDate = new Date(initialDate.getFullYear(), initialDate.getMonth(), initialDate.getDate());

  const render = () => {
    root.innerHTML = renderNavigator(selectedDate);

    root.querySelector('[data-journal-day-prev]')?.addEventListener('click', () => {
      selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1);
      render();
    });

    root.querySelector('[data-journal-day-next]')?.addEventListener('click', () => {
      selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1);
      render();
    });
  };

  render();

  return {
    getSelectedDate: () => new Date(selectedDate),
    getSelectedDateKey: () => dateKey(selectedDate),
  };
}

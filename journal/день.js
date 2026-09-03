import { dateNavigator, initDateNavigator } from '../ui/calendar/calendar.js';

const DAY_FORMATTER = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayLabel(date) {
  const label = DAY_FORMATTER.format(date);
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} г.`;
}

export function renderJournalDay(root, initialDate = new Date()) {
  let selectedDate = new Date(initialDate.getFullYear(), initialDate.getMonth(), initialDate.getDate());

  const render = () => {
    root.innerHTML = dateNavigator({
      label: dayLabel(selectedDate),
      prevLabel: 'Предыдущий день',
      nextLabel: 'Следующий день',
    });

    initDateNavigator(root, {
      onPrev: () => {
        selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1);
        render();
      },
      onNext: () => {
        selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1);
        render();
      },
    });
  };

  render();

  return {
    getSelectedDate: () => new Date(selectedDate),
    getSelectedDateKey: () => dateKey(selectedDate),
  };
}

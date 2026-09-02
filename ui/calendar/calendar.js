const MONTH_FORMATTER = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });

function pad(value) { return String(value).padStart(2, '0'); }
function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function startOfMondayWeek(date) { const result = new Date(date.getFullYear(), date.getMonth(), date.getDate()); const weekday = (result.getDay() + 6) % 7; result.setDate(result.getDate() - weekday); return result; }
function endOfSundayWeek(date) { const result = new Date(date.getFullYear(), date.getMonth(), date.getDate()); const weekday = (result.getDay() + 6) % 7; result.setDate(result.getDate() + (6 - weekday)); return result; }
function monthLabel(date) { const label = MONTH_FORMATTER.format(date); return label.charAt(0).toUpperCase() + label.slice(1); }

function buildCalendar({ displayedMonth, selectedDate = '', selectedDates = [], multipleSelection = false, workingDates = [], renderDateContent = () => '' } = {}) {
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = startOfMondayWeek(firstDay);
  const end = endOfSundayWeek(lastDay);
  const todayKey = dateKey(new Date());
  const working = new Set(workingDates);
  const selected = new Set(multipleSelection ? selectedDates : (selectedDate ? [selectedDate] : []));
  const cells = [];

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = new Date(cursor);
    const key = dateKey(date);
    const isCurrentMonth = date.getMonth() === month;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isSelected = selected.has(key);
    const classes = ['calendar__date', isCurrentMonth ? '' : 'is-neighbor', isWeekend ? 'is-weekend' : '', working.has(key) ? 'is-working' : '', key === todayKey ? 'is-today' : '', isSelected ? 'is-selected' : ''].filter(Boolean).join(' ');
    const style = [isCurrentMonth ? 'border:1px solid var(--border);border-radius:8px;background:var(--white)' : '', key === todayKey ? 'border:1px solid #C9A895;background:#DCC4B4' : ''].filter(Boolean).join(';');
    const content = renderDateContent({ date, dateKey: key, isCurrentMonth, isWeekend, isWorking: working.has(key), isToday: key === todayKey, isSelected });
    cells.push(`<button type="button" class="${classes}"${style ? ` style="${style}"` : ''} data-calendar-date="${key}" aria-pressed="${isSelected}"><span class="calendar__date-number">${date.getDate()}</span>${content ? `<span class="calendar__date-content">${content}</span>` : '<span class="calendar__date-content" aria-hidden="true"></span>'}</button>`);
  }

  return `<section class="calendar" data-calendar><header class="calendar__header"><button type="button" class="calendar__month-button" data-calendar-prev aria-label="Предыдущий месяц">←</button><div class="calendar__month" aria-live="polite">${monthLabel(displayedMonth)}</div><button type="button" class="calendar__month-button" data-calendar-next aria-label="Следующий месяц">→</button></header><div class="calendar__weekdays" aria-hidden="true">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => `<span>${day}</span>`).join('')}</div><div class="calendar__grid">${cells.join('')}</div></section>`;
}

export function calendar(options = {}) {
  const displayedMonth = options.month ? new Date(options.month.getFullYear(), options.month.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  return buildCalendar({ ...options, displayedMonth });
}

export function initCalendar(root, options = {}) {
  let displayedMonth = options.month ? new Date(options.month.getFullYear(), options.month.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const multipleSelection = options.multipleSelection === true;
  let selectedDate = options.selectedDate || '';
  let selectedDates = [...new Set(options.selectedDates || (selectedDate ? [selectedDate] : []))];
  const workingDates = options.workingDates || [];
  const renderDateContent = options.renderDateContent || (() => '');
  const onDateSelect = options.onDateSelect || (() => {});
  const render = () => {
    root.innerHTML = buildCalendar({ displayedMonth, selectedDate, selectedDates, multipleSelection, workingDates, renderDateContent });
    root.querySelector('[data-calendar-prev]')?.addEventListener('click', () => { displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1); render(); });
    root.querySelector('[data-calendar-next]')?.addEventListener('click', () => { displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1); render(); });
    root.querySelectorAll('[data-calendar-date]').forEach((button) => button.addEventListener('click', () => {
      const value = button.dataset.calendarDate || '';
      if (multipleSelection) {
        selectedDates = selectedDates.includes(value) ? selectedDates.filter((item) => item !== value) : [...selectedDates, value];
        selectedDate = selectedDates[selectedDates.length - 1] || '';
        onDateSelect([...selectedDates]);
      } else {
        selectedDate = value;
        selectedDates = value ? [value] : [];
        onDateSelect(selectedDate);
      }
      render();
    }));
  };
  render();
  return {
    getSelectedDate: () => selectedDate,
    getSelectedDates: () => [...selectedDates],
    getDisplayedMonth: () => new Date(displayedMonth),
    setSelectedDate: (value) => { selectedDate = value || ''; selectedDates = selectedDate ? [selectedDate] : []; render(); },
    setSelectedDates: (values) => { selectedDates = [...new Set(values || [])]; selectedDate = selectedDates[selectedDates.length - 1] || ''; render(); },
  };
}

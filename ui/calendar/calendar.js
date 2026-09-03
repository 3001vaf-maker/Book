const MONTH_FORMATTER = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });

export function dateNavigator({ label = '', prevLabel = 'Предыдущий период', nextLabel = 'Следующий период' } = {}) {
  return `<header class="calendar__header"><button type="button" class="calendar__month-button" data-date-navigator-prev aria-label="${prevLabel}">←</button><div class="calendar__month" aria-live="polite">${label}</div><button type="button" class="calendar__month-button" data-date-navigator-next aria-label="${nextLabel}">→</button></header>`;
}

export function initDateNavigator(root, { onPrev = () => {}, onNext = () => {} } = {}) {
  root.querySelector('[data-date-navigator-prev]')?.addEventListener('click', onPrev);
  root.querySelector('[data-date-navigator-next]')?.addEventListener('click', onNext);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMondayWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - weekday);
  return result;
}

function endOfSundayWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() + (6 - weekday));
  return result;
}

function monthLabel(date) {
  const label = MONTH_FORMATTER.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildCalendar({ displayedMonth, workingDates = [], renderDateContent = () => '' } = {}) {
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = startOfMondayWeek(firstDay);
  const end = endOfSundayWeek(lastDay);
  const todayKey = dateKey(new Date());
  const working = new Set(workingDates);
  const cells = [];

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = new Date(cursor);
    const key = dateKey(date);
    const isCurrentMonth = date.getMonth() === month;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const classes = [
      'calendar__date',
      isCurrentMonth ? '' : 'is-neighbor',
      isWeekend ? 'is-weekend' : '',
      working.has(key) ? 'is-working' : '',
      key === todayKey ? 'is-today' : '',
    ].filter(Boolean).join(' ');
    const style = [
      isCurrentMonth ? 'border:1px solid var(--border);border-radius:8px;background:var(--white)' : '',
      key === todayKey ? 'border:1px solid #C9A895;background:#DCC4B4' : '',
    ].filter(Boolean).join(';');

    const content = renderDateContent({
      date,
      dateKey: key,
      isCurrentMonth,
      isWeekend,
      isWorking: working.has(key),
      isToday: key === todayKey,
      isSelected: false,
    });

    cells.push(`<button type="button" class="${classes}"${style ? ` style="${style}"` : ''} data-calendar-date="${key}" data-calendar-current-month="${isCurrentMonth}" aria-pressed="false"><span class="calendar__date-number">${date.getDate()}</span>${content ? `<span class="calendar__date-content">${content}</span>` : '<span class="calendar__date-content" aria-hidden="true"></span>'}</button>`);
  }

  return `<section class="calendar" data-calendar>${dateNavigator({ label: monthLabel(displayedMonth), prevLabel: 'Предыдущий месяц', nextLabel: 'Следующий месяц' })}<div class="calendar__weekdays" aria-hidden="true">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => `<span>${day}</span>`).join('')}</div><div class="calendar__grid">${cells.join('')}</div></section>`;
}

export function calendar(options = {}) {
  const displayedMonth = options.month ? new Date(options.month.getFullYear(), options.month.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  return buildCalendar({ ...options, displayedMonth });
}

export function initCalendar(root, options = {}) {
  let displayedMonth = options.month ? new Date(options.month.getFullYear(), options.month.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const workingDates = options.workingDates || [];
  const renderDateContent = options.renderDateContent || (() => '');
  const onDateSelect = options.onDateSelect || (() => {});
  const onMonthChange = options.onMonthChange || (() => {});
  const render = () => {
    root.innerHTML = buildCalendar({ displayedMonth, workingDates, renderDateContent });
    initDateNavigator(root, {
      onPrev: () => {
        displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
        render();
        onMonthChange(new Date(displayedMonth));
      },
      onNext: () => {
        displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
        render();
        onMonthChange(new Date(displayedMonth));
      },
    });
    root.querySelectorAll('[data-calendar-date]').forEach((button) => {
      button.addEventListener('click', () => {
        onDateSelect(button.dataset.calendarDate || '');
      });
    });
  };

  render();

  return {
    getDisplayedMonth: () => new Date(displayedMonth),
  };
}

import { modal, mountModal } from '../modals/index.js';
import { button } from '../buttons/index.js';
import { escapeHtml } from '../utils/escape-html.js';

const MONTH_FORMATTER = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const MONTH_ONLY_FORMATTER = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const MONTH_DAY_REFERENCE_YEAR = 2000;

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthDayKey(date) {
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseMonthDay(value = '') {
  const text = String(value || '').trim();
  const direct = text.match(/^(\d{2})-(\d{2})$/);
  const legacy = text.match(/^\d{4}-(\d{2})-(\d{2})$/);
  const match = direct || legacy;
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1) return null;
  const date = new Date(MONTH_DAY_REFERENCE_YEAR, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
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

function capitalize(label) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthLabel(date, mode = 'date') {
  return capitalize((mode === 'month-day' ? MONTH_ONLY_FORMATTER : MONTH_FORMATTER).format(date));
}

function dateLabel(date) {
  return capitalize(DATE_FORMATTER.format(date));
}

function monthDayLabel(value) {
  const date = value instanceof Date ? value : parseMonthDay(value);
  return date ? MONTH_DAY_FORMATTER.format(date) : '';
}

function calendarHeader({ label, prevAriaLabel, nextAriaLabel, prevAttribute, nextAttribute }) {
  return `<header class="calendar__header"><button type="button" class="calendar__month-button" ${prevAttribute} aria-label="${prevAriaLabel}">←</button><div class="calendar__month" aria-live="polite">${label}</div><button type="button" class="calendar__month-button" ${nextAttribute} aria-label="${nextAriaLabel}">→</button></header>`;
}

function normalizeDateIndicators(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return { color: item, label: '' };
    if (!item || typeof item !== 'object') return null;
    return { color: String(item.color || ''), label: String(item.label || '') };
  }).filter((item) => item?.color);
}

function dateIndicatorsMarkup(indicators) {
  const values = normalizeDateIndicators(indicators);
  if (!values.length) return '';
  return `<span class="calendar__date-indicators">${values.map((item) => `<span class="calendar__date-indicator" style="--calendar-indicator:${escapeHtml(item.color)}"${item.label ? ` role="img" aria-label="${escapeHtml(item.label)}" title="${escapeHtml(item.label)}"` : ' aria-hidden="true"'}></span>`).join('')}</span>`;
}

function buildCalendar({ displayedMonth, workingDates = [], renderDateContent = () => '', resolveDateIndicators = () => [], mode = 'date', selectedValue = '' } = {}) {
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = startOfMondayWeek(firstDay);
  const end = endOfSundayWeek(lastDay);
  const today = new Date();
  const todayKey = dateKey(today);
  const working = new Set(workingDates);
  const cells = [];

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = new Date(cursor);
    const key = mode === 'month-day' ? monthDayKey(date) : dateKey(date);
    const fullKey = dateKey(date);
    const isCurrentMonth = date.getMonth() === month;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isToday = mode === 'date' && fullKey === todayKey;
    const isSelected = String(selectedValue || '') === key;
    const isWorking = working.has(fullKey);
    const classes = [
      'calendar__date',
      isCurrentMonth ? '' : 'is-neighbor',
      isWeekend ? 'is-weekend' : '',
      isWorking ? 'is-working' : '',
      isToday ? 'is-today' : '',
      isSelected ? 'is-selected' : '',
    ].filter(Boolean).join(' ');
    const style = [
      isCurrentMonth ? 'border:1px solid var(--border);border-radius:8px;background:var(--white)' : '',
      isToday ? 'border:1px solid #C9A895;background:#DCC4B4' : '',
      isSelected ? 'outline:2px solid var(--text);outline-offset:-2px' : '',
    ].filter(Boolean).join(';');
    const dateMeta = { date, dateKey: key, isCurrentMonth, isWeekend, isWorking, isToday, isSelected };
    const content = renderDateContent(dateMeta);
    const indicators = mode === 'date' ? dateIndicatorsMarkup(resolveDateIndicators(dateMeta)) : '';

    cells.push(`<button type="button" class="${classes}"${style ? ` style="${style}"` : ''} data-calendar-date="${key}" data-calendar-current-month="${isCurrentMonth}" aria-pressed="${isSelected ? 'true' : 'false'}"><span class="calendar__date-number">${date.getDate()}</span>${content ? `<span class="calendar__date-content">${content}</span>` : '<span class="calendar__date-content" aria-hidden="true"></span>'}${indicators}</button>`);
  }

  return `<section class="calendar" data-calendar data-calendar-mode="${mode}">${calendarHeader({ label: monthLabel(displayedMonth, mode), prevAriaLabel: 'Предыдущий месяц', nextAriaLabel: 'Следующий месяц', prevAttribute: 'data-calendar-prev', nextAttribute: 'data-calendar-next' })}<div class="calendar__weekdays" aria-hidden="true">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => `<span>${day}</span>`).join('')}</div><div class="calendar__grid">${cells.join('')}</div></section>`;
}

function initialMonth(options = {}) {
  if (options.month) return new Date(options.month.getFullYear(), options.month.getMonth(), 1);
  if (options.mode === 'month-day') {
    const selected = parseMonthDay(options.selectedValue);
    if (selected) return new Date(MONTH_DAY_REFERENCE_YEAR, selected.getMonth(), 1);
    return new Date(MONTH_DAY_REFERENCE_YEAR, new Date().getMonth(), 1);
  }
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
}

export function calendar(options = {}) {
  const displayedMonth = initialMonth(options);
  return buildCalendar({ ...options, displayedMonth });
}

export function initCalendar(root, options = {}) {
  let displayedMonth = initialMonth(options);
  const mode = options.mode || 'date';
  const workingDates = options.workingDates || [];
  const renderDateContent = options.renderDateContent || (() => '');
  const resolveDateIndicators = options.resolveDateIndicators || (() => []);
  const onDateSelect = options.onDateSelect || (() => {});
  const onMonthChange = options.onMonthChange || (() => {});
  let selectedValue = mode === 'month-day' ? (parseMonthDay(options.selectedValue) ? monthDayKey(parseMonthDay(options.selectedValue)) : '') : String(options.selectedValue || '');
  const render = () => {
    root.innerHTML = buildCalendar({ displayedMonth, workingDates, renderDateContent, resolveDateIndicators, mode, selectedValue });
    root.querySelector('[data-calendar-prev]')?.addEventListener('click', () => {
      displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
      render();
      onMonthChange(new Date(displayedMonth));
    });
    root.querySelector('[data-calendar-next]')?.addEventListener('click', () => {
      displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
      render();
      onMonthChange(new Date(displayedMonth));
    });
    root.querySelectorAll('[data-calendar-date]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedValue = button.dataset.calendarDate || '';
        onDateSelect(selectedValue);
      });
    });
  };

  render();

  return {
    getDisplayedMonth: () => new Date(displayedMonth),
    getSelectedValue: () => selectedValue,
  };
}

export function monthDayPicker({ name = '', label = '', value = '' } = {}) {
  const parsed = parseMonthDay(value);
  const normalized = parsed ? monthDayKey(parsed) : '';
  const text = normalized ? monthDayLabel(normalized) : 'Выберите дату';
  return `<label class="field" data-month-day-picker><span>${escapeHtml(label)}</span><button type="button" class="ui-select__control" data-month-day-open><span class="ui-select__value">${escapeHtml(text)}</span><span class="ui-select__chevron" aria-hidden="true">⌄</span></button><input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(normalized)}" data-month-day-value></label>`;
}

export function initMonthDayPickers(root) {
  root.querySelectorAll('[data-month-day-picker]').forEach((host) => {
    const openButton = host.querySelector('[data-month-day-open]');
    if (!openButton || openButton.dataset.monthDayReady === 'true') return;
    openButton.dataset.monthDayReady = 'true';
    openButton.addEventListener('click', () => openMonthDayPicker(host));
  });
}

function openMonthDayPicker(host) {
  const hidden = host.querySelector('[data-month-day-value]');
  if (!hidden) return;
  const current = parseMonthDay(hidden.value);
  const content = `<div class="modal-title"><h2>${escapeHtml(host.querySelector(':scope > span')?.textContent || 'Дата')}</h2></div><div data-month-day-calendar></div>${hidden.value ? `<div class="modal-actions">${button('Очистить', { data: 'data-month-day-clear', variant: 'secondary' })}</div>` : ''}`;
  const modalRoot = mountModal(document.body, modal(content, { variant: 'medium' }));
  if (!modalRoot) return;
  const calendarRoot = modalRoot.querySelector('[data-month-day-calendar]');
  if (!calendarRoot) return;

  initCalendar(calendarRoot, {
    mode: 'month-day',
    selectedValue: current ? monthDayKey(current) : '',
    month: new Date(MONTH_DAY_REFERENCE_YEAR, current?.getMonth() ?? new Date().getMonth(), 1),
    onDateSelect: (value) => {
      hidden.value = value;
      const visible = host.querySelector('.ui-select__value');
      if (visible) visible.textContent = monthDayLabel(value);
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
      modalRoot.remove();
    },
  });

  modalRoot.querySelector('[data-month-day-clear]')?.addEventListener('click', () => {
    hidden.value = '';
    const visible = host.querySelector('.ui-select__value');
    if (visible) visible.textContent = 'Выберите дату';
    hidden.dispatchEvent(new Event('input', { bubbles: true }));
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
    modalRoot.remove();
  });
}

export function dateNavigator({ date = new Date() } = {}) {
  return calendarHeader({
    label: dateLabel(date),
    prevAriaLabel: 'Предыдущий день',
    nextAriaLabel: 'Следующий день',
    prevAttribute: 'data-date-navigator-prev',
    nextAttribute: 'data-date-navigator-next',
  });
}

export function initDateNavigator(root, { date = new Date(), onChange = () => {} } = {}) {
  let currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const render = () => {
    root.innerHTML = dateNavigator({ date: currentDate });
    root.querySelector('[data-date-navigator-prev]')?.addEventListener('click', () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1);
      render();
      onChange(new Date(currentDate));
    });
    root.querySelector('[data-date-navigator-next]')?.addEventListener('click', () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
      render();
      onChange(new Date(currentDate));
    });
  };

  render();

  return {
    getDate: () => new Date(currentDate),
  };
}

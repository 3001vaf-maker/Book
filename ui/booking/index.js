import { escapeHtml } from '../utils/escape-html.js';

function safeTheme(settings = {}) {
  const theme = settings?.theme && typeof settings.theme === 'object' ? settings.theme : {};
  const backgroundStart = String(theme.backgroundStart || '#F5F5F3');
  const backgroundEnd = theme.backgroundMode === 'gradient'
    ? String(theme.backgroundEnd || backgroundStart)
    : backgroundStart;
  return {
    backgroundStart,
    backgroundEnd,
    dark: String(theme.dark || '#3B302B'),
    light: String(theme.light || '#E7E1DB'),
    shape: ['soft', 'round', 'straight', 'cut'].includes(theme.shape) ? theme.shape : 'soft',
    choiceStyle: ['cards', 'compact', 'list'].includes(theme.choiceStyle) ? theme.choiceStyle : 'cards',
  };
}

export function bookingThemeStyle(settings = {}) {
  const theme = safeTheme(settings);
  return `--booking-bg-start:${escapeHtml(theme.backgroundStart)};--booking-bg-end:${escapeHtml(theme.backgroundEnd)};--booking-dark:${escapeHtml(theme.dark)};--booking-light:${escapeHtml(theme.light)};--entity-card-dark:${escapeHtml(theme.dark)};--entity-card-light:${escapeHtml(theme.light)}`;
}

export function bookingChoiceCards(items = [], { multiple = false } = {}) {
  const values = Array.isArray(items) ? items : [];
  return `<div class="booking-choices${multiple ? ' booking-choices--multiple' : ''}">${values.map((item = {}) => {
    const image = String(item.image || '').trim();
    const style = image ? ` style="--booking-choice-image:url('${escapeHtml(image)}')"` : '';
    const secondary = (Array.isArray(item.secondary) ? item.secondary : [item.secondary]).filter(Boolean);
    return `<button type="button" class="booking-choice${item.selected ? ' is-selected' : ''}${image ? ' has-image' : ''}"${item.data ? ` ${item.data}` : ''}${item.aria ? ` aria-label="${escapeHtml(item.aria)}"` : ''}${style} aria-pressed="${item.selected ? 'true' : 'false'}">
      <span class="booking-choice__visual" aria-hidden="true"></span>
      <span class="booking-choice__content">
        <strong>${escapeHtml(item.title || '')}</strong>
        ${secondary.length ? `<span>${secondary.map((value) => escapeHtml(value)).join(' · ')}</span>` : ''}
      </span>
      ${item.right ? `<span class="booking-choice__right">${escapeHtml(item.right)}</span>` : ''}
      ${multiple ? `<span class="booking-choice__mark" aria-hidden="true">${item.selected ? '✓' : ''}</span>` : '<span class="booking-choice__chevron" aria-hidden="true">›</span>'}
    </button>`;
  }).join('')}</div>`;
}

function minuteOf(value = '') {
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

export function bookingTimeGroups(slots = [], { data = 'data-booking-time' } = {}) {
  const groups = [
    { key: 'morning', title: 'Утро', from: 0, to: 12 * 60 },
    { key: 'day', title: 'День', from: 12 * 60, to: 17 * 60 },
    { key: 'evening', title: 'Вечер', from: 17 * 60, to: 24 * 60 + 1 },
  ];
  return `<div class="booking-time-groups">${groups.map((group) => {
    const values = (Array.isArray(slots) ? slots : []).filter((slot) => {
      const minute = minuteOf(slot?.from ?? slot?.value ?? '');
      return minute >= group.from && minute < group.to;
    });
    if (!values.length) return '';
    return `<section class="booking-time-group"><h2>${group.title}</h2><div class="booking-time-grid">${values.map((slot) => {
      const value = String(slot?.from ?? slot?.value ?? '');
      const label = String(slot?.label ?? value);
      return `<button type="button" class="booking-time-slot" ${data}="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
    }).join('')}</div></section>`;
  }).join('')}</div>`;
}

export function bookingThemePreview(settings = {}) {
  const theme = safeTheme(settings);
  return `<div class="booking-theme-preview booking-shape--${theme.shape} booking-choice-style--${theme.choiceStyle}" style="${bookingThemeStyle(settings)}"><div class="booking-theme-preview__canvas"><div class="booking-theme-preview__card"><strong>Ваш стиль</strong><span>Так будет выглядеть клиентская страница</span></div><div class="booking-theme-preview__actions"><span></span><span></span></div></div></div>`;
}

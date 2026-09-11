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

export function bookingScreen(blocks = [], { settings = {}, mode = 'center', className = '' } = {}) {
  const theme = safeTheme(settings);
  const classes = [
    'booking-client',
    `booking-client--${mode === 'account' ? 'account' : 'center'}`,
    `booking-shape--${theme.shape}`,
    `booking-choice-style--${theme.choiceStyle}`,
    className,
  ].filter(Boolean).join(' ');
  return `<section class="${classes}" style="${bookingThemeStyle(settings)}"><div class="booking-client__frame"><div class="booking-client__panel">${blocks.filter(Boolean).join('')}</div></div></section>`;
}

export function bookingHeading(title = '', subtitle = '') {
  return `<header class="booking-heading"><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</header>`;
}

export function bookingActions(content = '') {
  return `<div class="booking-actions">${content}</div>`;
}

export function bookingAction(label, { data = '', type = 'button', secondary = false, aria = '', disabled = false } = {}) {
  return `<button type="${escapeHtml(type)}" class="booking-action${secondary ? ' booking-action--secondary' : ''}"${data ? ` ${data}` : ''}${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}${disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`;
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

export function bookingAgreementCards(items = []) {
  return `<div class="booking-agreements">${(Array.isArray(items) ? items : []).map((item = {}) => `<article class="booking-agreement-card${item.checked ? ' is-checked' : ''}">
    <button type="button" class="booking-agreement-card__document"${item.openData ? ` ${item.openData}` : ''}${item.openAria ? ` aria-label="${escapeHtml(item.openAria)}"` : ''}>
      <span class="booking-agreement-card__eyebrow">Документ</span>
      <strong>${escapeHtml(item.label || 'Документ')}</strong>
      <span class="booking-agreement-card__open">Открыть и прочитать</span>
    </button>
    <button type="button" class="booking-agreement-card__check"${item.toggleData ? ` ${item.toggleData}` : ''}${item.toggleAria ? ` aria-label="${escapeHtml(item.toggleAria)}"` : ''} aria-pressed="${item.checked ? 'true' : 'false'}"><span aria-hidden="true">${item.checked ? '✓' : ''}</span></button>
  </article>`).join('')}</div>`;
}

function paragraphs(text = '') {
  const value = String(text || '').trim();
  if (!value) return '<p>Текст документа не заполнен.</p>';
  return value.split(/\n{2,}/).map((part) => `<p>${escapeHtml(part).replaceAll('\n', '<br>')}</p>`).join('');
}

export function bookingDocument({ title = 'Документ', version = 1, text = '' } = {}) {
  return `<div class="booking-document-stage"><article class="booking-document"><header><span>Версия ${escapeHtml(version)}</span><h2>${escapeHtml(title)}</h2></header><div class="booking-document__body">${paragraphs(text)}</div></article></div>`;
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

function icon(type) {
  if (type === 'logout') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5"></path><path d="M13 8l4 4-4 4"></path><path d="M8 12h9"></path></svg>';
  }
  if (type === 'profile') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"></circle><path d="M5.5 19c.9-3.3 3-5 6.5-5s5.6 1.7 6.5 5"></path></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16"></path><rect x="4" y="5" width="16" height="15" rx="3"></rect><path d="M12 12v5M9.5 14.5h5"></path></svg>';
}

export function bookingAccountHeader(title = 'Ваш аккаунт') {
  return `<header class="booking-account-header"><h1>${escapeHtml(title)}</h1><div class="booking-account-header__actions">
    <button type="button" class="booking-account-icon booking-account-icon--primary" data-booking-new aria-label="Записаться">${icon('booking')}</button>
    <button type="button" class="booking-account-icon booking-account-icon--secondary" data-booking-logout aria-label="Выйти">${icon('logout')}</button>
  </div></header>`;
}

export function bookingPersonalDataButton(label = 'Личные данные') {
  return `<button type="button" class="booking-personal-data" data-booking-personal-data>${icon('profile')}<span>${escapeHtml(label)}</span><span aria-hidden="true">›</span></button>`;
}

export function bookingHistoryCards(items = []) {
  return `<div class="booking-history">${(Array.isArray(items) ? items : []).map((item = {}) => `<button type="button" class="booking-history-card"${item.data ? ` ${item.data}` : ''}${item.aria ? ` aria-label="${escapeHtml(item.aria)}"` : ''}>
    <span class="booking-history-card__main"><strong>${escapeHtml(item.title || 'Запись')}</strong><span>${escapeHtml(item.secondary || '')}</span></span>
    <span class="booking-history-card__status">${escapeHtml(item.status || '')}</span>
  </button>`).join('')}</div>`;
}

export function bookingThemePreview(settings = {}) {
  const theme = safeTheme(settings);
  return `<div class="booking-theme-preview booking-shape--${theme.shape} booking-choice-style--${theme.choiceStyle}" style="${bookingThemeStyle(settings)}"><div class="booking-theme-preview__canvas"><div class="booking-theme-preview__card"><strong>Ваш стиль</strong><span>Так будет выглядеть клиентская страница</span></div><div class="booking-theme-preview__actions"><span></span><span></span></div></div></div>`;
}

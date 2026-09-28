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

export function bookingThemePreview(settings = {}) {
  const theme = safeTheme(settings);
  return `<div class="booking-theme-preview booking-shape--${theme.shape} booking-choice-style--${theme.choiceStyle}" style="${bookingThemeStyle(settings)}"><div class="booking-theme-preview__canvas"><div class="booking-theme-preview__card"><strong>Ваш стиль</strong><span>Так будет выглядеть клиентская страница</span></div><div class="booking-theme-preview__actions"><span></span><span></span></div></div></div>`;
}

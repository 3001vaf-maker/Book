const STORAGE_KEY = 'book.booking-settings.v1';

export const BOOKING_SHAPES = Object.freeze([
  { value: 'soft', label: 'Мягкие углы' },
  { value: 'round', label: 'Округлые' },
  { value: 'straight', label: 'Прямые' },
  { value: 'cut', label: 'Скошенные' },
]);

export const BOOKING_CHOICE_STYLES = Object.freeze([
  { value: 'cards', label: 'Карточки' },
  { value: 'compact', label: 'Компактные карточки' },
  { value: 'list', label: 'Лаконичный список' },
]);

export const BOOKING_SLOT_STEPS = Object.freeze([5, 10, 15, 30, 60]);

export const DEFAULT_BOOKING_SETTINGS = Object.freeze({
  welcomeTitle: 'Рады видеть вас',
  welcomeText: 'Выберите удобное время для встречи — запись займёт всего пару минут.',
  slotStep: 15,
  theme: Object.freeze({
    backgroundMode: 'solid',
    backgroundStart: '#F5F5F3',
    backgroundEnd: '#F5F5F3',
    dark: '#3B302B',
    light: '#E7E1DB',
    shape: 'soft',
    choiceStyle: 'cards',
  }),
});

function color(value, fallback) {
  const text = String(value || '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(text) ? text : fallback;
}

function oneOf(value, allowed, fallback) {
  const text = String(value || '');
  return allowed.includes(text) ? text : fallback;
}

export function normalizeBookingSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const sourceTheme = source.theme && typeof source.theme === 'object' ? source.theme : {};
  const defaults = DEFAULT_BOOKING_SETTINGS;
  const slotStep = Number(source.slotStep);
  return {
    welcomeTitle: String(source.welcomeTitle || defaults.welcomeTitle).trim().slice(0, 90),
    welcomeText: String(source.welcomeText || defaults.welcomeText).trim().slice(0, 500),
    slotStep: BOOKING_SLOT_STEPS.includes(slotStep) ? slotStep : defaults.slotStep,
    theme: {
      backgroundMode: oneOf(sourceTheme.backgroundMode, ['solid', 'gradient'], defaults.theme.backgroundMode),
      backgroundStart: color(sourceTheme.backgroundStart, defaults.theme.backgroundStart),
      backgroundEnd: color(sourceTheme.backgroundEnd, defaults.theme.backgroundEnd),
      dark: color(sourceTheme.dark, defaults.theme.dark),
      light: color(sourceTheme.light, defaults.theme.light),
      shape: oneOf(sourceTheme.shape, BOOKING_SHAPES.map((item) => item.value), defaults.theme.shape),
      choiceStyle: oneOf(sourceTheme.choiceStyle, BOOKING_CHOICE_STYLES.map((item) => item.value), defaults.theme.choiceStyle),
    },
  };
}

export function getBookingSettings() {
  try {
    return normalizeBookingSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return normalizeBookingSettings();
  }
}

export function saveBookingSettings(value = {}) {
  const settings = normalizeBookingSettings(value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('book:booking-settings-changed', { detail: { settings } }));
  }
  return settings;
}

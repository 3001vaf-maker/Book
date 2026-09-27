export const DEFAULT_WORKPLACE_TIME_ZONE = 'Europe/Moscow';
export const DEFAULT_WORKPLACE_CURRENCY = 'RUB';
export const DEFAULT_WORKPLACE_SCHEDULE = Object.freeze({ from: '09:00', to: '18:00' });

export const WORKPLACE_CURRENCY_OPTIONS = Object.freeze([
  { value: 'RUB', label: 'RUB — ₽' },
  { value: 'EUR', label: 'EUR — €' },
  { value: 'USD', label: 'USD — $' },
  { value: 'GBP', label: 'GBP — £' },
]);

export const WORKPLACE_CITY_DIRECTORY = Object.freeze([
  { name: 'Москва', timeZone: 'Europe/Moscow', currency: 'RUB' },
  { name: 'Санкт-Петербург', timeZone: 'Europe/Moscow', currency: 'RUB' },
  { name: 'Казань', timeZone: 'Europe/Moscow', currency: 'RUB' },
  { name: 'Нижний Новгород', timeZone: 'Europe/Moscow', currency: 'RUB' },
  { name: 'Екатеринбург', timeZone: 'Asia/Yekaterinburg', currency: 'RUB' },
  { name: 'Новосибирск', timeZone: 'Asia/Novosibirsk', currency: 'RUB' },
  { name: 'Самара', timeZone: 'Europe/Samara', currency: 'RUB' },
  { name: 'Ростов-на-Дону', timeZone: 'Europe/Moscow', currency: 'RUB' },
  { name: 'Краснодар', timeZone: 'Europe/Moscow', currency: 'RUB' },
  { name: 'Сочи', timeZone: 'Europe/Moscow', currency: 'RUB' },
  { name: 'Уфа', timeZone: 'Asia/Yekaterinburg', currency: 'RUB' },
  { name: 'Воронеж', timeZone: 'Europe/Moscow', currency: 'RUB' },
  { name: 'Пермь', timeZone: 'Asia/Yekaterinburg', currency: 'RUB' },
  { name: 'Волгоград', timeZone: 'Europe/Volgograd', currency: 'RUB' },
  { name: 'Омск', timeZone: 'Asia/Omsk', currency: 'RUB' },
  { name: 'Тула', timeZone: 'Europe/Moscow', currency: 'RUB' },
  { name: 'Калининград', timeZone: 'Europe/Kaliningrad', currency: 'RUB' },
]);

const CITY_BY_NAME = new Map(WORKPLACE_CITY_DIRECTORY.map((item) => [item.name, item]));

export function isIanaTimeZone(value: unknown) {
  const timeZone = String(value ?? '').trim();
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function resolveWorkplaceTimeZone(city: unknown, current: unknown = '') {
  const cityName = String(city ?? '').trim();
  const mapped = CITY_BY_NAME.get(cityName)?.timeZone;
  if (mapped) return mapped;
  const existing = String(current ?? '').trim();
  return isIanaTimeZone(existing) ? existing : DEFAULT_WORKPLACE_TIME_ZONE;
}

export function resolveWorkplaceCurrency(city: unknown, current: unknown = '') {
  const existing = String(current ?? '').trim();
  if (existing) return existing;
  const cityName = String(city ?? '').trim();
  return CITY_BY_NAME.get(cityName)?.currency || DEFAULT_WORKPLACE_CURRENCY;
}

export function workplaceReferenceData() {
  return {
    cities: WORKPLACE_CITY_DIRECTORY.map(({ name }) => name),
    currencies: WORKPLACE_CURRENCY_OPTIONS.map((item) => ({ ...item })),
    defaults: {
      currency: DEFAULT_WORKPLACE_CURRENCY,
      from: DEFAULT_WORKPLACE_SCHEDULE.from,
      to: DEFAULT_WORKPLACE_SCHEDULE.to,
      timeZone: DEFAULT_WORKPLACE_TIME_ZONE,
    },
  };
}

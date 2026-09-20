export const DEFAULT_WORKPLACE_TIME_ZONE = 'Europe/Moscow';

const CITY_TIME_ZONES: Record<string, string> = {
  'Москва': 'Europe/Moscow',
  'Санкт-Петербург': 'Europe/Moscow',
  'Казань': 'Europe/Moscow',
  'Нижний Новгород': 'Europe/Moscow',
  'Екатеринбург': 'Asia/Yekaterinburg',
  'Новосибирск': 'Asia/Novosibirsk',
  'Самара': 'Europe/Samara',
  'Ростов-на-Дону': 'Europe/Moscow',
  'Краснодар': 'Europe/Moscow',
  'Сочи': 'Europe/Moscow',
  'Уфа': 'Asia/Yekaterinburg',
  'Воронеж': 'Europe/Moscow',
  'Пермь': 'Asia/Yekaterinburg',
  'Волгоград': 'Europe/Volgograd',
  'Омск': 'Asia/Omsk',
  'Тула': 'Europe/Moscow',
  'Калининград': 'Europe/Kaliningrad',
};

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
  const mapped = CITY_TIME_ZONES[cityName];
  if (mapped) return mapped;
  const existing = String(current ?? '').trim();
  return isIanaTimeZone(existing) ? existing : DEFAULT_WORKPLACE_TIME_ZONE;
}

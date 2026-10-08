import {
  openNotice,
  openSharedProfileSettingsMenu,
  v2ListEntries,
  v2ListEntry,
  workspaceHeaderContext,
} from '../../ui/ui.js';
import { getAllPeople } from '../people/data.js';
import { personDisplay } from '../people/presentation.js';
import { getProfile } from '../profile/data.js';

export const money = (value) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value || 0)).replaceAll('\u00a0', ' ')} ₽`;
export const text = (value) => String(value ?? '').trim();
export const uid = (prefix = 'loyalty') => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function notifyLoyaltyContext() {
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function crop(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 50;
}

export function loyaltyHeader(title, { settings = false, c = null, settingsData = 'data-loyalty-e-settings' } = {}) {
  const profile = getProfile();
  const name = [profile?.name, profile?.surname].filter(Boolean).join(' ').trim() || 'Профиль';
  return workspaceHeaderContext({
    title,
    a: {
      kind: 'avatar',
      image: String(profile?.photo || ''),
      imagePosition: `${crop(profile?.photoCropX)}% ${crop(profile?.photoCropY)}%`,
      initials: name.slice(0, 1).toUpperCase() || '?',
      settingsTag: settings,
      data: settings ? settingsData : '',
      aria: settings ? `Настройки ${title}` : title,
      disabled: !settings,
    },
    c,
  });
}

export function bindViewSettings(root, title) {
  root?.querySelector?.('[data-loyalty-e-settings]')?.addEventListener('click', () => {
    openSharedProfileSettingsMenu({
      title,
      actions: [{
        id: 'appearance',
        label: 'Вид карты',
        onSelect: () => openNotice({
          title: 'Вид карты',
          message: 'Используется общий механизм вида карт. Бизнес-данные программы здесь не изменяются.',
          surface: 'app',
        }),
      }],
    });
  });
}

export function formObject(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
}

export function people() {
  return getAllPeople();
}

export function personLabel(person = {}) {
  const display = personDisplay(person);
  return display.name || display.uei || 'Без имени';
}

export function personOption(person = {}) {
  const display = personDisplay(person);
  return {
    value: String(person?.key || person?.id || ''),
    label: [display.uei, display.name].filter(Boolean).join(' · ') || 'Без имени',
  };
}

export function resolvePerson(personKey = '') {
  const key = String(personKey || '');
  return people().find((item) => String(item?.key || item?.id || '') === key) || null;
}

export function rows(items = []) {
  return v2ListEntries(items.map((item) => v2ListEntry({
    title: item.title || '',
    subtitle: item.subtitle || '',
    rightTop: item.rightTop || '',
    rightBottom: item.rightBottom || '',
    interactive: Boolean(item.interactive),
    initial: item.initial ?? '',
    image: item.image || '',
    data: item.data || '',
    aria: item.aria || '',
  })));
}

export function mockPerson(name, key) {
  return { key, name, uei: '' };
}

export function availablePeople(fallback = []) {
  const values = people();
  return values.length ? values : fallback;
}

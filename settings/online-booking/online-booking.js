import { buildBookingLink } from '../../core/booking-link/index.js';
import { getCurrentUser } from '../../core/auth.js';
import {
  BOOKING_CHOICE_STYLES,
  BOOKING_SHAPES,
  BOOKING_SLOT_STEPS,
  getBookingSettings,
  saveBookingSettings,
} from '../../core/booking-settings/index.js';
import {
  actionBlock,
  bookingThemePreview,
  button,
  colorPicker,
  copyIconButton,
  copyTextToClipboard,
  emptyState,
  escapeHtml,
  field,
  initColorPickers,
  pageHeader,
  select,
  setCopyButtonCopied,
  textareaField,
} from '../../ui/ui.js';
import { getWorkplaces } from '../profile/workplaces/data.js';

function bookingLink(tenantId, workplaceKey = '') {
  return buildBookingLink({
    origin: window.location.origin,
    pathname: window.location.pathname,
    tenantId,
    workplaceKey,
  });
}

function copyLinkField(label, value, kind) {
  return `<div class="field"><span>${escapeHtml(label)}</span><div class="array-row"><input type="text" value="${escapeHtml(value)}" readonly aria-label="${escapeHtml(label)}">${copyIconButton({ data: `data-copy-booking-link="${escapeHtml(kind)}"`, aria: `Скопировать: ${label}` })}</div></div>`;
}

function bindCopyButtons(root) {
  root.querySelectorAll('[data-copy-booking-link]').forEach((copyButton) => {
    copyButton.addEventListener('click', async () => {
      const value = copyButton.closest('.array-row')?.querySelector('input')?.value || '';
      if (!value) return;
      try {
        if (await copyTextToClipboard(value)) setCopyButtonCopied(copyButton);
      } catch {
        // The visible link remains available for manual copy if clipboard access is blocked.
      }
    });
  });
}

function selectedWorkplaceLink(workplaces, tenantId, key) {
  const selected = workplaces.find((item) => item.key === key) || null;
  if (!selected) return '';
  return copyLinkField(selected.name || 'Рабочее пространство', bookingLink(tenantId, selected.key), 'workplace');
}

function settingsDraft(form) {
  const data = new FormData(form);
  return {
    welcomeTitle: data.get('welcomeTitle'),
    welcomeText: data.get('welcomeText'),
    slotStep: Number(data.get('slotStep')),
    theme: {
      backgroundMode: data.get('backgroundMode'),
      backgroundStart: data.get('backgroundStart'),
      backgroundEnd: data.get('backgroundEnd'),
      dark: data.get('dark'),
      light: data.get('light'),
      shape: data.get('shape'),
      choiceStyle: data.get('choiceStyle'),
    },
  };
}

function themeForm(settings) {
  return `<form class="form-grid" data-online-booking-settings>
    <div class="section-heading"><h2>Приветствие</h2></div>
    ${field({ label: 'Заголовок', name: 'welcomeTitle', value: settings.welcomeTitle, maxlength: 90 })}
    ${textareaField({ label: 'Текст', name: 'welcomeText', value: settings.welcomeText, rows: 4, maxlength: 500 })}

    <div class="section-heading"><h2>Оформление клиента</h2></div>
    <div class="muted">Вы задаёте настроение страницы. Расстановка экранов, календарь и логика записи остаются едиными. Карточка рабочего пространства берётся из заполненной карточки рабочего пространства.</div>
    ${select({
      label: 'Фон',
      name: 'backgroundMode',
      value: settings.theme.backgroundMode,
      options: [{ value: 'solid', label: 'Однотонный' }, { value: 'gradient', label: 'Градиент' }],
    })}
    <div class="form-grid">
      <div class="field"><span>Цвет фона</span>${colorPicker({ name: 'backgroundStart', value: settings.theme.backgroundStart })}</div>
      <div class="field"><span>Второй цвет фона</span>${colorPicker({ name: 'backgroundEnd', value: settings.theme.backgroundEnd })}</div>
      <div class="field"><span>Тёмный цвет</span>${colorPicker({ name: 'dark', value: settings.theme.dark })}</div>
      <div class="field"><span>Светлый цвет</span>${colorPicker({ name: 'light', value: settings.theme.light })}</div>
    </div>
    ${select({ label: 'Форма элементов', name: 'shape', value: settings.theme.shape, options: BOOKING_SHAPES })}
    ${select({ label: 'Вид выбора', name: 'choiceStyle', value: settings.theme.choiceStyle, options: BOOKING_CHOICE_STYLES })}
    <div data-online-booking-preview>${bookingThemePreview(settings)}</div>

    <div class="section-heading"><h2>Время</h2></div>
    ${select({
      label: 'Шаг доступного времени',
      name: 'slotStep',
      value: String(settings.slotStep),
      options: BOOKING_SLOT_STEPS.map((value) => ({ value: String(value), label: value === 60 ? '1 час' : `${value} минут` })),
    })}
    <div class="muted">Шаг определяет, как часто клиенту показываются возможные начала записи. Длительность процедур при этом не меняется.</div>

    <div data-booking-settings-status class="muted" aria-live="polite"></div>
    ${actionBlock(button('Сохранить оформление', { type: 'submit' }))}
  </form>`;
}

function bindSettings(root) {
  const form = root.querySelector('[data-online-booking-settings]');
  if (!form) return;
  initColorPickers(form);
  const updatePreview = () => {
    const host = root.querySelector('[data-online-booking-preview]');
    if (host) host.innerHTML = bookingThemePreview(settingsDraft(form));
  };
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const saved = saveBookingSettings(settingsDraft(form));
    const status = root.querySelector('[data-booking-settings-status]');
    if (status) status.textContent = 'Сохранено. Эта же ссылка покажет новое оформление.';
    const preview = root.querySelector('[data-online-booking-preview]');
    if (preview) preview.innerHTML = bookingThemePreview(saved);
  });
}

function renderReady(root, navigateBack, tenantId) {
  const workplaces = getWorkplaces();
  const settings = getBookingSettings();
  const options = [
    { value: '', label: 'Выбрать рабочее пространство' },
    ...workplaces.map((item) => ({ value: item.key, label: item.name || 'Без названия' })),
  ];
  const generalLink = bookingLink(tenantId);

  root.innerHTML = `${pageHeader('Онлайн-запись')}
    <div class="section-heading"><h2>Ссылки</h2></div>
    ${copyLinkField('Общая ссылка', generalLink, 'general')}
    ${select({
      label: 'Ссылка рабочего пространства',
      name: 'bookingWorkplace',
      value: '',
      options,
      aria: 'Выбрать рабочее пространство для онлайн-записи',
    })}
    <div data-workplace-booking-link></div>
    ${themeForm(settings)}
    ${actionBlock(button('Назад', { variant: 'secondary', data: 'data-online-booking-back' }))}`;

  bindCopyButtons(root);
  bindSettings(root);
  root.querySelector('input[name="bookingWorkplace"]')?.addEventListener('change', (event) => {
    const host = root.querySelector('[data-workplace-booking-link]');
    if (!host) return;
    host.innerHTML = selectedWorkplaceLink(workplaces, tenantId, event.target.value);
    bindCopyButtons(host);
  });
  root.querySelector('[data-online-booking-back]')?.addEventListener('click', navigateBack);
}

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Онлайн-запись')}${emptyState('Загрузка', 'Формируем ссылки онлайн-записи.')}`;
  void getCurrentUser()
    .then((account) => {
      const tenantId = String(account?.tenant?.id || '');
      if (!tenantId) {
        root.innerHTML = `${pageHeader('Онлайн-запись')}${emptyState('Ссылка недоступна', 'Не удалось определить рабочее пространство аккаунта.')}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-online-booking-back' }))}`;
        root.querySelector('[data-online-booking-back]')?.addEventListener('click', navigateBack);
        return;
      }
      renderReady(root, navigateBack, tenantId);
    })
    .catch(() => {
      root.innerHTML = `${pageHeader('Онлайн-запись')}${emptyState('Ссылка недоступна', 'Не удалось получить данные аккаунта.')}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-online-booking-back' }))}`;
      root.querySelector('[data-online-booking-back]')?.addEventListener('click', navigateBack);
    });
}
import { PUBLIC_APP_ORIGIN } from '../../core/environment.js';
import { buildBookingLink } from '../../core/booking-link/index.js';
import { getCurrentUser } from '../../core/auth.js';
import {
  BOOKING_CHOICE_STYLES,
  BOOKING_SHAPES,
  BOOKING_SLOT_STEPS,
  DEFAULT_BOOKING_SETTINGS,
  getBookingSettings,
  normalizeBookingSettings,
  saveBookingSettings,
} from '../../core/booking-settings/index.js';
import {
  appHeader,
  appShell,
  bookingThemePreview,
  colorPicker,
  copyIconButton,
  copyTextToClipboard,
  emptyState,
  escapeHtml,
  field,
  folderList,
  iconButton,
  initColorPickers,
  modal,
  mountModal,
  select,
  setCopyButtonCopied,
  settingsPanel,
  textareaField,
  twoColumnLayout,
} from '../../ui/ui.js';
import { getWorkplaces } from '../profile/workplaces/data.js';

const APPEARANCE_INFO = 'Вы задаёте настроение страницы. Расстановка экранов, календарь и логика записи остаются едиными. Карточка рабочего пространства берётся из заполненной карточки рабочего пространства.';

function bookingLink(tenantId, workplaceKey = '') {
  return buildBookingLink({
    origin: PUBLIC_APP_ORIGIN,
    pathname: '/',
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
  return copyLinkField(selected.name || 'Ссылка рабочего пространства', bookingLink(tenantId, selected.key), 'workplace');
}

function settingsSignature(value) {
  return JSON.stringify(normalizeBookingSettings(value));
}

function settingsDraft(form, baseSettings = getBookingSettings()) {
  const base = normalizeBookingSettings(baseSettings);
  const data = new FormData(form);

  if (form.matches('[data-online-booking-welcome]')) {
    return normalizeBookingSettings({
      ...base,
      welcomeTitle: data.get('welcomeTitle'),
      welcomeText: data.get('welcomeText'),
    });
  }

  if (form.matches('[data-online-booking-appearance]')) {
    return normalizeBookingSettings({
      ...base,
      theme: {
        backgroundMode: data.get('backgroundMode'),
        backgroundStart: data.get('backgroundStart'),
        backgroundEnd: data.get('backgroundEnd'),
        dark: data.get('dark'),
        light: data.get('light'),
        shape: data.get('shape'),
        choiceStyle: data.get('choiceStyle'),
      },
    });
  }

  if (form.matches('[data-online-booking-time]')) {
    return normalizeBookingSettings({
      ...base,
      slotStep: Number(data.get('slotStep')),
    });
  }

  return base;
}

function setSaveVisible(root, visible) {
  const save = root.querySelector('[data-online-booking-save]');
  if (save) save.hidden = !visible;
}

function mountScreen(root, {
  title,
  body,
  onBack,
  onSave = null,
  settings = null,
} = {}) {
  root.innerHTML = appShell({
    className: 'app-view-shell--online-booking',
    header: appHeader({
      title,
      back: { data: 'data-online-booking-back', aria: 'Назад' },
      action: onSave ? { label: 'Сохранить', data: 'data-online-booking-save', aria: 'Сохранить изменения' } : null,
      settings,
    }),
    body,
  });

  root.querySelector('[data-online-booking-back]')?.addEventListener('click', onBack);
  if (onSave) {
    setSaveVisible(root, false);
    root.querySelector('[data-online-booking-save]')?.addEventListener('click', onSave);
  }
}

function exitOnlineBooking(root, navigateBack) {
  root.classList.remove('app-content--book-shell');
  navigateBack();
}

function openSections(root, navigateBack, tenantId) {
  const content = `<div class="modal-title"><h2>Настройки</h2></div>${folderList([
    { title: 'Приветствие', data: 'data-online-booking-open="welcome"' },
    { title: 'Внешний вид', data: 'data-online-booking-open="appearance"' },
    { title: 'Время записи', data: 'data-online-booking-open="time"' },
  ])}`;
  const m = mountModal(document.body, modal(content, {
    title: 'Настройки онлайн-записи',
    variant: 'compact',
    surface: 'app',
  }));
  if (!m) return;

  m.querySelectorAll('[data-online-booking-open]').forEach((row) => {
    row.addEventListener('click', () => {
      const section = row.dataset.onlineBookingOpen;
      m.remove();
      if (section === 'welcome') renderWelcome(root, navigateBack, tenantId);
      if (section === 'appearance') renderAppearance(root, navigateBack, tenantId);
      if (section === 'time') renderTime(root, navigateBack, tenantId);
    });
  });
}

function renderReady(root, navigateBack, tenantId) {
  const workplaces = getWorkplaces();
  const options = [
    { value: '', label: 'Выбрать рабочее пространство' },
    ...workplaces.map((item) => ({ value: item.key, label: item.name || 'Без названия' })),
  ];

  mountScreen(root, {
    title: 'Онлайн-запись',
    onBack: () => exitOnlineBooking(root, navigateBack),
    settings: {
      label: '•••',
      data: 'data-online-booking-sections',
      aria: 'Настройки онлайн-записи',
    },
    body: `<div class="online-booking-link-stack">
      ${copyLinkField('Общая ссылка', bookingLink(tenantId), 'general')}
      ${select({
        label: 'Рабочее пространство',
        name: 'bookingWorkplace',
        value: '',
        options,
        aria: 'Выбрать рабочее пространство для онлайн-записи',
      })}
      <div data-workplace-booking-link></div>
    </div>`,
  });

  bindCopyButtons(root);
  root.querySelector('[data-online-booking-sections]')?.addEventListener('click', () => openSections(root, navigateBack, tenantId));
  root.querySelector('input[name="bookingWorkplace"]')?.addEventListener('change', (event) => {
    const host = root.querySelector('[data-workplace-booking-link]');
    if (!host) return;
    host.innerHTML = selectedWorkplaceLink(workplaces, tenantId, event.target.value);
    bindCopyButtons(host);
  });
}

function renderWelcome(root, navigateBack, tenantId) {
  const saved = getBookingSettings();
  mountScreen(root, {
    title: 'Приветствие',
    onBack: () => renderReady(root, navigateBack, tenantId),
    onSave: () => {
      const form = root.querySelector('[data-online-booking-welcome]');
      if (!form) return;
      saveBookingSettings(settingsDraft(form, saved));
      renderWelcome(root, navigateBack, tenantId);
    },
    body: `<form class="form-grid" data-online-booking-welcome>
      ${field({ label: 'Заголовок', name: 'welcomeTitle', value: saved.welcomeTitle, maxlength: 90 })}
      ${textareaField({ label: 'Текст', name: 'welcomeText', value: saved.welcomeText, rows: 4, maxlength: 500 })}
    </form>`,
  });

  const form = root.querySelector('[data-online-booking-welcome]');
  if (!form) return;
  const updateDirty = () => setSaveVisible(root, settingsSignature(settingsDraft(form, saved)) !== settingsSignature(saved));
  form.addEventListener('input', updateDirty);
  form.addEventListener('change', updateDirty);
}

function colorField(label, name, value) {
  return `<div class="field"><span>${escapeHtml(label)}</span>${colorPicker({ name, value })}</div>`;
}

function openAppearanceInfo() {
  mountModal(document.body, modal(`<div class="modal-title"><h2>Внешний вид</h2><p>${escapeHtml(APPEARANCE_INFO)}</p></div>`, {
    title: 'О внешнем виде онлайн-записи',
    variant: 'compact',
    surface: 'app',
  }));
}

function openAppearanceActions(root, navigateBack, tenantId, form, saved) {
  const m = mountModal(document.body, modal(`<div class="modal-title"><h2>Действия</h2></div>${settingsPanel([
    { label: 'Отменить', data: 'data-online-booking-appearance-cancel', aria: 'Отменить изменения', variant: 'outline' },
    { label: 'Сбросить', data: 'data-online-booking-appearance-reset', aria: 'Сбросить к стандартному дизайну Book', variant: 'outline' },
  ])}`, {
    title: 'Действия внешнего вида',
    variant: 'compact',
    surface: 'app',
  }));
  if (!m) return;

  m.querySelector('[data-online-booking-appearance-cancel]')?.addEventListener('click', () => {
    m.remove();
    renderAppearance(root, navigateBack, tenantId);
  });
  m.querySelector('[data-online-booking-appearance-reset]')?.addEventListener('click', () => {
    const current = settingsDraft(form, saved);
    m.remove();
    renderAppearance(root, navigateBack, tenantId, {
      ...current,
      theme: { ...DEFAULT_BOOKING_SETTINGS.theme },
    });
  });
}

function renderAppearance(root, navigateBack, tenantId, initialSettings = null) {
  const saved = getBookingSettings();
  const settings = normalizeBookingSettings(initialSettings || saved);
  const backgroundColors = twoColumnLayout(
    colorField('Цвет фона', 'backgroundStart', settings.theme.backgroundStart),
    colorField('Второй цвет фона', 'backgroundEnd', settings.theme.backgroundEnd),
    { ariaLabel: 'Цвета фона' },
  );
  const interfaceColors = twoColumnLayout(
    colorField('Тёмный цвет', 'dark', settings.theme.dark),
    colorField('Светлый цвет', 'light', settings.theme.light),
    { ariaLabel: 'Цвета интерфейса' },
  );

  mountScreen(root, {
    title: 'Внешний вид',
    onBack: () => renderReady(root, navigateBack, tenantId),
    onSave: () => {
      const form = root.querySelector('[data-online-booking-appearance]');
      if (!form) return;
      saveBookingSettings(settingsDraft(form, saved));
      renderAppearance(root, navigateBack, tenantId);
    },
    settings: {
      label: '•••',
      data: 'data-online-booking-appearance-actions',
      aria: 'Действия внешнего вида',
    },
    body: `<div class="online-booking-info-row">${iconButton('ⓘ', { data: 'data-online-booking-appearance-info', aria: 'О настройках внешнего вида' })}</div>
      <form class="form-grid" data-online-booking-appearance>
        ${select({
          label: 'Фон',
          name: 'backgroundMode',
          value: settings.theme.backgroundMode,
          options: [{ value: 'solid', label: 'Однотонный' }, { value: 'gradient', label: 'Градиент' }],
        })}
        <div class="online-booking-color-grid">${backgroundColors}</div>
        <div class="online-booking-color-grid">${interfaceColors}</div>
        ${select({ label: 'Форма элементов', name: 'shape', value: settings.theme.shape, options: BOOKING_SHAPES })}
        ${select({ label: 'Вид выбора', name: 'choiceStyle', value: settings.theme.choiceStyle, options: BOOKING_CHOICE_STYLES })}
        <div data-online-booking-preview>${bookingThemePreview(settings)}</div>
      </form>`,
  });

  const form = root.querySelector('[data-online-booking-appearance]');
  if (!form) return;
  initColorPickers(form);

  const updatePreview = () => {
    const draft = settingsDraft(form, saved);
    const host = root.querySelector('[data-online-booking-preview]');
    if (host) host.innerHTML = bookingThemePreview(draft);
    setSaveVisible(root, settingsSignature(draft) !== settingsSignature(saved));
  };
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);
  setSaveVisible(root, settingsSignature(settings) !== settingsSignature(saved));

  root.querySelector('[data-online-booking-appearance-info]')?.addEventListener('click', openAppearanceInfo);
  root.querySelector('[data-online-booking-appearance-actions]')?.addEventListener('click', () => openAppearanceActions(root, navigateBack, tenantId, form, saved));
}

function renderTime(root, navigateBack, tenantId) {
  const saved = getBookingSettings();
  mountScreen(root, {
    title: 'Время записи',
    onBack: () => renderReady(root, navigateBack, tenantId),
    onSave: () => {
      const form = root.querySelector('[data-online-booking-time]');
      if (!form) return;
      saveBookingSettings(settingsDraft(form, saved));
      renderTime(root, navigateBack, tenantId);
    },
    body: `<form class="form-grid" data-online-booking-time>
      ${select({
        label: 'Шаг доступного времени',
        name: 'slotStep',
        value: String(saved.slotStep),
        options: BOOKING_SLOT_STEPS.map((value) => ({ value: String(value), label: value === 60 ? '1 час' : `${value} минут` })),
      })}
      <div class="muted">Шаг определяет, как часто клиенту показываются возможные начала записи. Длительность процедур при этом не меняется.</div>
    </form>`,
  });

  const form = root.querySelector('[data-online-booking-time]');
  if (!form) return;
  const updateDirty = () => setSaveVisible(root, settingsSignature(settingsDraft(form, saved)) !== settingsSignature(saved));
  form.addEventListener('input', updateDirty);
  form.addEventListener('change', updateDirty);
}

function renderUnavailable(root, navigateBack, title, message) {
  mountScreen(root, {
    title: 'Онлайн-запись',
    onBack: () => exitOnlineBooking(root, navigateBack),
    body: emptyState(title, message),
  });
}

export function render(root, navigateBack = () => {}) {
  root.classList.add('app-content--book-shell');
  mountScreen(root, {
    title: 'Онлайн-запись',
    onBack: () => exitOnlineBooking(root, navigateBack),
    body: emptyState('Загрузка', 'Формируем ссылки онлайн-записи.'),
  });

  void getCurrentUser()
    .then((account) => {
      const tenantId = String(account?.tenant?.id || '');
      if (!tenantId) {
        renderUnavailable(root, navigateBack, 'Ссылка недоступна', 'Не удалось определить рабочее пространство аккаунта.');
        return;
      }
      renderReady(root, navigateBack, tenantId);
    })
    .catch(() => renderUnavailable(root, navigateBack, 'Ссылка недоступна', 'Не удалось получить данные аккаунта.'));
}

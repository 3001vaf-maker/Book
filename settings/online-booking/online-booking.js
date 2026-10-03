import { buildBookingLink } from '../../core/booking-link/index.js';
import { apiRequest, getCurrentAccount } from '../../core/auth.js';
import { ACCOUNT_APP_ORIGIN } from '../../core/environment.js';
import {
  BOOKING_SLOT_STEPS,
  getBookingSettings,
  normalizeBookingSettings,
  saveBookingSettings,
} from '../../core/booking-settings/index.js';
import { getNotificationRouting, saveNotificationRouting } from '../../core/notifications/routing.js';
import {
  button,
  copyIconButton,
  copyTextToClipboard,
  emptyState,
  escapeHtml,
  field,
  iconButton,
  modal,
  mountModal,
  openSharedProfileSettingsMenu,
  select,
  setCopyButtonCopied,
  textareaField,
  twoColumnLayout,
  v2ListEntries,
  v2ListEntry,
  workspaceHeaderContext,
} from '../../ui/ui.js';
import { getWorkplaces } from '../profile/workplaces/data.js';

const CHANNEL_OPTIONS = Object.freeze([
  { value: 'PUSH', label: 'Push' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'EMAIL', label: 'Email' },
  { value: '', label: 'Не использовать' },
]);

const ROUTING_MODE_OPTIONS = Object.freeze([
  { value: 'always', label: 'Во все выбранные каналы' },
  { value: 'fallback', label: 'По очереди, если предыдущий не доставлен' },
]);

let publicRouteState = { profileSlug: '', workplaces: [] };

async function loadOwnerPublicRoute() {
  const response = await apiRequest('/online-booking/owner/route');
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Не удалось сформировать короткую ссылку онлайн-записи');
  return {
    profileSlug: String(payload?.profileSlug || '').trim(),
    workplaces: (Array.isArray(payload?.workplaces) ? payload.workplaces : []).map((item) => ({
      key: String(item?.key || ''),
      name: String(item?.name || ''),
      slug: String(item?.slug || '').trim(),
    })),
  };
}

function bookingLink(profileSlug, workplaceSlug = '') {
  return buildBookingLink({
    origin: ACCOUNT_APP_ORIGIN,
    profileSlug,
    workplaceSlug,
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
        // Ссылка остаётся видимой для ручного копирования.
      }
    });
  });
}

function selectedWorkplaceLink(workplaces, key) {
  const selected = workplaces.find((item) => item.key === key) || null;
  const route = publicRouteState.workplaces.find((item) => item.key === key) || null;
  if (!selected || !route?.slug) return '';
  return copyLinkField(selected.name || 'Ссылка рабочего пространства', bookingLink(publicRouteState.profileSlug, route.slug), 'workplace');
}

function settingsSignature(value) {
  return JSON.stringify(normalizeBookingSettings(value));
}

function welcomeDraft(form, baseSettings = getBookingSettings()) {
  const data = new FormData(form);
  return normalizeBookingSettings({
    ...baseSettings,
    welcomeTitle: data.get('welcomeTitle'),
    welcomeText: data.get('welcomeText'),
  });
}

function setWelcomeSaveVisible(host, visible) {
  const save = host?.querySelector('[data-online-booking-welcome-save]');
  if (!save) return;
  save.dataset.v2PrimaryVisible = visible ? 'true' : 'false';
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function openWelcomeQ(root) {
  const saved = getBookingSettings();
  const content = `${workspaceHeaderContext({
    title: 'Приветствие',
    hideD: true,
    c: {
      label: 'Сохранить',
      data: 'data-online-booking-welcome-save data-v2-primary-visible="false"',
      aria: 'Сохранить приветствие',
    },
  })}
    <form class="form-grid" data-online-booking-welcome>
      ${field({ label: 'Заголовок', name: 'welcomeTitle', value: saved.welcomeTitle, maxlength: 90 })}
      ${textareaField({ label: 'Текст', name: 'welcomeText', value: saved.welcomeText, rows: 6, maxlength: 500 })}
    </form>`;

  const layer = mountModal(root, modal(content, {
    title: 'Приветствие',
    variant: 'q',
    className: 'online-booking-welcome-q',
  }));
  if (!layer) return null;

  const form = layer.querySelector('[data-online-booking-welcome]');
  const updateDirty = () => {
    setWelcomeSaveVisible(layer, Boolean(form) && settingsSignature(welcomeDraft(form, saved)) !== settingsSignature(saved));
  };
  form?.addEventListener('input', updateDirty);
  form?.addEventListener('change', updateDirty);
  layer.querySelector('[data-online-booking-welcome-save]')?.addEventListener('click', () => {
    if (!form) return;
    saveBookingSettings(welcomeDraft(form, saved));
    layer.v2Close?.();
  });
  updateDirty();
  return layer;
}

function notificationPolicy(items = []) {
  const current = (Array.isArray(items) ? items : []).find((item) => item.eventType === 'booking.created');
  return {
    eventType: 'booking.created',
    mode: current?.mode === 'fallback' ? 'fallback' : 'always',
    channels: current ? (Array.isArray(current.channels) ? current.channels : []) : ['PUSH'],
  };
}

function channelValues(policy = {}) {
  const values = [];
  for (const value of Array.isArray(policy.channels) ? policy.channels : []) {
    const channel = String(value || '').trim().toUpperCase();
    if (!['PUSH', 'TELEGRAM', 'EMAIL'].includes(channel) || values.includes(channel)) continue;
    values.push(channel);
  }
  while (values.length < 3) values.push('');
  return values.slice(0, 3);
}

function selectedChannels(form) {
  const data = new FormData(form);
  const values = ['channel1', 'channel2', 'channel3']
    .map((name) => String(data.get(name) || '').trim().toUpperCase())
    .filter((value) => ['PUSH', 'TELEGRAM', 'EMAIL'].includes(value));
  return [...new Set(values)];
}

function openPushInfo() {
  const content = `<div class="modal-title"><h2>Push</h2><p>Push — дополнительное уведомление. Если выбран режим «По очереди», успешный Push не останавливает отправку: основной результат определяется Telegram или Email.</p></div>`;
  return mountModal(document.body, modal(content, {
    title: 'О Push',
    variant: 'top',
    surface: 'app',
  }));
}

async function openNotificationSettings() {
  const items = await getNotificationRouting();
  const policy = notificationPolicy(items);
  const channels = channelValues(policy);
  const pushInfo = v2ListEntries([
    v2ListEntry({
      title: 'Push',
      interactive: false,
      actionData: 'data-online-booking-push-info',
      actionAria: 'О Push',
      actionIcon: 'ⓘ',
    }),
  ]);
  const body = `<div data-online-booking-notifications>
    ${pushInfo}
    <form class="form-grid" data-online-booking-notification-form>
      ${select({
        label: 'Порядок отправки',
        name: 'mode',
        value: policy.mode,
        options: ROUTING_MODE_OPTIONS,
      })}
      ${select({ label: 'Канал 1', name: 'channel1', value: channels[0], options: CHANNEL_OPTIONS })}
      ${select({ label: 'Канал 2', name: 'channel2', value: channels[1], options: CHANNEL_OPTIONS })}
      ${select({ label: 'Канал 3', name: 'channel3', value: channels[2], options: CHANNEL_OPTIONS })}
      <div class="muted" data-online-booking-notification-status aria-live="polite"></div>
      ${button('Сохранить', { type: 'submit' })}
    </form>
  </div>`;
  const layer = mountModal(document.body, modal(body, {
    title: 'Настройки уведомлений',
    variant: 'bottom',
    className: 'modal--form-sheet',
  }));
  if (!layer) return null;

  layer.querySelector('[data-online-booking-push-info]')?.addEventListener('click', openPushInfo);
  const form = layer.querySelector('[data-online-booking-notification-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = layer.querySelector('[data-online-booking-notification-status]');
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    if (status) status.textContent = 'Сохраняем…';
    try {
      const data = new FormData(form);
      await saveNotificationRouting('booking.created', {
        mode: String(data.get('mode') || 'always'),
        channels: selectedChannels(form),
      });
      layer.v2Close?.();
    } catch (error) {
      if (submit) submit.disabled = false;
      if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось сохранить';
    }
  });
  return layer;
}

function openOnlineBookingSettings(root) {
  return openSharedProfileSettingsMenu({
    title: 'Настройки онлайн-записи',
    actions: [
      {
        id: 'welcome',
        label: 'Приветствие',
        onSelect: () => openWelcomeQ(root),
      },
      {
        id: 'notifications',
        label: 'Настройки уведомлений',
        onSelect: () => void openNotificationSettings(),
      },
    ],
  });
}

function openSlotStepInfo() {
  const content = '<div class="modal-title"><h2>Шаг записи</h2><p>Шаг определяет, как часто человеку показываются возможные начала записи. Он не ограничивает произвольное время специалиста и не меняет длительность процедуры.</p></div>';
  return mountModal(document.body, modal(content, {
    title: 'О шаге записи',
    variant: 'technical',
    surface: 'app',
  }));
}

function mountScreen(root, body) {
  root.innerHTML = `${workspaceHeaderContext({
    title: 'Онлайн-запись',
    a: {
      kind: 'settings',
      data: 'data-online-booking-settings',
      aria: 'Настройки онлайн-записи',
    },
  })}<div class="online-booking-workspace-screen">${body}</div>`;
  root.querySelector('[data-online-booking-settings]')?.addEventListener('click', () => openOnlineBookingSettings(root));
}

function renderReady(root) {
  const workplaces = getWorkplaces();
  const saved = getBookingSettings();
  const options = [
    { value: '', label: 'Выбрать рабочее пространство' },
    ...workplaces.map((item) => ({ value: item.key, label: item.name || 'Без названия' })),
  ];
  const stepControl = select({
    label: 'Шаг записи',
    name: 'slotStep',
    value: String(saved.slotStep),
    options: BOOKING_SLOT_STEPS.map((value) => ({
      value: String(value),
      label: value === 60 ? '1 час' : `${value} минут`,
    })),
    data: 'data-online-booking-slot-step',
  });
  const stepInfo = `<div class="online-booking-info-row">${iconButton('ⓘ', {
    data: 'data-online-booking-slot-info',
    aria: 'О шаге записи',
  })}</div>`;

  mountScreen(root, `<div class="online-booking-link-stack">
    ${copyLinkField('Общая ссылка', bookingLink(publicRouteState.profileSlug), 'general')}
    ${select({
      label: 'Рабочее пространство',
      name: 'bookingWorkplace',
      value: '',
      options,
      aria: 'Выбрать рабочее пространство для онлайн-записи',
    })}
    <div data-workplace-booking-link></div>
    ${twoColumnLayout(stepControl, stepInfo, { ariaLabel: 'Шаг записи' })}
  </div>`);

  bindCopyButtons(root);
  root.querySelector('input[name="bookingWorkplace"]')?.addEventListener('change', (event) => {
    const host = root.querySelector('[data-workplace-booking-link]');
    if (!host) return;
    host.innerHTML = selectedWorkplaceLink(workplaces, event.target.value);
    bindCopyButtons(host);
  });
  root.querySelector('[data-online-booking-slot-step]')?.addEventListener('change', (event) => {
    saveBookingSettings({
      ...getBookingSettings(),
      slotStep: Number(event.currentTarget.value),
    });
  });
  root.querySelector('[data-online-booking-slot-info]')?.addEventListener('click', openSlotStepInfo);
}

function renderUnavailable(root, title, message) {
  mountScreen(root, emptyState(title, message));
}

export function render(root) {
  root.innerHTML = `${workspaceHeaderContext({ title: 'Онлайн-запись' })}${emptyState('Загрузка', 'Формируем ссылки онлайн-записи.')}`;

  void Promise.all([getCurrentAccount(), loadOwnerPublicRoute()])
    .then(([account, publicRoute]) => {
      const tenantId = String(account?.tenant?.id || '');
      if (!tenantId || !publicRoute.profileSlug) {
        renderUnavailable(root, 'Ссылка недоступна', 'Не удалось определить адрес онлайн-записи.');
        return;
      }
      publicRouteState = publicRoute;
      renderReady(root);
    })
    .catch(() => renderUnavailable(root, 'Ссылка недоступна', 'Не удалось сформировать ссылку онлайн-записи.'));
}

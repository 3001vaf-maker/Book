import {
  clearBookingAccount,
  deleteBookingChatMessage,
  editBookingChatMessage,
  getBookingAccount,
  getBookingChat,
  getBookingChatSettings,
  getBookingNotifications,
  getBookingRequests,
  markBookingNotificationRead,
  sendBookingChatMessage,
  setBookingTelegramConsent,
} from '../core/booking-account/index.js';
import { formatPhone } from '../core/phone/index.js';
import { disableWebPush, enableWebPush, getWebPushState } from '../core/notifications/web-push.js';
import {
  appHeader,
  appShell,
  bindRichTextEditor,
  bookingThemeStyle,
  button,
  clientBottomNavigation,
  emptyState,
  entityCard,
  escapeHtml,
  listEntries,
  listEntry,
  mediaRail,
  messageComposer,
  messageThread,
  modal,
  mountModal,
  readOnlyReceipt,
  settingsPanel,
} from '../ui/ui.js';
import { openClientConsentSettings } from './consent-settings.js';
import { openClientPasswordSettings } from './password-settings.js';
import { openClientPersonalData } from './personal-data.js';

function money(value) {
  const number = Number(value || 0);
  return `${(Number.isFinite(number) ? number : 0).toLocaleString('ru-RU').replaceAll('\u00a0', ' ')} ₽`;
}

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function requestProcedures(request = {}) {
  const snapshot = request.recordSnapshot && typeof request.recordSnapshot === 'object' ? request.recordSnapshot : {};
  return Array.isArray(snapshot.procedures) && snapshot.procedures.length
    ? snapshot.procedures
    : Array.isArray(request.procedures) ? request.procedures : [];
}

function requestPricing(request = {}) {
  const snapshot = request.recordSnapshot && typeof request.recordSnapshot === 'object' ? request.recordSnapshot : {};
  const pricing = snapshot.pricing && typeof snapshot.pricing === 'object' ? snapshot.pricing : {};
  const procedures = requestProcedures(request);
  const subtotal = Number.isFinite(Number(pricing.subtotal))
    ? Math.max(0, Number(pricing.subtotal))
    : procedures.reduce((sum, item) => sum + Math.max(0, Number(item?.cost || 0)), 0);
  const discountPercent = Math.max(0, Math.min(100, Number(pricing.discountPercent || 0)));
  const total = Number.isFinite(Number(pricing.total))
    ? Math.max(0, Number(pricing.total))
    : Math.max(0, subtotal * (1 - discountPercent / 100));
  return { subtotal, discountPercent, total, discountAmount: Math.max(0, subtotal - total) };
}

function requestPayment(request = {}) {
  const snapshot = request.recordSnapshot && typeof request.recordSnapshot === 'object' ? request.recordSnapshot : {};
  const payment = snapshot.payment && typeof snapshot.payment === 'object' ? snapshot.payment : {};
  const pricing = requestPricing(request);
  const due = Math.max(0, Number.isFinite(Number(payment.due)) ? Number(payment.due) : pricing.total);
  const paid = Math.max(0, Number.isFinite(Number(payment.paid)) ? Number(payment.paid) : Math.max(0, pricing.total - due));
  return { state: String(payment.state || ''), paid, due };
}

function requestMoment(request = {}) {
  return `${String(request.date || '').slice(0, 10)}T${String(request.from || '00:00').padStart(5, '0')}`;
}

function nowMoment() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `${date}T${time}`;
}

function isCancelled(request = {}) {
  return ['REJECTED', 'CANCELLED'].includes(String(request.status || '').toUpperCase());
}

function lifecycleStatus(request = {}) {
  if (isCancelled(request)) return 'Отменена';
  return requestMoment(request) >= nowMoment() ? 'Предстоящая' : 'Завершена';
}

function financeStatus(request = {}) {
  const payment = requestPayment(request);
  if (payment.due <= 0.009) return { label: 'Оплачено', extra: '' };
  if (requestMoment(request) >= nowMoment()) return { label: 'К оплате', extra: money(payment.due) };
  return { label: 'Задолженность', extra: money(payment.due) };
}

function workplaceName(state, request = {}) {
  const workplaces = Array.isArray(state.context?.workplaces) ? state.context.workplaces : [];
  return workplaces.find((item) => String(item?.key || '') === String(request.workplaceKey || ''))?.name || 'Пространство';
}

function masterName(state) {
  const profile = state.context?.profile || {};
  return [profile.name, profile.surname].filter(Boolean).join(' ').trim() || 'Мастер';
}

function mediaItems(state) {
  const news = Array.isArray(state.context?.news) ? state.context.news : [];
  const reels = Array.isArray(state.context?.reels) ? state.context.reels : [];
  return [...news, ...reels];
}

function nearestVisit(requests = []) {
  const valid = (Array.isArray(requests) ? requests : []).filter((request) => !isCancelled(request));
  const now = nowMoment();
  const future = valid.filter((request) => requestMoment(request) >= now).sort((a, b) => requestMoment(a).localeCompare(requestMoment(b)));
  if (future.length) return { request: future[0], label: 'Предстоящая запись' };
  const past = valid.filter((request) => requestMoment(request) < now).sort((a, b) => requestMoment(b).localeCompare(requestMoment(a)));
  return { request: past[0] || null, label: 'Последний визит' };
}

function aggregateFinance(requests = [], account = {}) {
  const completed = (Array.isArray(requests) ? requests : []).filter((request) => !isCancelled(request) && requestMoment(request) < nowMoment());
  const totals = completed.reduce((sum, request) => {
    const pricing = requestPricing(request);
    const payment = requestPayment(request);
    sum.subtotal += pricing.subtotal;
    sum.discount += pricing.discountAmount;
    sum.paid += payment.paid;
    return sum;
  }, { subtotal: 0, discount: 0, paid: 0 });
  if (!completed.length && Number(account.totalSpent || 0) > 0) totals.paid = Number(account.totalSpent || 0);
  return totals;
}

function programRows(account = {}) {
  const source = Array.isArray(account.programs) ? account.programs : [];
  return source
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      label: String(item?.name || item?.title || 'Программа'),
      value: String(item?.value ?? item?.balance ?? ''),
      source: item,
    }));
}

function openProgram(row) {
  const source = row?.source && typeof row.source === 'object' ? row.source : {};
  const items = Object.entries(source)
    .filter(([key, value]) => !['name', 'title', 'id'].includes(key) && value !== '' && value != null && typeof value !== 'object')
    .map(([key, value]) => ({ label: key, value: String(value) }));
  const content = readOnlyReceipt({
    title: row?.label || 'Программа',
    items: items.length ? items : [{ label: row?.label || 'Значение', value: row?.value || '' }],
  });
  mountModal(document.body, modal(content, { variant: 'large', surface: 'app', title: row?.label || 'Программа' }));
}

function historyEntry(request, index) {
  const procedures = requestProcedures(request).slice(0, 3).map((item) => ({ value: item?.name || 'Процедура', strong: true }));
  while (procedures.length < 3) procedures.push({ value: '' });
  const pricing = requestPricing(request);
  const finance = financeStatus(request);
  return listEntry({
    columns: [
      procedures,
      [
        { value: lifecycleStatus(request), strong: true },
        { value: formatDate(request.date), strong: true },
        { value: request.from || '', strong: true },
      ],
      [
        { value: money(pricing.total), strong: true },
        { value: finance.label, strong: true },
        { value: finance.extra, strong: true },
      ],
    ],
    data: `data-client-history="${index}"`,
    aria: `Открыть запись ${formatDate(request.date)} ${request.from || ''}`,
  });
}

function openHistoryDetail(state, request, onRepeat) {
  const pricing = requestPricing(request);
  const payment = requestPayment(request);
  const totals = [
    { label: 'Стоимость', value: money(pricing.subtotal) },
    { label: 'Скидка', value: money(pricing.discountAmount) },
    { label: 'Оплачено', value: money(payment.paid), strong: true },
  ];
  if (payment.due > 0.009) totals.push({ label: requestMoment(request) < nowMoment() ? 'Задолженность' : 'К оплате', value: money(payment.due), strong: true });
  const procedures = requestProcedures(request);
  const layer = mountModal(document.body, modal(readOnlyReceipt({
    title: workplaceName(state, request),
    status: lifecycleStatus(request),
    date: formatDate(request.date),
    time: request.from || '',
    items: procedures.map((item) => ({ label: item?.name || 'Процедура', value: money(item?.cost || 0) })),
    totals,
    action: procedures.length ? { label: 'Повторить запись', data: 'data-repeat-procedure' } : null,
  }), { variant: 'large', surface: 'app', title: 'Запись' }));
  layer?.querySelector('[data-repeat-procedure]')?.addEventListener('click', () => {
    layer.remove();
    onRepeat?.(request);
  });
}

function notificationMessages(feed = {}) {
  return (Array.isArray(feed?.items) ? feed.items : [])
    .filter((item) => String(item?.type || '') !== 'chat.message')
    .map((item) => ({
      id: `notification:${item.id}`,
      direction: 'system',
      kind: 'system',
      body: [item.title, item.body].filter(Boolean).join('\n'),
      createdAt: item.createdAt,
      notificationId: item.id,
      unread: !item.read,
    }));
}

function messageTime(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function messageContent(message = {}) {
  if (Array.isArray(message?.content?.blocks) && message.content.blocks.length) return message.content;
  const body = String(message.body || '').trim();
  return body ? { version: 1, blocks: [{ type: 'paragraph', spans: [{ text: body, marks: [] }] }] } : { version: 1, blocks: [] };
}

async function fileAttachment(file) {
  if (!(file instanceof File)) return null;
  if (!/^(image|video)\//i.test(file.type || '')) throw new Error('Можно прикрепить фото или видео');
  if (file.size > 8 * 1024 * 1024) throw new Error('Один файл должен быть не больше 8 МБ');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
  return { name: file.name || 'Медиа', type: file.type || '', size: file.size || 0, dataUrl };
}

function bindMessageAttachments(form) {
  const selected = [];
  const input = form?.querySelector('[data-message-attachment-input]');
  const trigger = form?.querySelector('[data-message-attachment]');
  const preview = form?.querySelector('[data-message-attachment-preview]');
  const redraw = () => {
    if (!preview) return;
    preview.innerHTML = selected.map((item) => `<span class="message-composer__attachment-chip">${escapeHtml(item.name || 'Медиа')}</span>`).join('');
  };
  trigger?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', async () => {
    const files = [...(input.files || [])].slice(0, 3);
    try {
      const next = (await Promise.all(files.map(fileAttachment))).filter(Boolean);
      selected.splice(0, selected.length, ...next);
      redraw();
      input.setCustomValidity('');
    } catch (error) {
      selected.splice(0, selected.length);
      redraw();
      input.setCustomValidity(error instanceof Error ? error.message : 'Не удалось прикрепить файл');
      input.reportValidity();
      input.setCustomValidity('');
    }
  });
  return () => [...selected];
}

async function loadMessages(state) {
  const [messages, feed] = await Promise.all([
    getBookingChat(state.tenantId).catch(() => []),
    getBookingNotifications(state.tenantId).catch(() => ({ items: [], unreadCount: 0 })),
  ]);
  return [...(Array.isArray(messages) ? messages : []), ...notificationMessages(feed)]
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
    .map((item) => ({ ...item, time: messageTime(item.createdAt) }));
}

function bindBottomNavigation(root, state, handlers) {
  root.querySelectorAll('[data-client-nav]').forEach((node) => node.addEventListener('click', () => {
    const next = String(node.dataset.clientNav || '');
    if (!next || next === state.clientTab) return;
    state.clientTab = next;
    state.clientChatOpen = false;
    void handlers.render();
  }));
}

function accountThemeClasses(state) {
  const theme = state.settings?.theme && typeof state.settings.theme === 'object' ? state.settings.theme : {};
  const shape = ['soft', 'round', 'straight', 'cut'].includes(theme.shape) ? theme.shape : 'soft';
  const choiceStyle = ['cards', 'compact', 'list'].includes(theme.choiceStyle) ? theme.choiceStyle : 'cards';
  return `booking-client booking-client--account booking-shape--${shape} booking-choice-style--${choiceStyle}`;
}

function renderShell(root, state, { title, back = null, action = null, settings = null, body = '', primaryAction = '', className = '', media = null } = {}) {
  const shell = appShell({
    header: appHeader({ title, back, action, settings }),
    media: media === null ? mediaRail(mediaItems(state)) : media,
    body,
    primaryAction,
    bottomNavigation: clientBottomNavigation(state.clientTab || 'profile'),
    className,
  });
  root.innerHTML = `<section class="${accountThemeClasses(state)}" style="${bookingThemeStyle(state.settings)}">${shell}</section>`;
}

async function openChatSettings(state) {
  const [pushState, chatSettings] = await Promise.all([
    getWebPushState(state.tenantId).catch(() => ({ supported: false, enabled: false, subscribed: false, permission: 'unsupported' })),
    getBookingChatSettings(state.tenantId).catch(() => ({ telegram: { linked: false, enabled: false, username: '' } })),
  ]);
  let push = pushState;
  let telegram = chatSettings?.telegram || { linked: false, enabled: false, username: '' };
  const render = () => settingsPanel([
    { type: 'toggle', label: 'Push', checked: Boolean(push.subscribed), data: 'data-chat-push', disabled: !push.supported || !push.enabled || push.permission === 'denied' },
    { type: 'toggle', label: 'Telegram', checked: Boolean(telegram.enabled), data: 'data-chat-telegram', disabled: !telegram.linked },
    { label: 'Согласия', data: 'data-chat-consents' },
  ]);
  const layer = mountModal(document.body, modal(render(), { variant: 'medium', surface: 'app', title: 'Настройки чата' }));
  const redraw = () => {
    const panel = layer?.querySelector('.app-settings-panel');
    if (panel) panel.outerHTML = render();
    bind();
  };
  const bind = () => {
    layer?.querySelector('[data-chat-push]')?.addEventListener('click', async () => {
      push = push.subscribed ? await disableWebPush(state.tenantId) : await enableWebPush(state.tenantId);
      redraw();
    });
    layer?.querySelector('[data-chat-telegram]')?.addEventListener('click', async () => {
      if (!telegram.linked) return;
      const next = await setBookingTelegramConsent(state.tenantId, !telegram.enabled).catch(() => null);
      if (next?.telegram) telegram = next.telegram;
      redraw();
    });
    layer?.querySelector('[data-chat-consents]')?.addEventListener('click', () => {
      layer.remove();
      void openClientConsentSettings(state);
    });
  };
  bind();
}

function openProfileSettings(state, { onPersonalData, onPassword, onConsents, onLogout }) {
  const layer = mountModal(document.body, modal(settingsPanel([
    { label: 'Личные данные', data: 'data-client-personal-data' },
    { label: 'Изменить пароль', data: 'data-client-change-password' },
    { label: 'Согласия', data: 'data-client-consents' },
    { label: 'Выход', data: 'data-client-logout', variant: 'danger' },
  ]), { variant: 'medium', surface: 'app', title: 'Настройки профиля' }));
  layer?.querySelector('[data-client-personal-data]')?.addEventListener('click', () => {
    layer.remove();
    onPersonalData?.();
  });
  layer?.querySelector('[data-client-change-password]')?.addEventListener('click', () => {
    layer.remove();
    onPassword?.();
  });
  layer?.querySelector('[data-client-consents]')?.addEventListener('click', () => {
    layer.remove();
    onConsents?.();
  });
  layer?.querySelector('[data-client-logout]')?.addEventListener('click', () => {
    layer.remove();
    onLogout?.();
  });
}

async function renderProfile(root, state, handlers) {
  const requests = state.clientRequests || [];
  const account = state.account || {};
  const profile = account.profileData && typeof account.profileData === 'object' ? account.profileData : {};
  const visit = nearestVisit(requests);
  const request = visit.request;
  const finance = aggregateFinance(requests, account);
  const rows = programRows(account);
  const discount = Math.max(0, Number(account.discountPercent || 0));
  const card = entityCard({
    id: account.uei ? `UEI ${account.uei}` : '',
    title: [account.name, account.surname].filter(Boolean).join(' '),
    subtitle: formatPhone(account.phone || ''),
    image: profile.photo || '',
    topMeta: request ? [
      { value: workplaceName(state, request), row: 1 },
      { value: visit.label, weight: 'regular', row: 2 },
    ] : [],
    topRightMeta: [
      ...(discount > 0 ? [{ value: `${discount}%`, row: 1 }] : []),
      ...(request ? [
        { value: formatDate(request.date), row: 2 },
        { value: request.from || '', row: 3 },
      ] : []),
    ],
    meta: [
      { value: money(finance.subtotal), label: 'Стоимость' },
      { value: money(finance.discount), label: 'Скидка' },
      { value: money(finance.paid), label: 'Оплачено' },
    ],
    detailRows: rows.map((row, index) => ({
      left: row.label,
      right: row.value,
      data: `data-client-program="${index}"`,
      aria: `Открыть программу ${row.label}`,
    })),
    className: 'entity-card--hero',
  });
  const profileMedia = mediaRail(mediaItems(state)) || '<div class="app-media-rail app-media-rail--placeholder" aria-hidden="true"></div>';
  renderShell(root, state, {
    title: 'Профиль',
    settings: { data: 'data-client-profile-settings', aria: 'Настройки профиля' },
    body: card,
    media: profileMedia,
    primaryAction: button('Записаться', { data: 'data-client-booking' }),
    className: 'app-view-shell--profile',
  });
  bindBottomNavigation(root, state, handlers);
  root.querySelector('[data-client-booking]')?.addEventListener('click', handlers.onStartBooking);
  root.querySelector('[data-client-profile-settings]')?.addEventListener('click', () => openProfileSettings(state, {
    onPersonalData: handlers.onPersonalData,
    onPassword: handlers.onPassword,
    onConsents: handlers.onConsents,
    onLogout: handlers.onLogout,
  }));
  root.querySelectorAll('[data-client-program]').forEach((node) => node.addEventListener('click', () => openProgram(rows[Number(node.dataset.clientProgram)])));
}

async function renderHistory(root, state, handlers) {
  const requests = state.clientRequests || [];
  const body = requests.length
    ? listEntries(requests.map((request, index) => historyEntry(request, index)))
    : emptyState('История пока пустая', 'Здесь появятся ваши записи и визиты.');
  renderShell(root, state, { title: 'История', body });
  bindBottomNavigation(root, state, handlers);
  root.querySelectorAll('[data-client-history]').forEach((node) => node.addEventListener('click', () => {
    const request = requests[Number(node.dataset.clientHistory)];
    if (request) openHistoryDetail(state, request, handlers.onRepeat);
  }));
}

function openClientMessageActions(root, state, handlers, message) {
  const layer = mountModal(document.body, modal(settingsPanel([
    { label: 'Изменить', data: 'data-client-message-edit' },
    { label: 'Удалить', data: 'data-client-message-delete', variant: 'danger' },
  ]), { title: 'Сообщение', variant: 'medium', surface: 'app' }));
  layer?.querySelector('[data-client-message-edit]')?.addEventListener('click', () => {
    layer.remove();
    const editLayer = mountModal(document.body, modal(`<form class="form-grid" data-client-message-edit-form>${messageComposer({ placeholder: 'Сообщение', attachments: false, rich: true, embedded: true, value: messageContent(message) })}<div class="muted" data-client-message-edit-status></div></form>`, { title: 'Изменить сообщение', variant: 'large', surface: 'app' }));
    const form = editLayer?.querySelector('[data-client-message-edit-form]');
    const editor = bindRichTextEditor(form, { value: messageContent(message) });
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = editor.getValue();
      if (!value.body) return;
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        await editBookingChatMessage(state.tenantId, message.id, value);
        editLayer.remove();
        await handlers.render();
      } catch (error) {
        const status = form.querySelector('[data-client-message-edit-status]');
        if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось изменить';
        if (submit) submit.disabled = false;
      }
    });
  });
  layer?.querySelector('[data-client-message-delete]')?.addEventListener('click', () => {
    layer.remove();
    const confirmLayer = mountModal(document.body, modal(`<div class="form-grid"><p>Удалить это сообщение?</p>${button('Удалить', { variant: 'danger', data: 'data-client-message-delete-confirm' })}${button('Отмена', { variant: 'secondary', data: 'data-client-message-delete-cancel' })}<div class="muted" data-client-message-delete-status></div></div>`, { title: 'Удаление сообщения', variant: 'medium', surface: 'app' }));
    confirmLayer?.querySelector('[data-client-message-delete-cancel]')?.addEventListener('click', () => confirmLayer.remove());
    confirmLayer?.querySelector('[data-client-message-delete-confirm]')?.addEventListener('click', async () => {
      const control = confirmLayer.querySelector('[data-client-message-delete-confirm]');
      if (control) control.disabled = true;
      try {
        await deleteBookingChatMessage(state.tenantId, message.id);
        confirmLayer.remove();
        await handlers.render();
      } catch (error) {
        const status = confirmLayer.querySelector('[data-client-message-delete-status]');
        if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось удалить';
        if (control) control.disabled = false;
      }
    });
  });
}

async function renderMessages(root, state, handlers) {
  const messages = await loadMessages(state);
  const master = masterName(state);
  if (!state.clientChatOpen) {
    const last = messages[messages.length - 1];
    const lastLabel = last?.deletedAt ? 'Сообщение удалено' : last?.body ? String(last.body).split('\n')[0] : Array.isArray(last?.attachments) && last.attachments.length ? 'Медиа' : 'Открыть диалог';
    const body = listEntries([listEntry({
      title: master,
      subtitle: lastLabel,
      rightTop: last?.time || '',
      data: 'data-client-open-chat',
      aria: `Открыть диалог с ${master}`,
    })]);
    renderShell(root, state, { title: 'Сообщения', body, media: '' });
    bindBottomNavigation(root, state, handlers);
    root.querySelector('[data-client-open-chat]')?.addEventListener('click', () => {
      state.clientChatOpen = true;
      void handlers.render();
    });
    return;
  }

  renderShell(root, state, {
    title: master,
    back: { data: 'data-client-chat-back', aria: 'К списку диалогов' },
    action: { label: 'Записаться', data: 'data-client-chat-booking' },
    settings: { data: 'data-client-chat-settings', aria: 'Настройки чата' },
    body: `${messages.length ? messageThread(messages, { viewer: 'client', actions: true }) : emptyState('Сообщений пока нет', 'Напишите мастеру первое сообщение.')}${messageComposer({ attachments: true, rich: true })}<div class="muted" data-client-chat-status aria-live="polite"></div>`,
    media: '',
    className: 'app-view-shell--chat',
  });
  bindBottomNavigation(root, state, handlers);
  root.querySelector('[data-client-chat-back]')?.addEventListener('click', () => {
    state.clientChatOpen = false;
    void handlers.render();
  });
  root.querySelector('[data-client-chat-booking]')?.addEventListener('click', handlers.onStartBooking);
  root.querySelector('[data-client-chat-settings]')?.addEventListener('click', () => void openChatSettings(state));
  root.querySelectorAll('[data-message-actions]').forEach((control) => control.addEventListener('click', (event) => {
    event.stopPropagation();
    const message = messages.find((item) => String(item.id) === String(control.dataset.messageActions));
    if (message) openClientMessageActions(root, state, handlers, message);
  }));
  root.querySelectorAll('[data-message-id]').forEach((node) => {
    const message = messages.find((item) => String(item?.id || '') === String(node.dataset.messageId || ''));
    if (!message?.notificationId || !message.unread) return;
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-label', 'Открыть уведомление');
    const openNotification = async () => {
      if (!message.unread) return;
      try {
        await markBookingNotificationRead(state.tenantId, message.notificationId);
        message.unread = false;
        node.removeAttribute('tabindex');
        node.removeAttribute('role');
        node.removeAttribute('aria-label');
      } catch {}
    };
    node.addEventListener('click', () => void openNotification());
    node.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      void openNotification();
    });
  });
  const form = root.querySelector('[data-message-composer]');
  const editor = bindRichTextEditor(form);
  const getAttachments = bindMessageAttachments(form);
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = editor.getValue();
    const attachments = getAttachments();
    if (!value.body && !attachments.length) return;
    const submit = form.querySelector('button[type="submit"]');
    const status = root.querySelector('[data-client-chat-status]');
    if (submit) submit.disabled = true;
    try {
      await sendBookingChatMessage(state.tenantId, { body: value.body, content: value.content, attachments });
      await handlers.render();
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось отправить';
      if (submit) submit.disabled = false;
    }
  });
  requestAnimationFrame(() => {
    const screen = root.querySelector('.app-view-shell--chat .app-view-shell__screen');
    if (screen) screen.scrollTop = screen.scrollHeight;
  });
}

export async function renderClientAccount(root, state, callbacks = {}) {
  state.clientTab ||= 'profile';
  state.clientChatOpen = Boolean(state.clientChatOpen);
  try {
    const [requests, account] = await Promise.all([
      getBookingRequests(state.tenantId).catch(() => []),
      getBookingAccount(state.tenantId),
    ]);
    state.clientRequests = Array.isArray(requests) ? requests : [];
    if (account) state.account = account;
    state.error = '';
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Не удалось загрузить аккаунт';
  }

  const handlers = {
    render: () => renderClientAccount(root, state, callbacks),
    onStartBooking: callbacks.onStartBooking || (() => {}),
    onRepeat: callbacks.onRepeat || (() => {}),
    onPersonalData: () => openClientPersonalData(state, {
      onSaved: () => renderClientAccount(root, state, callbacks),
    }),
    onPassword: () => openClientPasswordSettings(state),
    onConsents: () => openClientConsentSettings(state, {
      onChanged: () => renderClientAccount(root, state, callbacks),
    }),
    onLogout: callbacks.onLogout || (() => {
      clearBookingAccount(state.tenantId);
    }),
  };

  if (state.error) {
    renderShell(root, state, { title: 'Профиль', body: emptyState('Аккаунт недоступен', state.error) });
    bindBottomNavigation(root, state, handlers);
    return;
  }

  if (state.clientTab === 'messages') return renderMessages(root, state, handlers);
  if (state.clientTab === 'history') return renderHistory(root, state, handlers);
  return renderProfile(root, state, handlers);
}

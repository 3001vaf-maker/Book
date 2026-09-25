import {
  accountErrorMessage,
  isAccountSystemError,
  clearAccount,
  getAccount,
  getAccountChat,
  getAccountChatSettings,
  getAccountNotifications,
  getAccountRecords,
  markAccountNotificationRead,
  sendAccountChatMessage,
} from '../core/account/index.js';
import { formatPhone } from '../core/phone/index.js';
import { projectRecordStatuses } from '../core/record/index.js';
import { disableWebPush, enableWebPush, getWebPushState } from '../core/notifications/web-push.js';
import {
  bookingThemeStyle,
  button,
  emptyState,
  entityCard,
  escapeHtml,
  listEntries,
  listEntry,
  readOnlyReceipt,
  settingsPanel,
  v2FDeck,
  v2Header,
  v2HorizontalRail,
  modal,
  openNotice,
  v2RailCard,
  v2Section,
  v2Shell,
  initV2Swipe,
  initV2WorkspaceInteraction,
  setV2DeckOpen,
  mountModal,
} from '../ui/ui.js';
import { messageComposer, messageThread } from '../ui/chat/index.js';
import { openAccountConsentSettings } from './consent-settings.js';
import { openAccountPasswordSettings } from './password-settings.js';
import { openAccountPersonalData } from './personal-data.js';

function money(value) {
  const number = Number(value || 0);
  return `${(Number.isFinite(number) ? number : 0).toLocaleString('ru-RU').replaceAll('\u00a0', ' ')} ₽`;
}

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function requestProcedures(request = {}) {
  return Array.isArray(request.procedures) ? request.procedures : [];
}

function requestPricing(request = {}) {
  const finance = request.finance && typeof request.finance === 'object' ? request.finance : {};
  const subtotal = Math.max(0, Number(finance.serviceTotal || 0));
  const discountPercent = Math.max(0, Math.min(100, Number(finance.discountPercent || 0)));
  const discountAmount = Math.max(0, Number(finance.discountTotal || 0));
  const total = Math.max(0, Number(finance.planTotal || 0));
  return { subtotal, discountPercent, total, discountAmount };
}

function requestPayment(request = {}) {
  const payment = request.payment && typeof request.payment === 'object' ? request.payment : {};
  return {
    state: String(payment.state || 'unpaid'),
    paid: Math.max(0, Number(payment.paid || 0)),
    due: Math.max(0, Number(payment.due || 0)),
  };
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
  return String(request.status || '').toLowerCase() === 'cancelled';
}

const ACTION_STATUS_LABELS = Object.freeze({
  booked: 'Записался',
  rescheduled: 'Перенёс',
  cancelled: 'Отменил',
});

const PAYMENT_STATUS_LABELS = Object.freeze({
  due: 'К оплате',
  paid: 'Оплачено',
  debt: 'Задолженность',
});

function requestStatuses(request = {}) {
  return projectRecordStatuses(request, request.history, requestPayment(request));
}

function actionStatus(request = {}) {
  const status = requestStatuses(request).action;
  return ACTION_STATUS_LABELS[status] || '';
}

function financeStatus(request = {}) {
  const payment = requestPayment(request);
  const status = requestStatuses(request).payment;
  return {
    label: PAYMENT_STATUS_LABELS[status] || '',
    extra: status === 'due' || status === 'debt' ? money(payment.due) : '',
  };
}

function workplaceName(state, request = {}) {
  const tenantId = String(request?.tenantId || state.tenantId || '');
  const relationship = (Array.isArray(state.relationships) ? state.relationships : [])
    .find((item) => String(item?.tenantId || '') === tenantId);
  const workplaces = Array.isArray(relationship?.context?.workplaces)
    ? relationship.context.workplaces
    : Array.isArray(state.context?.workplaces) ? state.context.workplaces : [];
  return workplaces.find((item) => String(item?.key || '') === String(request.workplaceId || ''))?.name
    || [relationship?.context?.profile?.name, relationship?.context?.profile?.surname].filter(Boolean).join(' ').trim()
    || 'Пространство';
}

function profileDisplayName(state) {
  const profile = state.context?.profile || {};
  return [profile.name, profile.surname].filter(Boolean).join(' ').trim() || 'Профиль';
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
  mountModal(document.body, modal(content, { variant: 'large', title: row?.label || 'Программа' }));
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
        { value: actionStatus(request), strong: true },
        { value: formatDate(request.date), strong: true },
        { value: request.from || '', strong: true },
      ],
      [
        { value: money(pricing.total), strong: true },
        { value: finance.label, strong: true },
        { value: finance.extra, strong: true },
      ],
    ],
    data: `data-account-history="${index}"`,
    aria: `Открыть запись ${formatDate(request.date)} ${request.from || ''}`,
  });
}

function historyDetailBody(state, request) {
  const pricing = requestPricing(request);
  const payment = requestPayment(request);
  const totals = [
    { label: 'Стоимость', value: money(pricing.subtotal) },
    { label: 'Скидка', value: money(pricing.discountAmount) },
    { label: 'Оплачено', value: money(payment.paid), strong: true },
  ];
  const paymentStatus = requestStatuses(request).payment;
  if ((paymentStatus === 'due' || paymentStatus === 'debt') && payment.due > 0.009) {
    totals.push({ label: PAYMENT_STATUS_LABELS[paymentStatus], value: money(payment.due), strong: true });
  }
  return readOnlyReceipt({
    title: workplaceName(state, request),
    status: actionStatus(request),
    date: formatDate(request.date),
    time: request.from || '',
    items: requestProcedures(request).map((item) => ({ label: item?.name || 'Процедура', value: money(item?.cost || 0) })),
    totals,
  });
}

function selectHistoryRequest(state, request, returnTab = 'history') {
  state.accountHistoryRequestId = String(request?.id || '');
  state.accountHistoryRequestMoment = requestMoment(request);
  state.accountHistoryReturn = returnTab;
  state.accountTab = 'history-detail';
  state.accountDeckOpen = false;
}

function currentHistoryRequest(state) {
  const rows = Array.isArray(state.accountRecords) ? state.accountRecords : [];
  return rows.find((request) => String(request?.id || '') === String(state.accountHistoryRequestId || ''))
    || rows.find((request) => requestMoment(request) === String(state.accountHistoryRequestMoment || ''))
    || null;
}

function notificationMessages(feed = {}) {
  return (Array.isArray(feed?.items) ? feed.items : []).map((item) => ({
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

async function fileAttachment(file) {
  if (!(file instanceof File)) return null;
  if (!/^(image|video)\//i.test(file.type || '') && String(file.type || '').toLowerCase() !== 'application/pdf') throw new Error('Можно прикрепить фото, видео или PDF');
  if (file.size > 8 * 1024 * 1024) throw new Error('Один файл должен быть не больше 8 МБ');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
  return { name: file.name || 'Файл', type: file.type || '', size: file.size || 0, dataUrl };
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
    } catch (error) {
      selected.splice(0, selected.length);
      redraw();
      openNotice({
        title: 'Файл не прикреплён',
        message: error instanceof Error ? error.message : 'Не удалось прикрепить файл',
        action: 'Закрыть',
        variant: 'technical',
      });
    }
  });
  return () => [...selected];
}

async function loadMessages(state) {
  const [messages, feed] = await Promise.all([
    getAccountChat(state.tenantId).catch(() => []),
    getAccountNotifications(state.tenantId).catch(() => ({ items: [], unreadCount: 0 })),
  ]);
  return [...(Array.isArray(messages) ? messages : []), ...notificationMessages(feed)]
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
    .map((item) => ({ ...item, time: messageTime(item.createdAt) }));
}

function accountThemeClasses(state) {
  const theme = state.settings?.theme && typeof state.settings.theme === 'object' ? state.settings.theme : {};
  const shape = ['soft', 'round', 'straight', 'cut'].includes(theme.shape) ? theme.shape : 'soft';
  const choiceStyle = ['cards', 'compact', 'list'].includes(theme.choiceStyle) ? theme.choiceStyle : 'cards';
  return `booking-account booking-account--account booking-account--v2 booking-shape--${shape} booking-choice-style--${choiceStyle}`;
}

function accountName(state) {
  const account = state.account || {};
  return [account.name, account.surname].filter(Boolean).join(' ').trim() || 'Профиль';
}

function accountPhoto(state) {
  const profile = state.account?.profileData && typeof state.account.profileData === 'object' ? state.account.profileData : {};
  return String(profile.photo || '');
}

function representativePhoto(state) {
  return String(state.context?.profile?.photo || '');
}

function futureRequests(requests = []) {
  const now = nowMoment();
  return (Array.isArray(requests) ? requests : [])
    .filter((request) => !isCancelled(request) && requestMoment(request) >= now)
    .sort((a, b) => requestMoment(a).localeCompare(requestMoment(b)));
}

function representativeCard(state, { compact = false } = {}) {
  const profile = state.context?.profile || {};
  const title = profileDisplayName(state);
  const subtitle = String(profile.profession || '').trim();
  return entityCard({
    title,
    subtitle,
    image: representativePhoto(state),
    initial: title.slice(0, 1).toUpperCase(),
    interactive: true,
    data: 'data-account-open-representative',
    aria: `Открыть ${title}`,
    className: compact ? 'entity-card--compact' : 'entity-card--hero',
  });
}

function visitCard(state, request, index) {
  const procedures = requestProcedures(request).map((item) => item?.name || '').filter(Boolean).join(', ');
  return v2RailCard({
    title: workplaceName(state, request),
    subtitle: procedures || 'Визит',
    meta: `${formatDate(request.date)} · ${request.from || ''}`,
    data: `data-account-upcoming="${index}"`,
    aria: `Открыть визит ${formatDate(request.date)} ${request.from || ''}`,
  });
}

function accountDeck(state) {
  const fallback = state.accountTab === 'history' ? 'history' : 'representatives';
  state.accountDeckActive ||= fallback;
  return v2FDeck([
    { id: 'representatives', label: 'Представители' },
    { id: 'history', label: 'История' },
  ], { active: state.accountDeckActive, data: 'data-account-deck-item' });
}

function renderV2Shell(root, state, { header, body = '', deck = true, className = '' } = {}) {
  const shell = v2Shell({
    header,
    body,
    deck: deck ? accountDeck(state) : '',
    deckOpen: Boolean(state.accountDeckOpen && deck),
    className,
  });
  root.innerHTML = `<section class="${accountThemeClasses(state)}" style="${bookingThemeStyle(state.settings)}">${shell}</section>`;
}

function setAccountDeckOpen(root, state, open) {
  state.accountDeckOpen = Boolean(open);
  setV2DeckOpen(root, state.accountDeckOpen);
}

function bindWorkspaceInteraction(root, state, handlers, { bindZ = true, onZRight = null, onZLeft = null } = {}) {
  return initV2WorkspaceInteraction(root, {
    activeId: state.accountDeckActive || 'representatives',
    deckOpen: state.accountDeckOpen,
    bindZ,
    onZRight,
    onZLeft,
    onDeckOpenChange: (open) => {
      state.accountDeckOpen = open;
    },
    onRootSelect: (id) => {
      const next = id === 'history' ? 'history' : 'representatives';
      if (id === String(state.accountDeckActive || '') && next === state.accountTab) {
        setAccountDeckOpen(root, state, true);
        return;
      }
      state.accountDeckActive = id;
      state.accountDeckOpen = true;
      state.accountChatOpen = false;
      state.accountTab = next;
      void handlers.render();
    },
  });
}

async function openChatSettings(state) {
  const [pushState, chatSettings] = await Promise.all([
    getWebPushState(state.tenantId).catch(() => ({ supported: false, enabled: false, subscribed: false, permission: 'unsupported' })),
    getAccountChatSettings(state.tenantId).catch(() => ({ telegram: { linked: false, enabled: false, username: '' } })),
  ]);
  let push = pushState;
  const telegram = chatSettings?.telegram || { linked: false, enabled: false, username: '' };
  const render = () => settingsPanel([
    { type: 'toggle', label: 'Push', checked: Boolean(push.subscribed), data: 'data-chat-push', disabled: !push.supported || !push.enabled || push.permission === 'denied' },
    { label: telegram.linked ? `Telegram: ${telegram.username || 'подключён'}` : 'Telegram не подключён' },
    { label: 'Согласия', data: 'data-chat-consents' },
  ]);
  const layer = mountModal(document.body, modal(render(), { variant: 'large', title: 'Настройки чата' }));
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
    layer?.querySelector('[data-chat-consents]')?.addEventListener('click', () => {
      layer.remove();
      void openAccountConsentSettings(state);
    });
  };
  bind();
}

function openProfileSettings(state, { onPersonalData, onPassword, onConsents, onLogout }) {
  const items = [
    { label: 'Личные данные', data: 'data-account-personal-data' },
    { label: 'Изменить пароль', data: 'data-account-change-password' },
    ...(onConsents ? [{ label: 'Согласия', data: 'data-account-consents' }] : []),
    { label: 'Выход', data: 'data-account-logout', variant: 'danger' },
  ];
  const layer = mountModal(document.body, modal(settingsPanel(items), { variant: 'large', title: 'Настройки профиля' }));
  layer?.querySelector('[data-account-personal-data]')?.addEventListener('click', () => {
    layer.remove();
    onPersonalData?.();
  });
  layer?.querySelector('[data-account-change-password]')?.addEventListener('click', () => {
    layer.remove();
    onPassword?.();
  });
  layer?.querySelector('[data-account-consents]')?.addEventListener('click', () => {
    layer.remove();
    onConsents?.();
  });
  layer?.querySelector('[data-account-logout]')?.addEventListener('click', () => {
    layer.remove();
    onLogout?.();
  });
}

async function renderHome(root, state, handlers) {
  const account = state.account || {};
  const requests = futureRequests(state.accountRecords || []);
  const upcoming = requests.length
    ? v2HorizontalRail(requests.map((request, index) => visitCard(state, request, index)).join(''))
    : emptyState('Предстоящих визитов нет', 'Новые записи появятся здесь.');
  const representative = v2HorizontalRail(representativeCard(state));
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state), data: 'data-account-profile-settings', aria: 'Настройки профиля' },
    b: accountName(state),
    d: { kind: 'chat', data: 'data-account-open-chat-root', aria: 'Чат', badge: state.accountUnreadCount || 0 },
  });
  renderV2Shell(root, state, {
    header,
    body: `${v2Section('Предстоящие визиты', upcoming)}${v2Section('Представители / пространства', representative)}`,
  });
  bindWorkspaceInteraction(root, state, handlers);
  root.querySelector('[data-account-profile-settings]')?.addEventListener('click', () => openProfileSettings(state, {
    onPersonalData: handlers.onPersonalData,
    onPassword: handlers.onPassword,
    onConsents: handlers.onConsents,
    onLogout: handlers.onLogout,
  }));
  root.querySelector('[data-account-open-chat-root]')?.addEventListener('click', () => {
    state.accountTab = 'messages';
    state.accountChatOpen = false;
    state.accountChatReturn = 'deck';
    state.accountDeckOpen = false;
    void handlers.render();
  });
  root.querySelector('[data-account-open-representative]')?.addEventListener('click', () => {
    state.accountTab = 'representative';
    state.accountDeckOpen = false;
    void handlers.render();
  });
  root.querySelectorAll('[data-account-upcoming]').forEach((node) => node.addEventListener('click', () => {
    const request = requests[Number(node.dataset.accountUpcoming)];
    if (!request) return;
    selectHistoryRequest(state, request, 'home');
    void handlers.render();
  }));
}

async function renderRepresentatives(root, state, handlers) {
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state), data: 'data-account-profile-settings', aria: 'Настройки профиля' },
    b: 'Представители',
    d: { kind: 'chat', data: 'data-account-open-chat-root', aria: 'Чат', badge: state.accountUnreadCount || 0 },
  });
  renderV2Shell(root, state, {
    header,
    body: representativeCard(state),
  });
  bindWorkspaceInteraction(root, state, handlers);
  root.querySelector('[data-account-open-representative]')?.addEventListener('click', () => {
    state.accountTab = 'representative';
    state.accountDeckOpen = false;
    void handlers.render();
  });
  root.querySelector('[data-account-open-chat-root]')?.addEventListener('click', () => {
    state.accountTab = 'messages';
    state.accountChatOpen = false;
    void handlers.render();
  });
  root.querySelector('[data-account-profile-settings]')?.addEventListener('click', () => openProfileSettings(state, {
    onPersonalData: handlers.onPersonalData,
    onPassword: handlers.onPassword,
    onConsents: handlers.onConsents,
    onLogout: handlers.onLogout,
  }));
}

async function renderRepresentative(root, state, handlers) {
  const requests = futureRequests(state.accountRecords || []);
  const records = Array.isArray(state.accountRecords) ? state.accountRecords : [];
  const finance = aggregateFinance(records, state.account || {});
  const rows = programRows(state.account || {});
  const hasInteractionHistory = records.some((request) => !isCancelled(request) && requestMoment(request) < nowMoment())
    || Number(state.account?.totalSpent || 0) > 0;
  const metrics = hasInteractionHistory ? v2HorizontalRail([
    v2RailCard({ title: money(finance.subtotal), subtitle: 'Стоимость' }),
    v2RailCard({ title: money(finance.discount), subtitle: 'Скидка' }),
    v2RailCard({ title: money(finance.paid), subtitle: 'Оплачено' }),
  ].join('')) : '';
  const upcoming = requests.length ? v2HorizontalRail(requests.map((request, index) => visitCard(state, request, index)).join('')) : '';
  const programs = rows.length
    ? v2HorizontalRail(rows.map((row, index) => v2RailCard({ title: row.label, subtitle: row.value, data: `data-account-program="${index}"`, aria: `Открыть программу ${row.label}` })).join(''))
    : '';
  const header = v2Header({
    a: { kind: 'avatar', label: profileDisplayName(state), image: representativePhoto(state), disabled: true },
    b: profileDisplayName(state),
    c: { kind: 'text', label: 'Записаться', data: 'data-account-booking', aria: 'Записаться' },
    d: { kind: 'chat', data: 'data-account-open-chat-direct', aria: 'Чат' },
  });
  renderV2Shell(root, state, {
    header,
    body: `${metrics ? v2Section('Взаимодействие', metrics) : ''}${upcoming ? v2Section('Предстоящие визиты', upcoming) : ''}${programs ? v2Section('Программы', programs) : ''}`,
  });
  bindWorkspaceInteraction(root, state, handlers);
  root.querySelector('[data-account-booking]')?.addEventListener('click', handlers.onStartBooking);
  root.querySelector('[data-account-open-chat-direct]')?.addEventListener('click', () => {
    state.accountTab = 'messages';
    state.accountChatOpen = true;
    state.accountChatReturn = 'deck';
    state.accountDeckOpen = false;
    void handlers.render();
  });
  root.querySelectorAll('[data-account-upcoming]').forEach((node) => node.addEventListener('click', () => {
    const request = requests[Number(node.dataset.accountUpcoming)];
    if (!request) return;
    selectHistoryRequest(state, request, 'representative');
    void handlers.render();
  }));
  root.querySelectorAll('[data-account-program]').forEach((node) => node.addEventListener('click', () => openProgram(rows[Number(node.dataset.accountProgram)])));
}

async function renderHistory(root, state, handlers) {
  const requests = (state.accountRecords || []).slice().sort((a, b) => requestMoment(a).localeCompare(requestMoment(b)));
  const body = requests.length
    ? listEntries(requests.map((request, index) => historyEntry(request, index)))
    : emptyState('История пока пустая', 'Здесь появятся ваши записи и визиты.');
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state), data: 'data-account-profile-settings', aria: 'Настройки профиля' },
    b: 'История',
    d: { kind: 'chat', data: 'data-account-open-chat-root', aria: 'Чат', badge: state.accountUnreadCount || 0 },
  });
  renderV2Shell(root, state, { header, body });
  bindWorkspaceInteraction(root, state, handlers);
  root.querySelectorAll('[data-account-history]').forEach((node) => node.addEventListener('click', () => {
    const request = requests[Number(node.dataset.accountHistory)];
    if (!request) return;
    selectHistoryRequest(state, request, 'history');
    void handlers.render();
  }));
  const anchorIndex = requests.findIndex((request) => !isCancelled(request) && requestMoment(request) >= nowMoment());
  if (anchorIndex > 0) requestAnimationFrame(() => root.querySelector(`[data-account-history="${anchorIndex}"]`)?.scrollIntoView?.({ block: 'center' }));
  root.querySelector('[data-account-open-chat-root]')?.addEventListener('click', () => {
    state.accountTab = 'messages';
    state.accountChatOpen = false;
    state.accountChatReturn = 'deck';
    void handlers.render();
  });
  root.querySelector('[data-account-profile-settings]')?.addEventListener('click', () => openProfileSettings(state, {
    onPersonalData: handlers.onPersonalData,
    onPassword: handlers.onPassword,
    onConsents: handlers.onConsents,
    onLogout: handlers.onLogout,
  }));
}

async function renderHistoryDetail(root, state, handlers) {
  const request = currentHistoryRequest(state);
  if (!request) {
    state.accountTab = state.accountHistoryReturn || 'history';
    await handlers.render();
    return;
  }
  const canRepeat = requestProcedures(request).length > 0;
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state), data: 'data-account-profile-settings', aria: 'Настройки профиля' },
    b: workplaceName(state, request),
    c: canRepeat ? { kind: 'text', label: 'Записаться', data: 'data-account-history-repeat', aria: 'Записаться снова' } : null,
    d: { kind: 'chat', data: 'data-account-history-chat', aria: 'Чат', badge: state.accountUnreadCount || 0 },
  });
  renderV2Shell(root, state, { header, body: historyDetailBody(state, request) });
  bindWorkspaceInteraction(root, state, handlers, {
    onZRight: () => {
      state.accountTab = state.accountHistoryReturn || 'history';
      state.accountHistoryRequestId = '';
      state.accountHistoryRequestMoment = '';
      void handlers.render();
    },
  });
  root.querySelector('[data-account-history-repeat]')?.addEventListener('click', () => handlers.onRepeat?.(request));
  root.querySelector('[data-account-history-chat]')?.addEventListener('click', () => {
    state.accountTab = 'messages';
    state.accountChatOpen = true;
    state.accountChatReturn = 'deck';
    state.accountDeckOpen = false;
    void handlers.render();
  });
  root.querySelector('[data-account-profile-settings]')?.addEventListener('click', () => openProfileSettings(state, {
    onPersonalData: handlers.onPersonalData,
    onPassword: handlers.onPassword,
    onConsents: handlers.onConsents,
    onLogout: handlers.onLogout,
  }));
}

async function renderMessages(root, state, handlers) {
  const messages = await loadMessages(state);
  const profileName = profileDisplayName(state);
  if (!state.accountChatOpen) {
    const last = messages[messages.length - 1];
    const lastLabel = last?.body ? String(last.body).split('\n')[0] : Array.isArray(last?.attachments) && last.attachments.length ? 'Медиа' : 'Открыть диалог';
    const body = listEntries([listEntry({
      title: profileName,
      subtitle: lastLabel,
      rightTop: last?.time || '',
      data: 'data-account-open-chat',
      aria: `Открыть диалог с ${profileName}`,
    })]);
    renderV2Shell(root, state, { header: v2Header({ b: 'Чат' }), body, deck: false, className: 'v2-app--chat-list' });
    initV2Swipe(root, {
      onRight: () => {
        state.accountChatOpen = false;
        if (state.accountChatReturn === 'booking' && handlers.onChatBack) {
          state.accountChatReturn = '';
          handlers.onChatBack();
          return;
        }
        state.accountTab = 'home';
        state.accountDeckOpen = true;
        state.accountDeckActive ||= 'representatives';
        void handlers.render();
      },
    });
    root.querySelector('[data-account-open-chat]')?.addEventListener('click', () => {
      state.accountChatOpen = true;
      void handlers.render();
    });
    return;
  }

  const header = v2Header({
    a: { kind: 'avatar', label: profileName, image: representativePhoto(state), data: 'data-account-chat-settings', aria: 'Настройки чата' },
    b: { label: profileName, data: 'data-account-chat-settings', aria: 'Настройки чата' },
    c: { kind: 'contacts', data: 'data-account-chat-contacts', aria: 'Контакты' },
    d: { kind: 'attachment', data: 'data-account-chat-attachment', aria: 'Вложения' },
  });
  const body = `${messages.length ? messageThread(messages, { viewer: 'account' }) : emptyState('Сообщений пока нет', 'Напишите первое сообщение.')}${messageComposer({ attachments: true, attachmentTrigger: 'external' })}`;
  renderV2Shell(root, state, { header, body, deck: true, className: 'v2-app--chat' });
  bindWorkspaceInteraction(root, state, handlers, {
    onZRight: () => {
      state.accountChatOpen = false;
      if (state.accountChatReturn === 'booking' && handlers.onChatBack) {
        state.accountChatReturn = '';
        handlers.onChatBack();
        return;
      }
      state.accountTab = 'home';
      state.accountDeckOpen = true;
      state.accountDeckActive ||= 'representatives';
      void handlers.render();
    },
  });
  root.querySelector('[data-account-chat-contacts]')?.addEventListener('click', () => {
    state.accountChatOpen = false;
    void handlers.render();
  });
  root.querySelectorAll('[data-account-chat-settings]').forEach((node) => node.addEventListener('click', () => void openChatSettings(state)));

  const form = root.querySelector('[data-message-composer]');
  root.querySelector('[data-account-chat-attachment]')?.addEventListener('click', () => form?.querySelector('[data-message-attachment]')?.click());
  const getAttachments = bindMessageAttachments(form);
  root.querySelectorAll('[data-message-id]').forEach((node) => {
    const message = messages.find((item) => String(item?.id || '') === String(node.dataset.messageId || ''));
    if (!message?.notificationId || !message.unread) return;
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-label', 'Открыть уведомление');
    const openNotification = async () => {
      if (!message.unread) return;
      try {
        await markAccountNotificationRead(state.tenantId, message.notificationId);
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
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = form.querySelector('[name="message"]');
    const messageBody = String(input?.value || '').trim();
    const attachments = getAttachments();
    if (!messageBody && !attachments.length) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await sendAccountChatMessage(state.tenantId, messageBody, attachments);
      await handlers.render();
    } catch (error) {
      if (submit) submit.disabled = false;
      openNotice({
        title: 'Сообщение не отправлено',
        message: accountErrorMessage(error, 'Не удалось отправить сообщение'),
        action: 'Закрыть',
        variant: 'technical',
      });
    }
  });
  requestAnimationFrame(() => {
    const screen = root.querySelector('[data-v2-z]');
    if (screen) screen.scrollTop = screen.scrollHeight;
  });
}


function relationshipTitle(relationship = {}) {
  const profile = relationship?.context?.profile || {};
  return [profile.name, profile.surname].filter(Boolean).join(' ').trim() || 'Профиль';
}

function relationshipCard(relationship = {}) {
  const profile = relationship?.context?.profile || {};
  const title = relationshipTitle(relationship);
  return entityCard({
    title,
    subtitle: String(profile.profession || '').trim(),
    image: String(profile.photo || ''),
    initial: title.slice(0, 1).toUpperCase(),
    interactive: true,
    data: `data-global-relationship="${escapeHtml(String(relationship.tenantId || ''))}"`,
    aria: `Открыть ${title}`,
    className: 'entity-card--compact',
  });
}

function globalRecordsForTenant(state, tenantId) {
  return (Array.isArray(state.accountRecords) ? state.accountRecords : [])
    .filter((request) => String(request?.tenantId || '') === String(tenantId || ''));
}

function bindGlobalProfileSettings(root, state, handlers) {
  root.querySelector('[data-account-profile-settings]')?.addEventListener('click', () => openProfileSettings(state, {
    onPersonalData: () => openAccountPersonalData(state, { onSaved: () => handlers.render?.() }),
    onPassword: () => openAccountPasswordSettings(state),
    onConsents: null,
    onLogout: handlers.onLogout,
  }));
}

function bindGlobalRelationships(root, state, handlers) {
  root.querySelectorAll('[data-global-relationship]').forEach((node) => node.addEventListener('click', () => {
    const tenantId = String(node.dataset.globalRelationship || '');
    if (tenantId) handlers.onOpenRelationship?.(tenantId);
  }));
}

async function renderGlobalHome(root, state, handlers) {
  const relationships = Array.isArray(state.relationships) ? state.relationships : [];
  const requests = futureRequests(state.accountRecords || []);
  const upcoming = requests.length
    ? v2HorizontalRail(requests.map((request, index) => visitCard(state, request, index)).join(''))
    : emptyState('Предстоящих визитов нет', 'Новые записи появятся здесь.');
  const representatives = relationships.length
    ? v2HorizontalRail(relationships.map(relationshipCard).join(''))
    : emptyState('Связей пока нет', 'Откройте ссылку нужного профиля, чтобы начать взаимодействие.');
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state), data: 'data-account-profile-settings', aria: 'Настройки профиля' },
    b: accountName(state),
  });
  renderV2Shell(root, state, {
    header,
    body: `${v2Section('Предстоящие визиты', upcoming)}${v2Section('Представители / пространства', representatives)}`,
  });
  bindWorkspaceInteraction(root, state, handlers);
  bindGlobalProfileSettings(root, state, handlers);
  bindGlobalRelationships(root, state, handlers);
  root.querySelectorAll('[data-account-upcoming]').forEach((node) => node.addEventListener('click', () => {
    const request = requests[Number(node.dataset.accountUpcoming)];
    if (request?.tenantId) handlers.onOpenRecord?.(request);
  }));
}

async function renderGlobalRepresentatives(root, state, handlers) {
  const relationships = Array.isArray(state.relationships) ? state.relationships : [];
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state), data: 'data-account-profile-settings', aria: 'Настройки профиля' },
    b: 'Представители',
  });
  renderV2Shell(root, state, {
    header,
    body: relationships.length
      ? relationships.map(relationshipCard).join('')
      : emptyState('Связей пока нет', 'Откройте ссылку нужного профиля, чтобы начать взаимодействие.'),
  });
  bindWorkspaceInteraction(root, state, handlers);
  bindGlobalProfileSettings(root, state, handlers);
  bindGlobalRelationships(root, state, handlers);
}

async function renderGlobalHistory(root, state, handlers) {
  const requests = (Array.isArray(state.accountRecords) ? state.accountRecords : [])
    .slice()
    .sort((a, b) => requestMoment(a).localeCompare(requestMoment(b)));
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state), data: 'data-account-profile-settings', aria: 'Настройки профиля' },
    b: 'История',
  });
  renderV2Shell(root, state, {
    header,
    body: requests.length
      ? listEntries(requests.map((request, index) => historyEntry(request, index)))
      : emptyState('История пока пустая', 'Здесь появятся ваши записи и визиты.'),
  });
  bindWorkspaceInteraction(root, state, handlers);
  bindGlobalProfileSettings(root, state, handlers);
  root.querySelectorAll('[data-account-history]').forEach((node) => node.addEventListener('click', () => {
    const request = requests[Number(node.dataset.accountHistory)];
    if (request?.tenantId) handlers.onOpenRecord?.(request);
  }));
}

export async function renderGlobalAccount(root, state, callbacks = {}) {
  state.globalAccount = true;
  state.accountTab ||= 'home';
  state.accountDeckOpen = Boolean(state.accountDeckOpen);
  state.accountDeckActive ||= state.accountTab === 'history' ? 'history' : 'representatives';

  const handlers = {
    render: () => renderGlobalAccount(root, state, callbacks),
    onOpenRelationship: callbacks.onOpenRelationship,
    onOpenRecord: callbacks.onOpenRecord,
    onLogout: callbacks.onLogout,
  };

  if (state.accountTab === 'history') return renderGlobalHistory(root, state, handlers);
  if (state.accountTab === 'representatives') return renderGlobalRepresentatives(root, state, handlers);
  return renderGlobalHome(root, state, handlers);
}

export async function renderAccount(root, state, callbacks = {}) {
  state.accountTab ||= 'home';
  state.accountDeckOpen = Boolean(state.accountDeckOpen);
  state.accountDeckActive ||= state.accountTab === 'history' ? 'history' : 'representatives';
  state.accountChatOpen = Boolean(state.accountChatOpen);
  try {
    const [records, account, notifications] = await Promise.all([
      getAccountRecords(state.tenantId).catch(() => []),
      getAccount(state.tenantId),
      getAccountNotifications(state.tenantId).catch(() => ({ unreadCount: 0 })),
    ]);
    state.accountRecords = Array.isArray(records) ? records : [];
    if (account) state.account = account;
    state.accountUnreadCount = Number(notifications?.unreadCount || 0);
    state.error = '';
  } catch (error) {
    const message = accountErrorMessage(error, 'Не удалось загрузить аккаунт');
    if (isAccountSystemError(error)) {
      state.error = '';
      openNotice({
        title: 'Аккаунт недоступен',
        message,
        action: 'Закрыть',
        variant: 'technical',
      });
    } else {
      state.error = message;
    }
  }

  const handlers = {
    render: () => renderAccount(root, state, callbacks),
    onStartBooking: callbacks.onStartBooking || (() => {}),
    onRepeat: callbacks.onRepeat || (() => {}),
    onChatBack: typeof callbacks.onChatBack === 'function' ? callbacks.onChatBack : null,
    onPersonalData: () => openAccountPersonalData(state, {
      onSaved: () => renderAccount(root, state, callbacks),
    }),
    onPassword: () => openAccountPasswordSettings(state),
    onConsents: () => openAccountConsentSettings(state, {
      onChanged: () => renderAccount(root, state, callbacks),
    }),
    onLogout: callbacks.onLogout || (() => {
      clearAccount(state.tenantId);
    }),
  };

  if (state.error) {
    renderV2Shell(root, state, {
      header: v2Header({ b: 'Профиль' }),
      body: emptyState('Аккаунт недоступен', state.error),
      deck: false,
    });
    return;
  }

  if (state.accountTab === 'messages') return renderMessages(root, state, handlers);
  if (state.accountTab === 'history-detail') return renderHistoryDetail(root, state, handlers);
  if (state.accountTab === 'history') return renderHistory(root, state, handlers);
  if (state.accountTab === 'representatives') return renderRepresentatives(root, state, handlers);
  if (state.accountTab === 'representative') return renderRepresentative(root, state, handlers);
  return renderHome(root, state, handlers);
}

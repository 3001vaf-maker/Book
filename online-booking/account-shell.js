import {
  clearBookingAccount,
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
  button,
  clientBottomNavigation,
  clientProfileCard,
  emptyState,
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
  const find = (pattern) => source.find((item) => pattern.test(String(item?.name || item?.title || '')));
  const deposit = find(/депозит/i);
  const personal = find(/личн.*сч[её]т/i);
  const valueOf = (item) => item ? String(item.value ?? item.balance ?? '') : '0 ₽';
  const fixed = [
    { label: 'Депозит', value: valueOf(deposit), source: deposit || { name: 'Депозит', value: '0 ₽' } },
    { label: 'Личный счёт', value: valueOf(personal), source: personal || { name: 'Личный счёт', value: '0 ₽' } },
  ];
  const rest = source.filter((item) => item !== deposit && item !== personal).map((item) => ({
    label: String(item?.name || item?.title || 'Программа'),
    value: String(item?.value ?? item?.balance ?? ''),
    source: item,
  }));
  return [...fixed, ...rest];
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
    action: procedures.length ? { label: 'Повторить процедуру', data: 'data-repeat-procedure' } : null,
  }), { variant: 'large', surface: 'app', title: 'Запись' }));
  layer?.querySelector('[data-repeat-procedure]')?.addEventListener('click', () => {
    layer.remove();
    onRepeat?.(request);
  });
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

function renderShell(root, state, { title, back = null, action = null, settings = null, body = '', primaryAction = '', className = '', media = null } = {}) {
  root.innerHTML = appShell({
    header: appHeader({ title, back, action, settings }),
    media: media === null ? mediaRail(mediaItems(state)) : media,
    body,
    primaryAction,
    bottomNavigation: clientBottomNavigation(state.clientTab || 'profile'),
    className,
  });
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
  };
  bind();
}

function openProfileSettings(state, { onPersonalData, onLogout }) {
  const layer = mountModal(document.body, modal(settingsPanel([
    { label: 'Личные данные', data: 'data-client-personal-data' },
    { label: 'Выход', data: 'data-client-logout', variant: 'danger' },
  ]), { variant: 'medium', surface: 'app', title: 'Настройки профиля' }));
  layer?.querySelector('[data-client-personal-data]')?.addEventListener('click', () => {
    layer.remove();
    onPersonalData?.();
  });
  layer?.querySelector('[data-client-logout]')?.addEventListener('click', () => {
    layer.remove();
    onLogout?.();
  });
}

async function renderProfile(root, state, handlers) {
  const requests = state.clientRequests || [];
  const account = state.account || {};
  const visit = nearestVisit(requests);
  const request = visit.request;
  const finance = aggregateFinance(requests, account);
  const rows = programRows(account);
  const card = clientProfileCard({
    workplace: request ? workplaceName(state, request) : '',
    visitLabel: visit.label,
    date: request ? formatDate(request.date) : '',
    time: request?.from || '',
    uei: account.uei || '',
    discount: Number(account.discountPercent || 0),
    name: [account.name, account.surname].filter(Boolean).join(' '),
    phone: formatPhone(account.phone || ''),
    financial: [
      { value: money(finance.subtotal), label: 'Стоимость' },
      { value: money(finance.discount), label: 'Скидка' },
      { value: money(finance.paid), label: 'Оплачено' },
    ],
    rows: rows.map((row, index) => ({ ...row, data: `data-client-program="${index}"` })),
  });
  renderShell(root, state, {
    title: 'Профиль',
    settings: { data: 'data-client-profile-settings', aria: 'Настройки профиля' },
    body: card,
    primaryAction: button('Записаться', { data: 'data-client-booking' }),
    className: 'app-view-shell--profile',
  });
  bindBottomNavigation(root, state, handlers);
  root.querySelector('[data-client-booking]')?.addEventListener('click', handlers.onStartBooking);
  root.querySelector('[data-client-profile-settings]')?.addEventListener('click', () => openProfileSettings(state, {
    onPersonalData: handlers.onPersonalData,
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

async function renderMessages(root, state, handlers) {
  const messages = await loadMessages(state);
  const master = masterName(state);
  if (!state.clientChatOpen) {
    const last = messages[messages.length - 1];
    const body = listEntries([listEntry({
      title: master,
      subtitle: last?.body ? String(last.body).split('\n')[0] : 'Открыть диалог',
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
    body: `${messages.length ? messageThread(messages, { viewer: 'client' }) : emptyState('Сообщений пока нет', 'Напишите мастеру первое сообщение.')}${messageComposer()}`,
  });
  bindBottomNavigation(root, state, handlers);
  root.querySelector('[data-client-chat-back]')?.addEventListener('click', () => {
    state.clientChatOpen = false;
    void handlers.render();
  });
  root.querySelector('[data-client-chat-booking]')?.addEventListener('click', handlers.onStartBooking);
  root.querySelector('[data-client-chat-settings]')?.addEventListener('click', () => void openChatSettings(state));
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
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = form.querySelector('[name="message"]');
    const body = String(input?.value || '').trim();
    if (!body) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await sendBookingChatMessage(state.tenantId, body);
      await handlers.render();
    } catch (error) {
      if (submit) submit.disabled = false;
      input?.setCustomValidity?.(error instanceof Error ? error.message : 'Не удалось отправить');
      input?.reportValidity?.();
      input?.setCustomValidity?.('');
    }
  });
  requestAnimationFrame(() => {
    const thread = root.querySelector('[data-message-thread]');
    thread?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  });
}

export async function renderClientAccount(root, state, callbacks = {}) {
  state.clientTab ||= 'profile';
  state.clientChatOpen = Boolean(state.clientChatOpen);
  try {
    const [requests, account] = await Promise.all([
      getBookingRequests(state.tenantId),
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
    onPersonalData: callbacks.onPersonalData || (() => {}),
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

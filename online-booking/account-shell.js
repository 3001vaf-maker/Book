import {
  accountErrorMessage,
  isAccountSystemError,
  getAccountChat,
  getAccountChatSettings,
  getAccountNotifications,
  getGlobalAccountRelationships,
  markAccountNotificationRead,
  sendAccountChatMessage,
} from '../core/account/index.js';
import { formatPhone } from '../core/phone/index.js';
import { projectRecordStatuses } from '../core/record/index.js';
import { disableWebPush, enableWebPush, getWebPushState } from '../core/notifications/web-push.js';
import {
  emptyState,
  entityCard,
  escapeHtml,
  field,
  listEntries,
  listEntry,
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
import { mountChatList, mountChatThread } from '../core/chat/runtime.js';
import { settingsPanel } from '../ui/settings/index.js';
import { readOnlyReceipt } from '../ui/receipt/index.js';
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

async function loadMessages(state, tenantId = state.tenantId) {
  const scopeTenantId = String(tenantId || '');
  const [messages, feed] = await Promise.all([
    getAccountChat(scopeTenantId).catch(() => []),
    getAccountNotifications(scopeTenantId).catch(() => ({ items: [], unreadCount: 0 })),
  ]);
  return [...(Array.isArray(messages) ? messages : []), ...notificationMessages(feed)]
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
    .map((item) => ({ ...item, time: messageTime(item.createdAt) }));
}

function accountName(state) {
  const account = state.account || {};
  return [account.name, account.surname].filter(Boolean).join(' ').trim() || 'Профиль';
}

function accountPhoto(state) {
  const profile = state.account?.profileData && typeof state.account.profileData === 'object' ? state.account.profileData : {};
  return String(profile.photo || '');
}

function futureRequests(requests = []) {
  const now = nowMoment();
  return (Array.isArray(requests) ? requests : [])
    .filter((request) => !isCancelled(request) && requestMoment(request) >= now)
    .sort((a, b) => requestMoment(a).localeCompare(requestMoment(b)));
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

const GLOBAL_ACCOUNT_ROOTS = Object.freeze([
  { id: 'profile', label: 'Профиль' },
  { id: 'home', label: 'Обзор' },
  { id: 'contacts', label: 'Контакты' },
  { id: 'history', label: 'История' },
]);

function accountRootForTab(state) {
  if (state.accountTab === 'profile' || state.accountTab === 'profile-settings') return 'profile';
  if (state.accountTab === 'contacts' || state.accountTab === 'contact-detail') return 'contacts';
  if (state.accountTab === 'history' || state.accountTab === 'history-detail') return 'history';
  return 'home';
}

function accountDeck(state) {
  const fallback = accountRootForTab(state);
  state.accountDeckActive ||= fallback;
  return v2FDeck(GLOBAL_ACCOUNT_ROOTS, { active: state.accountDeckActive, data: 'data-account-deck-item' });
}

function renderV2Shell(root, state, { header, body = '', deck = true, className = '' } = {}) {
  const shell = v2Shell({
    header,
    body,
    deck: deck ? accountDeck(state) : '',
    deckOpen: Boolean(state.accountDeckOpen && deck),
    className,
  });
  root.innerHTML = shell;
}

function setAccountDeckOpen(root, state, open) {
  state.accountDeckOpen = Boolean(open);
  setV2DeckOpen(root, state.accountDeckOpen);
}

function bindWorkspaceInteraction(root, state, handlers, { bindZ = true, onZRight = null, onZLeft = null } = {}) {
  return initV2WorkspaceInteraction(root, {
    activeId: state.accountDeckActive || accountRootForTab(state),
    deckOpen: state.accountDeckOpen,
    bindZ,
    onZRight,
    onZLeft,
    onDeckOpenChange: (open) => {
      state.accountDeckOpen = open;
    },
    onRootSelect: (id) => {
      const next = GLOBAL_ACCOUNT_ROOTS.some((item) => item.id === id) ? id : 'home';
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

function profileSummary(state) {
  const account = state.account || {};
  const profile = account.profileData && typeof account.profileData === 'object' ? account.profileData : {};
  return readOnlyReceipt({
    title: 'Личные данные',
    items: [
      { label: 'Имя', value: account.name || '—' },
      { label: 'Фамилия', value: account.surname || '—' },
      { label: 'Телефон', value: account.phone || '—' },
      { label: 'Email', value: account.email || '—' },
      { label: 'Telegram', value: profile.telegram || '—' },
      { label: 'Дата рождения', value: profile.birthDate ? formatDate(profile.birthDate) : '—' },
    ],
  });
}

function bindGlobalRelationships(root, state, handlers) {
  root.querySelectorAll('[data-global-relationship]').forEach((node) => node.addEventListener('click', () => {
    const tenantId = String(node.dataset.globalRelationship || '');
    if (!tenantId) return;
    state.accountSelectedContactTenantId = tenantId;
    state.accountTab = 'contact-detail';
    state.accountDeckActive = 'contacts';
    state.accountDeckOpen = false;
    void handlers.render();
  }));
}

function bindGlobalChatButton(root, state, handlers) {
  root.querySelector('[data-account-open-chat-root]')?.addEventListener('click', () => {
    state.accountTab = 'messages';
    state.accountDeckOpen = false;
    void handlers.render();
  });
}

function bindGlobalProfileSettingsEntry(root, state, handlers) {
  root.querySelector('[data-account-profile-settings]')?.addEventListener('click', () => {
    state.accountTab = 'profile-settings';
    state.accountDeckActive = 'profile';
    state.accountDeckOpen = false;
    void handlers.render();
  });
}

function openGlobalConsentSettingsByContact(state, handlers) {
  const relationships = Array.isArray(state.relationships) ? state.relationships : [];
  const content = relationships.length
    ? relationships.map((relationship, index) => {
        const profile = relationship?.context?.profile || {};
        const title = relationshipTitle(relationship);
        return entityCard({
          title,
          subtitle: 'Согласия',
          image: String(profile.photo || ''),
          initial: title.slice(0, 1).toUpperCase(),
          interactive: true,
          data: `data-account-consent-contact="${index}"`,
          aria: `Открыть согласия ${title}`,
          className: 'entity-card--compact',
        });
      }).join('')
    : emptyState('Контактов пока нет', 'Согласия появятся после связи с контактом.');
  const layer = mountModal(document.body, modal(content, { variant: 'large', title: 'Согласия' }));
  layer?.querySelectorAll('[data-account-consent-contact]').forEach((node) => node.addEventListener('click', () => {
    const relationship = relationships[Number(node.dataset.accountConsentContact)];
    const tenantId = String(relationship?.tenantId || '');
    if (!tenantId) return;
    layer.remove();
    void openAccountConsentSettings(state, {
      tenantId,
      onChanged: () => handlers.render?.(),
    });
  }));
}

async function renderGlobalMessages(root, state, handlers) {
  const relationships = Array.isArray(state.relationships) ? state.relationships : [];
  const selectedTenantId = String(state.accountSelectedChatTenantId || '');
  const selected = relationships.find((relationship) => String(relationship?.tenantId || '') === selectedTenantId) || null;

  const surface = ({ title, a, c, d, body }) => renderV2Shell(root, state, {
    header: v2Header({ a, b: title, c, d }),
    body,
    deck: false,
    className: selected ? 'v2-app--chat' : 'v2-app--chat-list',
  });

  if (!selected) {
    mountChatList(root, {
      title: 'Чат',
      threads: relationships,
      surface,
      onSettings: () => {
        state.accountTab = 'profile-settings';
        state.accountDeckActive = 'profile';
        void handlers.render();
      },
      onContacts: () => {
        state.accountTab = 'contacts';
        state.accountDeckActive = 'contacts';
        state.accountDeckOpen = false;
        void handlers.render();
      },
      onOpenThread: (relationship) => {
        state.accountSelectedChatTenantId = String(relationship?.tenantId || '');
        void handlers.render();
      },
      threadTitle: relationshipTitle,
      threadSubtitle: () => '',
      threadTime: () => '',
      emptyTitle: 'Диалогов пока нет',
      emptyText: 'После появления связи диалог будет доступен здесь.',
    });
    initV2Swipe(root, {
      onRight: () => {
        state.accountTab = 'home';
        state.accountDeckOpen = true;
        state.accountDeckActive = 'home';
        void handlers.render();
      },
    });
    return;
  }

  const messages = await loadMessages(state, selectedTenantId);
  mountChatThread(root, {
    title: relationshipTitle(selected),
    messages,
    viewer: 'account',
    surface,
    onSettings: () => void openChatSettings({ ...state, tenantId: selectedTenantId }),
    onContacts: () => {
      state.accountSelectedChatTenantId = '';
      void handlers.render();
    },
    onSend: async ({ body, attachments }) => {
      await sendAccountChatMessage(selectedTenantId, body, attachments);
      await handlers.render();
    },
    sendErrorMessage: 'Не удалось отправить сообщение',
    onMessageOpen: ({ node, message }) => {
      if (!message?.notificationId || !message.unread) return;
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', 'Открыть уведомление');
      const openNotification = async () => {
        if (!message.unread) return;
        try {
          await markAccountNotificationRead(selectedTenantId, message.notificationId);
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
    },
  });
  initV2Swipe(root, {
    onRight: () => {
      state.accountSelectedChatTenantId = '';
      void handlers.render();
    },
  });
}

async function renderGlobalProfile(root, state, handlers) {
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state), data: 'data-account-profile-settings', aria: 'Настройки профиля' },
    b: accountName(state),
    d: { kind: 'chat', data: 'data-account-open-chat-root', aria: 'Чат' },
  });
  renderV2Shell(root, state, {
    header,
    body: profileSummary(state),
  });
  bindWorkspaceInteraction(root, state, handlers);
  bindGlobalProfileSettingsEntry(root, state, handlers);
  bindGlobalChatButton(root, state, handlers);
}

async function renderGlobalProfileSettings(root, state, handlers) {
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state), disabled: true },
    b: 'Настройки профиля',
    d: { kind: 'chat', data: 'data-account-open-chat-root', aria: 'Чат' },
  });
  renderV2Shell(root, state, {
    header,
    body: settingsPanel([
      { label: 'Личные данные', data: 'data-account-personal-data' },
      { label: 'Изменить пароль', data: 'data-account-change-password' },
      { label: 'Согласия', data: 'data-account-consents' },
      { label: 'Выход', data: 'data-account-logout', variant: 'danger' },
    ]),
  });
  bindWorkspaceInteraction(root, state, handlers, {
    onZRight: () => {
      state.accountTab = 'profile';
      state.accountDeckActive = 'profile';
      void handlers.render();
    },
  });
  bindGlobalChatButton(root, state, handlers);
  root.querySelector('[data-account-personal-data]')?.addEventListener('click', () => openAccountPersonalData(state, {
    onSaved: () => handlers.render?.(),
  }));
  root.querySelector('[data-account-change-password]')?.addEventListener('click', () => openAccountPasswordSettings(state));
  root.querySelector('[data-account-consents]')?.addEventListener('click', () => openGlobalConsentSettingsByContact(state, handlers));
  root.querySelector('[data-account-logout]')?.addEventListener('click', () => handlers.onLogout?.());
}

async function renderGlobalHome(root, state, handlers) {
  const requests = futureRequests(state.accountRecords || []);
  const upcoming = requests.length
    ? v2HorizontalRail(requests.map((request, index) => visitCard(state, request, index)).join(''))
    : emptyState('Предстоящих визитов нет', 'Новые записи появятся здесь.');
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state), data: 'data-account-profile-settings', aria: 'Настройки профиля' },
    b: 'Обзор',
    d: { kind: 'chat', data: 'data-account-open-chat-root', aria: 'Чат' },
  });
  renderV2Shell(root, state, {
    header,
    body: v2Section('Предстоящие визиты', upcoming),
  });
  bindWorkspaceInteraction(root, state, handlers);
  bindGlobalProfileSettingsEntry(root, state, handlers);
  bindGlobalChatButton(root, state, handlers);
  root.querySelectorAll('[data-account-upcoming]').forEach((node) => node.addEventListener('click', () => {
    const request = requests[Number(node.dataset.accountUpcoming)];
    if (!request) return;
    selectHistoryRequest(state, request, 'home');
    state.accountDeckActive = 'history';
    void handlers.render();
  }));
}

function contactsBody(relationships = [], query = '') {
  const needle = String(query || '').trim().toLocaleLowerCase('ru');
  const filtered = needle
    ? relationships.filter((relationship) => relationshipTitle(relationship).toLocaleLowerCase('ru').includes(needle))
    : relationships;
  if (!filtered.length) {
    return emptyState(needle ? 'Ничего не найдено' : 'Контактов пока нет', needle ? 'Измени запрос поиска.' : 'Новые контакты появятся здесь.');
  }
  if (relationships.length <= 15) return v2HorizontalRail(filtered.map(relationshipCard).join(''));
  return listEntries(filtered.map((relationship) => {
    const profile = relationship?.context?.profile || {};
    const title = relationshipTitle(relationship);
    return listEntry({
      title,
      subtitle: String(profile.profession || '').trim(),
      data: `data-global-relationship="${escapeHtml(String(relationship.tenantId || ''))}"`,
      aria: `Открыть ${title}`,
    });
  }));
}

async function renderGlobalContacts(root, state, handlers) {
  const relationships = Array.isArray(state.relationships) ? state.relationships : [];
  const searchable = relationships.length > 15;
  const header = v2Header({
    a: { kind: 'settings', label: 'Настройки', disabled: true, aria: 'Настройки контактов' },
    b: 'Контакты',
    d: { kind: 'chat', data: 'data-account-open-chat-root', aria: 'Чат' },
  });
  renderV2Shell(root, state, {
    header,
    body: `${searchable ? field({ name: 'accountContactSearch', type: 'search', placeholder: 'Поиск', autocomplete: 'off', data: 'data-account-contact-search' }) : ''}<div data-account-contact-list>${contactsBody(relationships)}</div>`,
  });
  bindWorkspaceInteraction(root, state, handlers);
  bindGlobalRelationships(root, state, handlers);
  bindGlobalChatButton(root, state, handlers);
  const search = root.querySelector('[data-account-contact-search]');
  search?.addEventListener('input', () => {
    const host = root.querySelector('[data-account-contact-list]');
    if (!host) return;
    host.innerHTML = contactsBody(relationships, search.value);
    bindGlobalRelationships(root, state, handlers);
  });
}

function selectedGlobalRelationship(state) {
  const tenantId = String(state.accountSelectedContactTenantId || '');
  return (Array.isArray(state.relationships) ? state.relationships : [])
    .find((relationship) => String(relationship?.tenantId || '') === tenantId) || null;
}

function globalContactRecords(state, tenantId) {
  return (Array.isArray(state.accountRecords) ? state.accountRecords : [])
    .filter((request) => String(request?.tenantId || '') === String(tenantId || ''));
}

async function renderGlobalContactDetail(root, state, handlers) {
  const relationship = selectedGlobalRelationship(state);
  if (!relationship) {
    state.accountTab = 'contacts';
    state.accountDeckActive = 'contacts';
    await handlers.render();
    return;
  }

  const tenantId = String(relationship.tenantId || '');
  const profile = relationship?.context?.profile || {};
  const title = relationshipTitle(relationship);
  const records = globalContactRecords(state, tenantId);
  const requests = futureRequests(records);
  const hasInteractionHistory = records.some((request) => !isCancelled(request) && requestMoment(request) < nowMoment());

  const upcoming = requests.length
    ? v2HorizontalRail(requests.map((request, index) => visitCard(state, request, index)).join(''))
    : '';
  const activity = hasInteractionHistory
    ? v2HorizontalRail([
        v2RailCard({ title: String(records.length), subtitle: 'Действия' }),
      ].join(''))
    : '';

  const header = v2Header({
    a: { kind: 'avatar', label: title, image: String(profile.photo || ''), data: 'data-global-contact-settings', aria: 'Настройки' },
    b: title,
    c: { kind: 'text', label: 'Записаться', data: 'data-global-contact-booking', aria: 'Записаться' },
    d: { kind: 'chat', data: 'data-global-contact-chat', aria: 'Чат' },
  });

  renderV2Shell(root, state, {
    header,
    body: `${activity ? v2Section('Взаимодействие', activity) : ''}${upcoming ? v2Section('Предстоящие визиты', upcoming) : ''}`,
  });

  bindWorkspaceInteraction(root, state, handlers, {
    onZRight: () => {
      state.accountTab = 'contacts';
      state.accountDeckActive = 'contacts';
      state.accountSelectedContactTenantId = '';
      void handlers.render();
    },
  });

  root.querySelector('[data-global-contact-settings]')?.addEventListener('click', () => {
    const layer = mountModal(document.body, modal(settingsPanel([
      { label: 'Согласия', data: 'data-global-contact-consents' },
    ]), { variant: 'large', title: 'Настройки' }));
    layer?.querySelector('[data-global-contact-consents]')?.addEventListener('click', () => {
      layer.remove();
      void openAccountConsentSettings(state, { tenantId });
    });
  });

  root.querySelector('[data-global-contact-booking]')?.addEventListener('click', () => handlers.onStartBooking?.(tenantId));
  root.querySelector('[data-global-contact-chat]')?.addEventListener('click', () => handlers.onOpenChat?.(tenantId));

  root.querySelectorAll('[data-account-upcoming]').forEach((node) => node.addEventListener('click', () => {
    const request = requests[Number(node.dataset.accountUpcoming)];
    if (!request) return;
    selectHistoryRequest(state, request, 'contact-detail');
    state.accountDeckActive = 'history';
    void handlers.render();
  }));
}

async function renderGlobalHistory(root, state, handlers) {
  const requests = (Array.isArray(state.accountRecords) ? state.accountRecords : [])
    .slice()
    .sort((a, b) => requestMoment(a).localeCompare(requestMoment(b)));
  const header = v2Header({
    a: { kind: 'avatar', label: accountName(state), image: accountPhoto(state), disabled: true },
    b: 'История',
    d: { kind: 'chat', data: 'data-account-open-chat-root', aria: 'Чат' },
  });
  renderV2Shell(root, state, {
    header,
    body: requests.length
      ? listEntries(requests.map((request, index) => historyEntry(request, index)))
      : emptyState('История пока пустая', 'Здесь появятся ваши записи и визиты.'),
  });
  bindWorkspaceInteraction(root, state, handlers);
  bindGlobalChatButton(root, state, handlers);
  root.querySelectorAll('[data-account-history]').forEach((node) => node.addEventListener('click', () => {
    const request = requests[Number(node.dataset.accountHistory)];
    if (!request) return;
    selectHistoryRequest(state, request, 'history');
    state.accountDeckActive = 'history';
    void handlers.render();
  }));
}

async function renderGlobalHistoryDetail(root, state, handlers) {
  const request = currentHistoryRequest(state);
  if (!request) {
    state.accountTab = state.accountHistoryReturn === 'contact-detail' ? 'contact-detail' : (state.accountHistoryReturn === 'home' ? 'home' : 'history');
    state.accountDeckActive = accountRootForTab(state);
    await handlers.render();
    return;
  }

  const tenantId = String(request?.tenantId || '');
  const relationship = (Array.isArray(state.relationships) ? state.relationships : [])
    .find((item) => String(item?.tenantId || '') === tenantId);
  const title = relationshipTitle(relationship || {});
  const profile = relationship?.context?.profile || {};
  const canRepeat = requestProcedures(request).length > 0;

  const header = v2Header({
    a: { kind: 'avatar', label: title, image: String(profile.photo || ''), data: 'data-global-history-contact-settings', aria: 'Настройки' },
    b: workplaceName(state, request),
    c: canRepeat ? { kind: 'text', label: 'Записаться', data: 'data-global-history-repeat', aria: 'Записаться снова' } : null,
    d: { kind: 'chat', data: 'data-global-history-chat', aria: 'Чат' },
  });

  renderV2Shell(root, state, { header, body: historyDetailBody(state, request) });

  bindWorkspaceInteraction(root, state, handlers, {
    onZRight: () => {
      const returnTab = state.accountHistoryReturn || 'history';
      state.accountTab = returnTab;
      state.accountDeckActive = accountRootForTab(state);
      state.accountHistoryRequestId = '';
      state.accountHistoryRequestMoment = '';
      void handlers.render();
    },
  });

  root.querySelector('[data-global-history-contact-settings]')?.addEventListener('click', () => {
    if (!tenantId) return;
    const layer = mountModal(document.body, modal(settingsPanel([
      { label: 'Согласия', data: 'data-global-history-consents' },
    ]), { variant: 'large', title: 'Настройки' }));
    layer?.querySelector('[data-global-history-consents]')?.addEventListener('click', () => {
      layer.remove();
      void openAccountConsentSettings(state, { tenantId });
    });
  });
  root.querySelector('[data-global-history-repeat]')?.addEventListener('click', () => handlers.onStartBooking?.(tenantId, request));
  root.querySelector('[data-global-history-chat]')?.addEventListener('click', () => handlers.onOpenChat?.(tenantId));
}

export async function renderGlobalAccount(root, state, callbacks = {}) {
  state.globalAccount = true;
  state.accountTab ||= 'home';
  state.accountDeckOpen = Boolean(state.accountDeckOpen);
  state.accountDeckActive ||= accountRootForTab(state);

  const handlers = {
    render: () => renderGlobalAccount(root, state, callbacks),
    onOpenChat: callbacks.onOpenChat,
    onStartBooking: callbacks.onStartBooking,
    onLogout: callbacks.onLogout,
  };

  if (state.accountTab === 'messages') return renderGlobalMessages(root, state, handlers);
  if (state.accountTab === 'profile-settings') return renderGlobalProfileSettings(root, state, handlers);
  if (state.accountTab === 'profile') return renderGlobalProfile(root, state, handlers);
  if (state.accountTab === 'contact-detail') return renderGlobalContactDetail(root, state, handlers);
  if (state.accountTab === 'contacts') return renderGlobalContacts(root, state, handlers);
  if (state.accountTab === 'history-detail') return renderGlobalHistoryDetail(root, state, handlers);
  if (state.accountTab === 'history') return renderGlobalHistory(root, state, handlers);
  return renderGlobalHome(root, state, handlers);
}

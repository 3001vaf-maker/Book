import { USER_ORIGIN } from '../environment.js';
import {
  endUserChatActions,
  ensureProfessionalChatThread,
  getEndUserChatConversations,
  getEndUserChatThread,
  getEndUserChatThreads,
  getProfessionalChatThread,
  getProfessionalChatThreads,
  professionalChatActions,
  sendEndUserChatMessage,
  sendProfessionalChatMessage,
} from './internal-chat.js';
import { openMessengerMessageActions } from './message-actions.js';
import { findPeopleByPhone, getAllPeople } from '../people/data.js';
import {
  button,
  field,
  modal,
  mountModal,
  mountV2ZLayer,
  openNotice,
  v2Header,
  v2ListEntries,
  v2ListEntry,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../ui/ui.js';
import { mountChatList, mountChatThread } from './runtime.js';

const USER_HOST = new URL(USER_ORIGIN).hostname;
const ROOT_CLASS = 'messenger-mode-z';
const THREAD_CLASS = 'messenger-thread-z';
let activeMode = null;

function isEndUserRuntime() {
  return String(globalThis.location?.hostname || '').toLowerCase() === USER_HOST;
}

function profileTitle(relationship = {}) {
  const profile = relationship?.context?.profile || {};
  return [profile.name, profile.surname].filter(Boolean).join(' ').trim() || 'Профиль';
}

function professionalThreadTitle(thread = {}) {
  if (String(thread?.type || '').toUpperCase() === 'GROUP') return String(thread?.title || '').trim() || 'Группа';
  const phone = String(thread?.personPhone || '').trim();
  const uei = String(thread?.uei || '').trim();
  if (phone) {
    const people = findPeopleByPhone(phone);
    const person = people.find((item) => !uei || String(item?.uei || '') === uei) || people[0];
    const name = [person?.name, person?.surname].filter(Boolean).join(' ').trim();
    if (name) return name;
  }
  if (uei) {
    const person = getAllPeople().find((item) => String(item?.uei || '') === uei);
    const name = [person?.name, person?.surname].filter(Boolean).join(' ').trim();
    if (name) return name;
  }
  return String(thread?.display || thread?.title || '').trim() || 'Человек';
}

function endUserThreadTitle(thread = {}) {
  if (String(thread?.type || '').toUpperCase() === 'GROUP') return String(thread?.title || '').trim() || 'Группа';
  return profileTitle(thread?.relationship || {});
}

function messageTime(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function parseHeader(markup) {
  const template = document.createElement('template');
  template.innerHTML = String(markup || '').trim();
  return template.content.firstElementChild || null;
}

function currentHeader(app) {
  return app?.querySelector?.(':scope > [data-v2-header]') || app?.querySelector?.('[data-v2-header]') || null;
}

function replaceHeader(app, config, layer, { onModeSwitch = null } = {}) {
  const current = currentHeader(app);
  if (!current) return;
  const next = parseHeader(v2Header({ a: config.a, b: config.title, c: config.c, d: config.d }));
  if (!next) return;
  current.replaceWith(next);

  next.querySelector('.v2-header__slot--a button')?.addEventListener('click', () => layer.querySelector('[data-chat-settings]')?.click());
  next.querySelector('.v2-header__slot--c button')?.addEventListener('click', () => layer.querySelector('[data-chat-contacts]')?.click());
  next.querySelector('.v2-header__slot--d button')?.addEventListener('click', () => {
    if (config.d?.kind === 'mode') {
      onModeSwitch?.();
      return;
    }
    if (config.d?.kind === 'attachment') layer.querySelector('[data-chat-attachment]')?.click();
  });
}

function surfaceOwner(app, layer, onModeSwitch) {
  return ({ title = 'Чат', a = null, c = null, d = null, body = '' }) => {
    layer.innerHTML = `${workspaceHeaderContext({ title, a, c, d })}${body}`;
    replaceHeader(app, { title, a, c, d }, layer, { onModeSwitch });
  };
}

function restoreOriginalHeader(mode) {
  const current = currentHeader(mode.app);
  if (current && mode.originalHeader) current.replaceWith(mode.originalHeader);
}

function closeMode(mode) {
  if (!mode || activeMode !== mode) return;
  [...mode.app.querySelectorAll(`.${THREAD_CLASS}`)].forEach((layer) => layer.v2Dispose?.());
  mode.root?.v2Dispose?.();
  restoreOriginalHeader(mode);
  activeMode = null;
}

function renderRootHeader(mode) {
  replaceHeader(mode.app, {
    title: 'Чат',
    a: null,
    c: null,
    d: { kind: 'mode', aria: 'Вернуться в приложение' },
  }, mode.root, { onModeSwitch: () => closeMode(mode) });
}

function threadLayer(mode) {
  return mountV2ZLayer(
    mode.root,
    v2ZLayer('', { className: THREAD_CLASS }),
    {
      stack: true,
      onClose: () => renderRootHeader(mode),
    },
  );
}

function scrollToMessage(root, messageId) {
  const target = [...root.querySelectorAll('[data-message-id]')]
    .find((node) => String(node.dataset.messageId || '') === String(messageId || ''));
  target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

function openThreadSearch({ root, actions, conversationId }) {
  const content = `<form data-messenger-search-form>${field({
    label: 'Поиск',
    name: 'query',
    placeholder: 'Текст сообщения',
    autocomplete: 'off',
  })}${button('Найти')}</form><div data-messenger-search-results></div>`;
  const layer = mountModal(document.body, modal(content, {
    title: 'Поиск в чате',
    variant: 'x',
    surface: 'app',
    xRole: 'action',
  }));
  const form = layer?.querySelector('[data-messenger-search-form]');
  const resultsHost = layer?.querySelector('[data-messenger-search-results]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = String(new FormData(form).get('query') || '').trim();
    if (!query || !resultsHost) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const results = await actions.search({ query, conversationId });
      const values = Array.isArray(results) ? results : [];
      resultsHost.innerHTML = values.length
        ? v2ListEntries(values.map((message, index) => v2ListEntry({
          title: String(message?.body || 'Сообщение').slice(0, 120),
          subtitle: message?.createdAt ? new Date(message.createdAt).toLocaleString('ru-RU') : '',
          data: `data-messenger-search-result="${index}"`,
          aria: 'Перейти к сообщению',
        })))
        : '<p>Ничего не найдено.</p>';
      resultsHost.querySelectorAll('[data-messenger-search-result]').forEach((node) => node.addEventListener('click', () => {
        const message = values[Number(node.dataset.messengerSearchResult)];
        layer?.v2Close?.();
        scrollToMessage(root, message?.id);
      }));
    } catch (error) {
      openNotice({ title: 'Поиск недоступен', message: error instanceof Error ? error.message : 'Не удалось выполнить поиск', variant: 'technical' });
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}

function openThreadMenu({ root, actions, conversationId }) {
  const layer = mountModal(document.body, modal(v2ListEntries([
    v2ListEntry({ title: 'Поиск', data: 'data-messenger-thread-search', aria: 'Поиск в чате' }),
  ]), {
    title: 'Чат',
    variant: 'x',
    surface: 'app',
    xRole: 'action',
  }));
  layer?.querySelector('[data-messenger-thread-search]')?.addEventListener('click', () => {
    layer?.v2Close?.();
    openThreadSearch({ root, actions, conversationId });
  });
}

async function openEndUserThread(mode, thread) {
  const tenantId = String(thread?.tenantId || thread?.relationship?.tenantId || '').trim();
  const conversationId = String(thread?.id || '').trim();
  if (!tenantId || !conversationId) return;
  const layer = threadLayer(mode);
  if (!layer) return;
  const title = endUserThreadTitle(thread);
  const surface = surfaceOwner(mode.app, layer, null);
  const actions = endUserChatActions(tenantId);

  const render = async () => {
    const messages = await getEndUserChatThread(tenantId, conversationId);
    if (!layer.isConnected) return;
    mountChatThread(layer, {
      title,
      messages,
      viewer: 'account',
      surface,
      onSettings: () => openThreadMenu({ root: layer, actions, conversationId }),
      onSend: async ({ body, attachments, replyToId }) => {
        await sendEndUserChatMessage(tenantId, body, attachments, { conversationId, replyToId });
        await render();
      },
      onMessageOpen: ({ message, setReply }) => openMessengerMessageActions({
        message,
        viewer: 'account',
        actions,
        render,
        setReply,
        getConversations: () => getEndUserChatConversations(tenantId),
        threadTitle: (conversation) => String(conversation?.type || '').toUpperCase() === 'GROUP'
          ? String(conversation?.title || 'Группа')
          : profileTitle(thread?.relationship || {}),
      }),
      onPollVote: async ({ message, optionId }) => {
        await actions.vote(message.id, optionId);
        await render();
      },
      sendErrorMessage: 'Не удалось отправить сообщение',
    });
  };

  try {
    await render();
  } catch (error) {
    layer.v2Close?.();
    openNotice({ title: 'Чат недоступен', message: error instanceof Error ? error.message : 'Не удалось открыть чат', variant: 'technical' });
  }
}

async function renderEndUserRoot(mode) {
  try {
    const relationships = await getEndUserChatThreads();
    const batches = await Promise.all((Array.isArray(relationships) ? relationships : []).map(async (relationship) => {
      const tenantId = String(relationship?.tenantId || '').trim();
      if (!tenantId) return [];
      try {
        const conversations = await getEndUserChatConversations(tenantId);
        return (Array.isArray(conversations) ? conversations : []).map((conversation) => ({
          ...conversation,
          tenantId,
          relationship,
        }));
      } catch {
        return [];
      }
    }));
    const threads = batches.flat().sort((a, b) => new Date(b?.lastMessageAt || b?.updatedAt || 0).getTime() - new Date(a?.lastMessageAt || a?.updatedAt || 0).getTime());
    const surface = surfaceOwner(mode.app, mode.root, () => closeMode(mode));
    mountChatList(mode.root, {
      title: 'Чат',
      threads,
      surface,
      onModeSwitch: () => closeMode(mode),
      onOpenThread: (thread) => void openEndUserThread(mode, thread),
      threadTitle: endUserThreadTitle,
      threadSubtitle: (thread) => String(thread?.body || ''),
      threadTime: (thread) => messageTime(thread?.lastMessageAt || thread?.updatedAt),
      emptyTitle: 'Диалогов пока нет',
      emptyText: 'Диалоги появятся после добавления контактов.',
    });
    mode.renderRootHeader = () => renderRootHeader(mode);
  } catch (error) {
    closeMode(mode);
    openNotice({ title: 'Messenger недоступен', message: error instanceof Error ? error.message : 'Не удалось открыть Messenger', variant: 'technical' });
  }
}

async function openProfessionalThread(mode, thread) {
  let conversation;
  try {
    conversation = await ensureProfessionalChatThread({
      ...thread,
      conversationId: thread?.id || thread?.conversationId || '',
    });
  } catch (error) {
    openNotice({ title: 'Чат недоступен', message: error instanceof Error ? error.message : 'Не удалось открыть чат', variant: 'technical' });
    return;
  }
  const layer = threadLayer(mode);
  if (!layer) return;
  const phone = String(conversation?.personPhone || thread?.personPhone || '').trim();
  const uei = String(conversation?.uei || thread?.uei || '').trim();
  const conversationId = String(conversation?.id || '').trim();
  const title = professionalThreadTitle({ ...thread, ...conversation });
  const surface = surfaceOwner(mode.app, layer, null);

  const render = async () => {
    const messages = await getProfessionalChatThread({ conversationId, phone, uei });
    if (!layer.isConnected) return;
    mountChatThread(layer, {
      title,
      messages,
      viewer: 'profile',
      surface,
      onSettings: () => openThreadMenu({ root: layer, actions: professionalChatActions, conversationId }),
      onSend: async ({ body, attachments, replyToId }) => {
        await sendProfessionalChatMessage({ conversationId, phone, uei, body, attachments, replyToId });
        await render();
      },
      onMessageOpen: ({ message, setReply }) => openMessengerMessageActions({
        message,
        viewer: 'profile',
        actions: professionalChatActions,
        render,
        setReply,
        getConversations: getProfessionalChatThreads,
        threadTitle: professionalThreadTitle,
      }),
      onPollVote: async ({ message, optionId }) => {
        await professionalChatActions.vote(message.id, optionId);
        await render();
      },
      sendErrorMessage: 'Не удалось отправить сообщение',
    });
  };

  try {
    await render();
  } catch (error) {
    layer.v2Close?.();
    openNotice({ title: 'Чат недоступен', message: error instanceof Error ? error.message : 'Не удалось открыть чат', variant: 'technical' });
  }
}

async function renderProfessionalRoot(mode, initialPersonKey = '') {
  try {
    const threads = await getProfessionalChatThreads();
    const surface = surfaceOwner(mode.app, mode.root, () => closeMode(mode));
    mountChatList(mode.root, {
      title: 'Чат',
      threads,
      surface,
      onModeSwitch: () => closeMode(mode),
      onOpenThread: (thread) => void openProfessionalThread(mode, thread),
      threadTitle: professionalThreadTitle,
      threadSubtitle: (thread) => thread.body || '',
      threadTime: (thread) => messageTime(thread.lastMessageAt || thread.updatedAt || thread.createdAt),
      emptyTitle: 'Чат пока пуст',
      emptyText: 'Диалоги появятся здесь.',
    });
    mode.renderRootHeader = () => renderRootHeader(mode);

    if (initialPersonKey) {
      const person = getAllPeople().find((item) => String(item?.key || '') === String(initialPersonKey));
      const phone = String((Array.isArray(person?.phones) ? person.phones : []).find(Boolean) || '');
      if (phone || person?.uei) await openProfessionalThread(mode, { personPhone: phone, uei: String(person?.uei || '') });
    }
  } catch (error) {
    closeMode(mode);
    openNotice({ title: 'Messenger недоступен', message: error instanceof Error ? error.message : 'Не удалось открыть Messenger', variant: 'technical' });
  }
}

export function openMessengerMode({ personKey = '' } = {}) {
  if (activeMode?.root?.isConnected) return activeMode;
  const app = document.querySelector('[data-v2-app]');
  if (!app) return null;
  const originalHeader = currentHeader(app);
  const root = mountV2ZLayer(
    app,
    v2ZLayer('', { className: ROOT_CLASS, dismissible: false }),
    { stack: true, dismissible: false },
  );
  if (!root) return null;
  const mode = { app, root, originalHeader, renderRootHeader: null };
  activeMode = mode;
  if (isEndUserRuntime()) void renderEndUserRoot(mode);
  else void renderProfessionalRoot(mode, personKey);
  return mode;
}

export function closeMessengerMode() {
  closeMode(activeMode);
}

function isMessengerEntryButton(node) {
  return Boolean(node?.matches?.('.v2-header__control--chat'));
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-v2-header] .v2-header__slot--d button');
    if (!button || !isMessengerEntryButton(button) || activeMode?.root?.isConnected) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMessengerMode();
  }, true);
}

if (typeof window !== 'undefined') {
  window.addEventListener('book:record-chat-request', (event) => {
    const personKey = String(event?.detail?.personKey || '').trim();
    const personKeys = Array.isArray(event?.detail?.personKeys) ? event.detail.personKeys.filter(Boolean) : [];
    if (!personKey || personKeys.length > 1) return;
    event.stopImmediatePropagation();
    openMessengerMode({ personKey });
  }, { capture: true });
}

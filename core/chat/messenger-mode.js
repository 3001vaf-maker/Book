import { USER_ORIGIN } from '../environment.js';
import {
  getAccountChat,
  getGlobalAccountRelationships,
  sendAccountChatMessage,
} from '../account/index.js';
import {
  getCommunicationChannels,
  getCommunicationThread,
  getCommunicationThreads,
  sendCommunicationMessage,
} from '../communications/chat.js';
import { findPeopleByPhone, getAllPeople } from '../people/data.js';
import {
  mountV2ZLayer,
  openNotice,
  v2Header,
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
  return String(thread?.display || '').trim() || 'Человек';
}

function messageTime(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function channelValue(value) {
  const channel = String(value || '').trim().toUpperCase();
  if (channel === 'IN_APP' || channel === 'PUSH' || channel === 'CHAT') return 'PUSH';
  if (channel === 'TELEGRAM' || channel === 'EMAIL') return channel;
  return channel;
}

function professionalChannelOptions(channels = []) {
  const available = new Set((Array.isArray(channels) ? channels : []).map(channelValue).filter(Boolean));
  available.add('PUSH');
  return [
    { value: 'ALL', label: 'Общий' },
    { value: 'PUSH', label: 'Чат' },
    ...(available.has('TELEGRAM') ? [{ value: 'TELEGRAM', label: 'Telegram' }] : []),
    ...(available.has('EMAIL') ? [{ value: 'EMAIL', label: 'Email' }] : []),
  ];
}

function filteredMessages(messages = [], filter = 'ALL') {
  if (filter === 'ALL') return Array.isArray(messages) ? messages : [];
  return (Array.isArray(messages) ? messages : []).filter((message) => channelValue(message?.channel) === filter);
}

function parseHeader(markup) {
  const template = document.createElement('template');
  template.innerHTML = String(markup || '').trim();
  return template.content.firstElementChild || null;
}

function replaceHeader(app, config, layer, { onModeSwitch = null } = {}) {
  const current = app?.querySelector?.(':scope > [data-v2-header]') || app?.querySelector?.('[data-v2-header]');
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
  const current = mode.app?.querySelector?.(':scope > [data-v2-header]') || mode.app?.querySelector?.('[data-v2-header]');
  if (current && mode.originalHeader) current.replaceWith(mode.originalHeader);
}

function closeMode(mode) {
  if (!mode || activeMode !== mode) return;
  [...mode.app.querySelectorAll(`.${THREAD_CLASS}`)].forEach((layer) => layer.v2Dispose?.());
  mode.root?.v2Dispose?.();
  restoreOriginalHeader(mode);
  activeMode = null;
}

function threadLayer(mode) {
  const layer = mountV2ZLayer(
    mode.root,
    v2ZLayer('', { className: THREAD_CLASS }),
    {
      stack: true,
      onClose: () => {
        mode.renderRootHeader?.();
      },
    },
  );
  return layer;
}

async function openEndUserThread(mode, relationship) {
  const tenantId = String(relationship?.tenantId || '').trim();
  if (!tenantId) return;
  const layer = threadLayer(mode);
  if (!layer) return;
  const surface = surfaceOwner(mode.app, layer, null);
  surface({ title: profileTitle(relationship), d: { kind: 'attachment' }, body: '' });
  try {
    const messages = await getAccountChat(tenantId);
    mountChatThread(layer, {
      title: profileTitle(relationship),
      messages,
      viewer: 'account',
      surface,
      onSend: async ({ body, attachments }) => {
        await sendAccountChatMessage(tenantId, body, attachments);
        if (!layer.isConnected) return;
        const refreshed = await getAccountChat(tenantId);
        mountChatThread(layer, {
          title: profileTitle(relationship),
          messages: refreshed,
          viewer: 'account',
          surface,
          onSend: async ({ body: nextBody, attachments: nextAttachments }) => {
            await sendAccountChatMessage(tenantId, nextBody, nextAttachments);
            layer.v2Close?.();
            void openEndUserThread(mode, relationship);
          },
        });
      },
    });
  } catch (error) {
    layer.v2Close?.();
    openNotice({ title: 'Чат недоступен', message: error instanceof Error ? error.message : 'Не удалось открыть чат', variant: 'technical' });
  }
}

async function renderEndUserRoot(mode) {
  try {
    const relationships = await getGlobalAccountRelationships();
    const surface = surfaceOwner(mode.app, mode.root, () => closeMode(mode));
    mode.renderRootHeader = () => surface({ title: 'Чат', d: { kind: 'mode' }, body: mode.root.innerHTML });
    mountChatList(mode.root, {
      title: 'Чат',
      threads: relationships,
      surface,
      onModeSwitch: () => closeMode(mode),
      onOpenThread: (relationship) => void openEndUserThread(mode, relationship),
      threadTitle: profileTitle,
      threadSubtitle: () => '',
      threadTime: () => '',
      emptyTitle: 'Диалогов пока нет',
      emptyText: 'Диалоги появятся после добавления контактов.',
    });
    mode.renderRootHeader = () => replaceHeader(mode.app, {
      title: 'Чат', a: null, c: null, d: { kind: 'mode' },
    }, mode.root, { onModeSwitch: () => closeMode(mode) });
  } catch (error) {
    closeMode(mode);
    openNotice({ title: 'Messenger недоступен', message: error instanceof Error ? error.message : 'Не удалось открыть Messenger', variant: 'technical' });
  }
}

async function openProfessionalThread(mode, thread) {
  const layer = threadLayer(mode);
  if (!layer) return;
  const phone = String(thread?.personPhone || '').trim();
  const uei = String(thread?.uei || '').trim();
  const externalThreadId = String(thread?.externalThreadId || '').trim();
  const title = professionalThreadTitle(thread);
  let filter = 'ALL';

  const render = async () => {
    const [messages, channelState] = await Promise.all([
      getCommunicationThread({ phone, uei, externalThreadId }),
      getCommunicationChannels({ phone, uei, externalThreadId }).catch(() => ({ channels: [] })),
    ]);
    if (!layer.isConnected) return;
    const options = professionalChannelOptions(channelState?.channels);
    if (!options.some((option) => option.value === filter)) filter = 'ALL';
    const surface = surfaceOwner(mode.app, layer, null);
    mountChatThread(layer, {
      title,
      messages: filteredMessages(messages, filter),
      viewer: 'profile',
      surface,
      channelOptions: options,
      channel: filter,
      onSend: async ({ body, attachments, channel }) => {
        const selected = channel === 'ALL' ? 'PUSH' : channel;
        await sendCommunicationMessage({ channel: selected, phone, uei, externalThreadId, body, attachments });
        await render();
      },
    });
    const selector = layer.querySelector('[name="messageChannel"]');
    selector?.addEventListener('change', () => {
      filter = String(selector.value || 'ALL').toUpperCase();
      void render();
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
    const threads = await getCommunicationThreads();
    const surface = surfaceOwner(mode.app, mode.root, () => closeMode(mode));
    mountChatList(mode.root, {
      title: 'Чат',
      threads,
      surface,
      onModeSwitch: () => closeMode(mode),
      onOpenThread: (thread) => void openProfessionalThread(mode, thread),
      threadTitle: professionalThreadTitle,
      threadSubtitle: (thread) => thread.body || (Array.isArray(thread.attachments) && thread.attachments.length ? 'Медиа' : ''),
      threadTime: (thread) => messageTime(thread.createdAt),
      emptyTitle: 'Чат пока пуст',
      emptyText: 'Диалоги появятся здесь.',
    });
    mode.renderRootHeader = () => replaceHeader(mode.app, {
      title: 'Чат', a: null, c: null, d: { kind: 'mode' },
    }, mode.root, { onModeSwitch: () => closeMode(mode) });

    if (initialPersonKey) {
      const person = getAllPeople().find((item) => String(item?.key || '') === String(initialPersonKey));
      const phone = String((Array.isArray(person?.phones) ? person.phones : []).find(Boolean) || '');
      if (phone) {
        await openProfessionalThread(mode, { personPhone: phone, uei: String(person?.uei || '') });
      }
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
  const originalHeader = app.querySelector(':scope > [data-v2-header]') || app.querySelector('[data-v2-header]');
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

function isChatModeButton(node) {
  return Boolean(node?.matches?.('.v2-header__control--chat'));
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-v2-header] .v2-header__slot--d button');
    if (!button || !isChatModeButton(button) || activeMode?.root?.isConnected) return;
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

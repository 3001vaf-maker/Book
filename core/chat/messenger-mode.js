import { USER_ORIGIN } from '../environment.js';
import {
  getEndUserChatThread,
  getEndUserChatThreads,
  getProfessionalChatThread,
  getProfessionalChatThreads,
  sendEndUserChatMessage,
  sendProfessionalChatMessage,
} from './internal-chat.js';
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

async function openEndUserThread(mode, relationship) {
  const tenantId = String(relationship?.tenantId || '').trim();
  if (!tenantId) return;
  const layer = threadLayer(mode);
  if (!layer) return;
  const title = profileTitle(relationship);
  const surface = surfaceOwner(mode.app, layer, null);

  const render = async () => {
    const messages = await getEndUserChatThread(tenantId);
    if (!layer.isConnected) return;
    mountChatThread(layer, {
      title,
      messages,
      viewer: 'account',
      surface,
      onSend: async ({ body, attachments }) => {
        await sendEndUserChatMessage(tenantId, body, attachments);
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
    const surface = surfaceOwner(mode.app, mode.root, () => closeMode(mode));
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
    mode.renderRootHeader = () => renderRootHeader(mode);
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
  const title = professionalThreadTitle(thread);
  const surface = surfaceOwner(mode.app, layer, null);

  const render = async () => {
    const messages = await getProfessionalChatThread({ phone, uei });
    if (!layer.isConnected) return;
    mountChatThread(layer, {
      title,
      messages,
      viewer: 'profile',
      surface,
      onSend: async ({ body, attachments }) => {
        await sendProfessionalChatMessage({ phone, uei, body, attachments });
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
      threadSubtitle: (thread) => thread.body || (Array.isArray(thread.attachments) && thread.attachments.length ? 'Медиа' : ''),
      threadTime: (thread) => messageTime(thread.createdAt),
      emptyTitle: 'Чат пока пуст',
      emptyText: 'Диалоги появятся здесь.',
    });
    mode.renderRootHeader = () => renderRootHeader(mode);

    if (initialPersonKey) {
      const person = getAllPeople().find((item) => String(item?.key || '') === String(initialPersonKey));
      const phone = String((Array.isArray(person?.phones) ? person.phones : []).find(Boolean) || '');
      if (phone) await openProfessionalThread(mode, { personPhone: phone, uei: String(person?.uei || '') });
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

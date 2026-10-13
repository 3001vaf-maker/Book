import {
  emptyState,
  initSegmentControls,
  openNotice,
  segmentControl,
  setV2ZHeaderRows,
  v2ListEntries,
  v2ListEntry,
} from '../../ui/ui.js';
import { bindMessageAttachments, initMessageComposer, messageComposer, messageThread } from '../../ui/chat/index.js';

function chatTime(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function threadUnread(thread = {}) {
  const count = Math.max(0, Math.trunc(Number(thread?.unreadCount) || 0));
  return count > 0 ? `${count > 99 ? '99+' : count} новых` : '';
}

function zSurface(root) {
  if (!root) return null;
  if (root.matches?.('[data-v2-z],[data-v2-z-layer]')) return root;
  return root.closest?.('[data-v2-z],[data-v2-z-layer]') || null;
}

export function mountChatChannelHeader(root, { channelOptions = [], channel = 'CHAT' } = {}) {
  const options = (Array.isArray(channelOptions) ? channelOptions : [])
    .filter((option) => option?.value)
    .map((option) => ({ value: String(option.value), label: String(option.label || option.value) }));
  if (!options.length) return () => '';

  const available = options.map((option) => option.value);
  const requested = String(channel || '').trim().toUpperCase();
  const initial = available.includes(requested) ? requested : available[0];
  setV2ZHeaderRows(root, [segmentControl(options, {
    value: initial,
    name: 'messageChannel',
    aria: 'Канал отправки сообщения',
  })]);

  const surface = zSurface(root) || root;
  initSegmentControls(surface);
  return () => String(surface.querySelector?.('[name="messageChannel"]')?.value || initial).trim().toUpperCase();
}

export function normalizeChatMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .slice()
    .sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime())
    .map((message) => ({ ...message, time: message?.time || chatTime(message?.createdAt) }));
}

export function mountChatList(root, {
  title = 'Чат',
  threads = [],
  emptyTitle = 'Чат пока пуст',
  emptyText = 'Диалоги появятся здесь.',
  surface,
  onSettings = null,
  onContacts = null,
  onModeSwitch = null,
  onOpenThread = null,
  threadTitle = (thread) => String(thread?.title || ''),
  threadSubtitle = (thread) => String(thread?.subtitle || ''),
  threadTime = (thread) => String(thread?.time || ''),
} = {}) {
  if (typeof surface !== 'function') throw new Error('Chat surface owner is required');
  const values = Array.isArray(threads) ? threads : [];
  const a = onSettings ? { kind: 'settings', data: 'data-chat-settings', aria: 'Настройки чата' } : null;
  const c = onContacts ? { kind: 'contacts', data: 'data-chat-contacts', aria: 'Контакты' } : null;
  const d = onModeSwitch ? { kind: 'mode', data: 'data-chat-mode-switch', aria: 'Вернуться в приложение' } : null;
  const items = values.map((thread, index) => v2ListEntry({
    title: threadTitle(thread),
    subtitle: threadSubtitle(thread),
    rightTop: threadTime(thread),
    rightBottom: threadUnread(thread),
    data: `data-chat-thread="${index}"`,
    aria: `Открыть диалог ${threadTitle(thread)}`,
  }));
  surface({
    mode: 'list',
    title,
    a,
    c,
    d,
    body: items.length ? v2ListEntries(items) : emptyState(emptyTitle, emptyText),
  });
  root.querySelector('[data-chat-settings]')?.addEventListener('click', () => onSettings?.());
  root.querySelector('[data-chat-contacts]')?.addEventListener('click', () => onContacts?.());
  root.querySelector('[data-chat-mode-switch]')?.addEventListener('click', () => onModeSwitch?.());
  root.querySelectorAll('[data-chat-thread]').forEach((node) => node.addEventListener('click', () => {
    const thread = values[Number(node.dataset.chatThread)];
    if (thread) onOpenThread?.(thread);
  }));
}

export function mountChatThread(root, {
  title = 'Чат',
  messages = [],
  viewer = 'account',
  surface,
  onSettings = null,
  onContacts = null,
  onSend,
  onMessageOpen = null,
  onPollVote = null,
  sendErrorMessage = 'Не удалось отправить сообщение',
  channelOptions = [],
  channel = '',
} = {}) {
  if (typeof surface !== 'function') throw new Error('Chat surface owner is required');
  if (typeof onSend !== 'function') throw new Error('Chat send owner is required');
  const normalized = normalizeChatMessages(messages);
  const a = onSettings ? { kind: 'settings', data: 'data-chat-settings', aria: 'Настройки чата' } : null;
  const c = onContacts ? { kind: 'contacts', data: 'data-chat-contacts', aria: 'Контакты' } : null;
  const d = { kind: 'attachment', data: 'data-chat-attachment', aria: 'Вложения' };
  const composer = messageComposer({ attachments: true, attachmentTrigger: 'external' });
  const body = `${normalized.length ? messageThread(normalized, { viewer }) : emptyState('Сообщений пока нет', 'Напишите первое сообщение.')}${composer}`;
  surface({
    mode: 'thread',
    title,
    a,
    c,
    d,
    body,
  });

  const selectedChannel = mountChatChannelHeader(root, { channelOptions, channel: channel || 'CHAT' });
  root.querySelector('[data-chat-settings]')?.addEventListener('click', () => onSettings?.());
  root.querySelector('[data-chat-contacts]')?.addEventListener('click', () => onContacts?.());

  initMessageComposer(root);
  const form = root.querySelector('[data-message-composer]');
  root.querySelector('[data-chat-attachment]')?.addEventListener('click', (event) => {
    if (document.querySelector('[data-v2-app].is-deck-open')) {
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent('book:v2-navigation-request', { detail: { open: false } }));
      return;
    }
    form?.querySelector('[data-message-attachment]')?.click();
  });
  const getAttachments = bindMessageAttachments(form);

  let replyTo = null;
  const setReply = (message = null) => {
    replyTo = message?.id ? message : null;
    form?.querySelector('[data-message-reply]')?.remove();
    if (!replyTo || !form) return;
    const preview = document.createElement('div');
    preview.className = 'message-composer__reply';
    preview.dataset.messageReply = 'true';
    const label = document.createElement('span');
    label.textContent = `Ответ: ${String(replyTo.body || 'Сообщение').slice(0, 80)}`;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'message-composer__reply-close';
    close.setAttribute('aria-label', 'Отменить ответ');
    close.textContent = '×';
    close.addEventListener('click', () => setReply(null));
    preview.append(label, close);
    form.prepend(preview);
  };

  if (typeof onMessageOpen === 'function') {
    root.querySelectorAll('[data-message-id]').forEach((node) => {
      const message = normalized.find((item) => String(item?.id || '') === String(node.dataset.messageId || ''));
      if (!message || message.deleted || message.deletedAt) return;
      let longPressTimer = 0;
      let longPressed = false;
      const open = (event) => {
        if (event?.target?.closest?.('a,video,button,input,textarea')) return;
        onMessageOpen({ node, message, event, setReply });
      };
      node.addEventListener('click', (event) => {
        if (longPressed) {
          longPressed = false;
          return;
        }
        open(event);
      });
      node.addEventListener('pointerdown', (event) => {
        if (event.target.closest?.('a,video,button,input,textarea')) return;
        longPressed = false;
        longPressTimer = window.setTimeout(() => {
          longPressed = true;
          open(event);
        }, 480);
      });
      const cancelLongPress = () => {
        if (longPressTimer) window.clearTimeout(longPressTimer);
        longPressTimer = 0;
      };
      node.addEventListener('pointerup', cancelLongPress);
      node.addEventListener('pointercancel', cancelLongPress);
      node.addEventListener('pointerleave', cancelLongPress);
    });
  }

  if (typeof onPollVote === 'function') {
    root.querySelectorAll('[data-message-poll-option]').forEach((button) => button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const bubble = button.closest('[data-message-id]');
      const message = normalized.find((item) => String(item?.id || '') === String(bubble?.dataset?.messageId || ''));
      const optionId = String(button.dataset.messagePollOption || '');
      if (!message || !optionId) return;
      button.disabled = true;
      try {
        await onPollVote({ message, optionId });
      } catch (error) {
        button.disabled = false;
        openNotice({ title: 'Голос не сохранён', message: error instanceof Error ? error.message : 'Не удалось сохранить голос', variant: 'technical' });
      }
    }));
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = form.querySelector('[name="message"]');
    const bodyValue = String(input?.value || '').trim();
    const attachments = getAttachments();
    if (!bodyValue && !attachments.length) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await onSend({
        body: bodyValue,
        attachments,
        replyToId: String(replyTo?.id || ''),
        channel: selectedChannel() || String(channel || 'CHAT').trim().toUpperCase(),
      });
    } catch (error) {
      if (submit) submit.disabled = false;
      openNotice({
        title: 'Сообщение не отправлено',
        message: error instanceof Error && error.message ? error.message : sendErrorMessage,
        action: 'Закрыть',
        variant: 'technical',
      });
    }
  });

  requestAnimationFrame(() => {
    const z = root.querySelector('[data-v2-z]') || root.closest?.('[data-v2-z]');
    if (z) z.scrollTop = z.scrollHeight;
  });
}

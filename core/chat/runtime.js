import { emptyState, listEntries, listEntry, openNotice } from '../../ui/ui.js';
import { bindMessageAttachments, initMessageComposer, messageComposer, messageThread } from '../../ui/chat/index.js';

function chatTime(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
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
  onOpenThread = null,
  threadTitle = (thread) => String(thread?.title || ''),
  threadSubtitle = (thread) => String(thread?.subtitle || ''),
  threadTime = (thread) => String(thread?.time || ''),
} = {}) {
  if (typeof surface !== 'function') throw new Error('Chat surface owner is required');
  const values = Array.isArray(threads) ? threads : [];
  const a = onSettings ? { kind: 'settings', data: 'data-chat-settings', aria: 'Настройки чата' } : null;
  const c = onContacts ? { kind: 'contacts', data: 'data-chat-contacts', aria: 'Контакты' } : null;
  const items = values.map((thread, index) => listEntry({
    title: threadTitle(thread),
    subtitle: threadSubtitle(thread),
    rightTop: threadTime(thread),
    data: `data-chat-thread="${index}"`,
    aria: `Открыть диалог ${threadTitle(thread)}`,
  }));
  surface({
    mode: 'list',
    title,
    a,
    c,
    d: null,
    body: items.length ? listEntries(items) : emptyState(emptyTitle, emptyText),
  });
  root.querySelector('[data-chat-settings]')?.addEventListener('click', () => onSettings?.());
  root.querySelector('[data-chat-contacts]')?.addEventListener('click', () => onContacts?.());
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
  sendErrorMessage = 'Не удалось отправить сообщение',
} = {}) {
  if (typeof surface !== 'function') throw new Error('Chat surface owner is required');
  if (typeof onSend !== 'function') throw new Error('Chat send owner is required');
  const normalized = normalizeChatMessages(messages);
  const a = onSettings ? { kind: 'settings', data: 'data-chat-settings', aria: 'Настройки чата' } : null;
  const c = onContacts ? { kind: 'contacts', data: 'data-chat-contacts', aria: 'К диалогам' } : null;
  const d = { kind: 'attachment', data: 'data-chat-attachment', aria: 'Вложения' };
  const body = `${normalized.length ? messageThread(normalized, { viewer }) : emptyState('Сообщений пока нет', 'Напишите первое сообщение.')}${messageComposer({ attachments: true, attachmentTrigger: 'external' })}`;
  surface({
    mode: 'thread',
    title,
    a,
    c,
    d,
    body,
  });

  root.querySelector('[data-chat-settings]')?.addEventListener('click', () => onSettings?.());
  root.querySelector('[data-chat-contacts]')?.addEventListener('click', () => onContacts?.());

  initMessageComposer(root);
  const form = root.querySelector('[data-message-composer]');
  root.querySelector('[data-chat-attachment]')?.addEventListener('click', () => form?.querySelector('[data-message-attachment]')?.click());
  const getAttachments = bindMessageAttachments(form);

  if (typeof onMessageOpen === 'function') {
    root.querySelectorAll('[data-message-id]').forEach((node) => {
      const message = normalized.find((item) => String(item?.id || '') === String(node.dataset.messageId || ''));
      if (!message) return;
      onMessageOpen({ node, message });
    });
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
      await onSend({ body: bodyValue, attachments });
    } catch {
      if (submit) submit.disabled = false;
      openNotice({
        title: 'Сообщение не отправлено',
        message: sendErrorMessage,
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

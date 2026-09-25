import { button } from '../buttons/index.js';
import { escapeHtml } from '../utils/escape-html.js';
import { openNotice } from '../modals/index.js';

function text(value = '') {
  return escapeHtml(String(value ?? ''));
}

function attachmentMarkup(attachment = {}) {
  const dataUrl = String(attachment?.dataUrl || '').trim();
  const type = String(attachment?.type || '').toLowerCase();
  const name = text(attachment?.name || 'Вложение');
  if (type.startsWith('image/') && dataUrl.startsWith('data:image/')) {
    return `<a class="message-attachment message-attachment--image" href="${text(dataUrl)}" target="_blank" rel="noopener" aria-label="Открыть ${name}"><img src="${text(dataUrl)}" alt="${name}"></a>`;
  }
  if (type.startsWith('video/') && dataUrl.startsWith('data:video/')) {
    return `<video class="message-attachment message-attachment--video" controls preload="metadata"><source src="${text(dataUrl)}" type="${text(type)}"></video>`;
  }
  if (type === 'application/pdf' && dataUrl.startsWith('data:application/pdf')) {
    return `<a class="message-attachment message-attachment--file" href="${text(dataUrl)}" target="_blank" rel="noopener" aria-label="Открыть ${name}"><strong>PDF</strong><span>${name}</span></a>`;
  }
  return '';
}

export function messageBubble(message = {}, { viewer = 'account' } = {}) {
  const direction = String(message.direction || '').toLowerCase();
  const system = direction === 'system' || String(message.kind || '').toLowerCase() === 'system';
  const outgoing = viewer === 'profile' ? direction === 'outbound' : direction === 'inbound';
  const classes = ['message-bubble', system ? 'message-bubble--system' : outgoing ? 'message-bubble--outgoing' : 'message-bubble--incoming'].join(' ');
  const time = message.time || message.createdAt || '';
  const attachments = (Array.isArray(message.attachments) ? message.attachments : []).map(attachmentMarkup).filter(Boolean).join('');
  const body = text(message.body || '').replaceAll('\n', '<br>');
  return `<div class="${classes}" data-message-id="${text(message.id || '')}">${attachments ? `<div class="message-bubble__attachments">${attachments}</div>` : ''}${body ? `<div class="message-bubble__body">${body}</div>` : ''}${time ? `<span class="message-bubble__time">${text(time)}</span>` : ''}</div>`;
}

export function messageThread(messages = [], options = {}) {
  const values = Array.isArray(messages) ? messages : [];
  return `<div class="message-thread" data-message-thread>${values.map((message) => messageBubble(message, options)).join('')}</div>`;
}

async function fileAttachment(file) {
  if (!(file instanceof File)) return null;
  if (!/^(image|video)\//i.test(file.type || '') && String(file.type || '').toLowerCase() !== 'application/pdf') {
    throw new Error('Можно прикрепить фото, видео или PDF');
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('Один файл должен быть не больше 8 МБ');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
  return { name: file.name || 'Файл', type: file.type || '', size: file.size || 0, dataUrl };
}

export function bindMessageAttachments(form) {
  const selected = [];
  const input = form?.querySelector('[data-message-attachment-input]');
  const trigger = form?.querySelector('[data-message-attachment]');
  const preview = form?.querySelector('[data-message-attachment-preview]');
  const redraw = () => {
    if (!preview) return;
    preview.innerHTML = selected.map((item) => `<span class="message-composer__attachment-chip">${text(item.name || 'Медиа')}</span>`).join('');
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
      if (input) input.value = '';
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

export function initMessageComposer(root = document) {
  root.querySelectorAll?.('[data-message-composer]').forEach((form) => {
    const input = form.querySelector('.message-composer__input');
    if (!input || input.dataset.messageComposerReady === 'true') return;
    input.dataset.messageComposerReady = 'true';
    const resize = () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 116)}px`;
      input.style.overflowY = input.scrollHeight > 116 ? 'auto' : 'hidden';
    };
    input.addEventListener('input', resize);
    requestAnimationFrame(resize);
  });
}

export function messageComposer({ placeholder = 'Написать сообщение...', data = 'data-message-composer', sendData = 'data-message-send', attachments = false, attachmentTrigger = 'composer' } = {}) {
  const externalAttachmentTrigger = attachments && attachmentTrigger === 'external';
  const composerClass = attachments && !externalAttachmentTrigger ? 'message-composer message-composer--with-attachments' : 'message-composer message-composer--plain';
  return `<form class="${composerClass}" ${data}>${attachments ? `<input class="sr-only" type="file" accept="image/*,video/*,application/pdf,.pdf" multiple data-message-attachment-input><button type="button" class="message-composer__attach${externalAttachmentTrigger ? ' sr-only' : ''}" data-message-attachment aria-label="Прикрепить файл">📎</button>` : ''}<textarea class="message-composer__input" name="message" rows="1" placeholder="${text(placeholder)}" aria-label="${text(placeholder)}"></textarea>${button('➤', { className: 'message-composer__send', type: 'submit', data: sendData, aria: 'Отправить' })}${attachments ? '<div class="message-composer__attachments" data-message-attachment-preview></div>' : ''}</form>`;
}

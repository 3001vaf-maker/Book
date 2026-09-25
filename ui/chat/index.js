import { button } from '../buttons/index.js';
import { escapeHtml } from '../utils/escape-html.js';

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

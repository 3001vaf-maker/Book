import { getCommunicationThread, getCommunicationThreads, sendCommunicationMessage } from '../core/communications/chat.js';
import { findPeopleByPhone } from '../main/clients/data.js';
import { actionBlock, button, emptyState, escapeHtml, folderList, pageHeader, textareaField } from '../ui/ui.js';

function clientName(phone) {
  const person = findPeopleByPhone(phone)[0];
  const name = [person?.name, person?.surname].filter(Boolean).join(' ').trim();
  return name || String(phone || 'Клиент');
}
function channelLabel(value) {
  const channel = String(value || '').toUpperCase();
  if (channel === 'TELEGRAM') return 'Telegram';
  if (channel === 'EMAIL') return 'Email';
  if (channel === 'SMS') return 'SMS';
  if (channel === 'WHATSAPP') return 'WhatsApp';
  if (channel === 'PUSH') return 'Push';
  if (channel === 'IN_APP') return 'Book';
  return channel || 'Сообщение';
}
function messageHtml(message) {
  const direction = String(message?.direction || '').toLowerCase();
  const who = direction === 'inbound' ? 'Клиент' : direction === 'outbound' ? 'Вы' : 'Book';
  const status = String(message?.status || '').trim();
  return `<div class="action-block"><div class="section-heading"><h3>${escapeHtml(who)}</h3><span class="muted">${escapeHtml(channelLabel(message?.channel))}</span></div><div>${escapeHtml(message?.body || '').replaceAll('\n', '<br>')}</div>${status ? `<div class="muted">${escapeHtml(status)}</div>` : ''}</div>`;
}

async function openThread(root, thread) {
  const phone = String(thread?.cardPhone || '').trim(); const uei = String(thread?.uei || '').trim();
  root.innerHTML = `${pageHeader(clientName(phone))}${emptyState('Загрузка', 'Получаем переписку.')}`;
  try {
    const messages = await getCommunicationThread({ phone, uei });
    root.innerHTML = `${pageHeader(clientName(phone))}<div data-chat-messages>${messages.length ? messages.map(messageHtml).join('') : emptyState('Сообщений пока нет', 'Здесь появится история общения с клиентом.')}</div><form class="form-grid" data-chat-send>${textareaField({ label: 'Сообщение', name: 'message', placeholder: 'Напишите клиенту' })}<div class="muted">Book отправит через доступный канал клиента с учётом настроек и согласия.</div><div class="muted" data-chat-status aria-live="polite"></div>${actionBlock(`${button('Отправить', { type: 'submit' })}${button('К диалогам', { type: 'button', variant: 'secondary', data: 'data-chat-back' })}`)}</form>`;
    root.querySelector('[data-chat-back]')?.addEventListener('click', () => renderThreads(root));
    root.querySelector('[data-chat-send]')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget; const status = root.querySelector('[data-chat-status]'); const input = form.querySelector('[name="message"]'); const body = String(input?.value || '').trim(); if (!body) return;
      const submit = form.querySelector('button[type="submit"]'); if (submit) submit.disabled = true; if (status) status.textContent = 'Отправляем…';
      try { await sendCommunicationMessage({ phone, uei, body }); await openThread(root, thread); }
      catch (error) { if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось отправить'; if (submit) submit.disabled = false; }
    });
  } catch (error) {
    root.innerHTML = `${pageHeader(clientName(phone))}${emptyState('Чат недоступен', error instanceof Error ? error.message : 'Не удалось загрузить переписку')}${actionBlock(button('К диалогам', { variant: 'secondary', data: 'data-chat-back' }))}`;
    root.querySelector('[data-chat-back]')?.addEventListener('click', () => renderThreads(root));
  }
}

async function renderThreads(root) {
  root.innerHTML = `${pageHeader('Чат')}${emptyState('Загрузка', 'Получаем диалоги.')}`;
  try {
    const threads = await getCommunicationThreads();
    const items = threads.map((thread, index) => ({ title: clientName(thread.cardPhone), count: channelLabel(thread.channel), data: `data-chat-thread="${index}"` }));
    root.innerHTML = `${pageHeader('Чат')}${items.length ? folderList(items) : emptyState('Чат пока пуст', 'Сообщения и системные уведомления клиентов появятся здесь.')}`;
    root.querySelectorAll('[data-chat-thread]').forEach((element) => element.addEventListener('click', () => { const thread = threads[Number(element.dataset.chatThread)]; if (thread) void openThread(root, thread); }));
  } catch (error) { root.innerHTML = `${pageHeader('Чат')}${emptyState('Чат недоступен', error instanceof Error ? error.message : 'Не удалось загрузить диалоги')}`; }
}

export function renderChat(root) { void renderThreads(root); }

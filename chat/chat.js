import { getCommunicationThread, getCommunicationThreads, sendCommunicationMessage } from '../core/communications/chat.js';
import {
  deleteBroadcastTemplate,
  deleteCommunicationGroup,
  getBroadcastTemplates,
  getCommunicationGroups,
  saveBroadcastTemplate,
  saveCommunicationGroup,
  sendBroadcast,
} from '../core/communications/broadcasts.js';
import { findPeopleByPhone, getAllPeople } from '../main/people/data.js';
import {
  appHeader,
  appShell,
  button,
  checkList,
  collectCheckList,
  emptyState,
  escapeHtml,
  field,
  initCheckList,
  listEntries,
  listEntry,
  messageComposer,
  messageThread,
  modal,
  mountModal,
  settingsPanel,
  textareaField,
} from '../ui/ui.js';

function clientName(phone, uei = '') {
  const people = findPeopleByPhone(phone);
  const person = people.find((item) => !uei || String(item.uei || '') === String(uei)) || people[0];
  const name = [person?.name, person?.surname].filter(Boolean).join(' ').trim();
  return name || String(phone || 'Клиент');
}

function personName(person = {}) {
  return [person.name, person.surname].filter(Boolean).join(' ').trim() || person.phones?.[0] || 'Клиент';
}

function phoneOf(person = {}) {
  return String((Array.isArray(person.phones) ? person.phones : []).find(Boolean) || '');
}

function messageTime(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function withTimes(messages = []) {
  return (Array.isArray(messages) ? messages : []).map((message) => ({ ...message, time: messageTime(message.createdAt) }));
}

function screen(root, header, body = '', className = '') {
  root.classList.add('app-content--shell');
  root.innerHTML = appShell({ header, body, media: '', className });
}

async function fileAttachment(file) {
  if (!(file instanceof File)) return null;
  if (!/^(image|video)\//i.test(file.type || '')) throw new Error('Можно прикрепить фото или видео');
  if (file.size > 8 * 1024 * 1024) throw new Error('Один файл должен быть не больше 8 МБ');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
  return { name: file.name || 'Медиа', type: file.type || '', size: file.size || 0, dataUrl };
}

function bindMessageAttachments(form) {
  const selected = [];
  const input = form?.querySelector('[data-message-attachment-input]');
  const trigger = form?.querySelector('[data-message-attachment]');
  const preview = form?.querySelector('[data-message-attachment-preview]');
  const redraw = () => {
    if (!preview) return;
    preview.innerHTML = selected.map((item) => `<span class="message-composer__attachment-chip">${escapeHtml(item.name || 'Медиа')}</span>`).join('');
  };
  trigger?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', async () => {
    const files = [...(input.files || [])].slice(0, 3);
    try {
      const next = (await Promise.all(files.map(fileAttachment))).filter(Boolean);
      selected.splice(0, selected.length, ...next);
      redraw();
      input.setCustomValidity('');
    } catch (error) {
      selected.splice(0, selected.length);
      redraw();
      input.setCustomValidity(error instanceof Error ? error.message : 'Не удалось прикрепить файл');
      input.reportValidity();
      input.setCustomValidity('');
    }
  });
  return () => [...selected];
}

function peopleList() {
  return getAllPeople().filter((person) => person.key && phoneOf(person));
}

function personByKey(key) {
  return peopleList().find((person) => String(person.key) === String(key)) || null;
}

function recipientLabel(recipient = {}) {
  if (recipient.mode === 'one') return personName(personByKey(recipient.personKeys?.[0]) || {});
  if (recipient.mode === 'many') return `Выбрано: ${recipient.personKeys?.length || 0}`;
  if (recipient.mode === 'group') return recipient.groupName || 'Группа';
  if (recipient.mode === 'all') return 'Все клиенты';
  return 'Получатели';
}

async function chooseTemplate(input) {
  const templates = await getBroadcastTemplates();
  if (!templates.length) return;
  const layer = mountModal(document.body, modal(listEntries(templates.map((template, index) => listEntry({
    title: template.name,
    subtitle: template.body,
    data: `data-chat-template="${index}"`,
    aria: `Выбрать шаблон ${template.name}`,
  }))), { title: 'Шаблоны', variant: 'large', surface: 'app' }));
  layer?.querySelectorAll('[data-chat-template]').forEach((node) => node.addEventListener('click', () => {
    const template = templates[Number(node.dataset.chatTemplate)];
    if (template && input) input.value = template.body || '';
    layer.remove();
    input?.focus();
  }));
}

async function renderCompose(root, state, recipient) {
  state.view = 'compose';
  state.recipient = recipient;
  const allowsAttachments = recipient.mode === 'one';
  screen(root, appHeader({
    title: 'Новое сообщение',
    back: { data: 'data-profile-compose-back', aria: 'К диалогам' },
  }), `
    <div class="action-block"><strong>Кому: ${recipientLabel(recipient)}</strong></div>
    ${button('Выбрать шаблон', { variant: 'secondary', data: 'data-profile-template-choose' })}
    ${messageComposer({ placeholder: 'Написать сообщение...', attachments: allowsAttachments })}
    <div class="muted" data-profile-compose-status aria-live="polite"></div>
  `, 'app-view-shell--chat');
  root.querySelector('[data-profile-compose-back]')?.addEventListener('click', () => void renderThreads(root, state));
  const form = root.querySelector('[data-message-composer]');
  const input = form?.querySelector('[name="message"]');
  const getAttachments = allowsAttachments ? bindMessageAttachments(form) : () => [];
  root.querySelector('[data-profile-template-choose]')?.addEventListener('click', () => void chooseTemplate(input));
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = String(input?.value || '').trim();
    const attachments = getAttachments();
    if (!body && !attachments.length) return;
    const submit = form.querySelector('button[type="submit"]');
    const status = root.querySelector('[data-profile-compose-status]');
    if (submit) submit.disabled = true;
    if (status) status.textContent = 'Отправляем…';
    try {
      if (recipient.mode === 'one') {
        const person = personByKey(recipient.personKeys?.[0]);
        if (!person) throw new Error('Клиент не найден');
        await sendCommunicationMessage({ phone: phoneOf(person), uei: person.uei || '', body, attachments });
      } else {
        await sendBroadcast({
          channel: 'TELEGRAM',
          all: recipient.mode === 'all',
          personKeys: recipient.mode === 'many' ? recipient.personKeys || [] : [],
          groupId: recipient.mode === 'group' ? recipient.groupId || '' : '',
          name: recipientLabel(recipient),
          body,
        });
      }
      await renderThreads(root, state);
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось отправить сообщение';
      if (submit) submit.disabled = false;
    }
  });
}

function recipientOptions(root, state) {
  const layer = mountModal(document.body, modal(settingsPanel([
    { label: 'Один клиент', data: 'data-recipient-one' },
    { label: 'Несколько клиентов', data: 'data-recipient-many' },
    { label: 'Группа', data: 'data-recipient-group' },
    { label: 'Все клиенты', data: 'data-recipient-all' },
  ]), { title: 'Кому?', variant: 'medium', surface: 'app' }));
  layer?.querySelector('[data-recipient-one]')?.addEventListener('click', () => { layer.remove(); void chooseOne(root, state); });
  layer?.querySelector('[data-recipient-many]')?.addEventListener('click', () => { layer.remove(); void chooseMany(root, state); });
  layer?.querySelector('[data-recipient-group]')?.addEventListener('click', () => { layer.remove(); void chooseGroup(root, state); });
  layer?.querySelector('[data-recipient-all]')?.addEventListener('click', () => { layer.remove(); void renderCompose(root, state, { mode: 'all' }); });
}

async function chooseOne(root, state) {
  const people = peopleList();
  const layer = mountModal(document.body, modal(people.length ? listEntries(people.map((person, index) => listEntry({
    title: personName(person),
    subtitle: phoneOf(person),
    data: `data-recipient-person="${index}"`,
  }))) : emptyState('Клиентов нет', 'Некого выбрать для сообщения.'), { title: 'Клиент', variant: 'large', surface: 'app' }));
  layer?.querySelectorAll('[data-recipient-person]').forEach((node) => node.addEventListener('click', () => {
    const person = people[Number(node.dataset.recipientPerson)];
    if (!person) return;
    layer.remove();
    void renderCompose(root, state, { mode: 'one', personKeys: [person.key] });
  }));
}

async function chooseMany(root, state) {
  const people = peopleList();
  const content = `<div class="form-grid">${checkList(people.map((person) => ({ value: person.key, label: personName(person), secondary: phoneOf(person) })))}${button('Далее', { data: 'data-recipient-many-next' })}</div>`;
  const layer = mountModal(document.body, modal(content, { title: 'Несколько клиентов', variant: 'large', surface: 'app' }));
  if (!layer) return;
  initCheckList(layer);
  layer.querySelector('[data-recipient-many-next]')?.addEventListener('click', () => {
    const personKeys = collectCheckList(layer);
    if (!personKeys.length) return;
    layer.remove();
    void renderCompose(root, state, { mode: 'many', personKeys });
  });
}

async function chooseGroup(root, state) {
  const groups = await getCommunicationGroups();
  const layer = mountModal(document.body, modal(groups.length ? listEntries(groups.map((group, index) => listEntry({
    title: group.name,
    subtitle: `${group.personKeys?.length || 0} клиентов`,
    data: `data-recipient-group-choice="${index}"`,
  }))) : emptyState('Групп пока нет', 'Создайте группу в настройках чата.'), { title: 'Группа', variant: 'large', surface: 'app' }));
  layer?.querySelectorAll('[data-recipient-group-choice]').forEach((node) => node.addEventListener('click', () => {
    const group = groups[Number(node.dataset.recipientGroupChoice)];
    if (!group) return;
    layer.remove();
    void renderCompose(root, state, { mode: 'group', groupId: group.id, groupName: group.name });
  }));
}

async function editGroup(group = null) {
  const people = peopleList();
  const content = `<form class="form-grid" data-group-form>
    ${field({ label: 'Название группы', name: 'name', value: group?.name || '', required: true })}
    ${checkList(people.map((person) => ({ value: person.key, label: personName(person), secondary: phoneOf(person), checked: (group?.personKeys || []).includes(person.key) })))}
    ${button('Сохранить', { type: 'submit' })}
    ${group?.id ? button('Удалить группу', { type: 'button', variant: 'danger', data: 'data-group-delete' }) : ''}
  </form>`;
  const layer = mountModal(document.body, modal(content, { title: group ? group.name : 'Новая группа', variant: 'large', surface: 'app' }));
  if (!layer) return;
  initCheckList(layer);
  const form = layer.querySelector('[data-group-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const personKeys = collectCheckList(layer);
    await saveCommunicationGroup({ id: group?.id || '', name: data.get('name'), personKeys });
    layer.remove();
    await manageGroups();
  });
  layer.querySelector('[data-group-delete]')?.addEventListener('click', async () => {
    await deleteCommunicationGroup(group.id);
    layer.remove();
    await manageGroups();
  });
}

async function manageGroups() {
  const groups = await getCommunicationGroups();
  const content = `<div class="form-grid">${button('Новая группа', { data: 'data-group-new' })}${groups.length ? listEntries(groups.map((group, index) => listEntry({ title: group.name, subtitle: `${group.personKeys?.length || 0} клиентов`, data: `data-group-edit="${index}"` }))) : emptyState('Групп пока нет', 'Создайте первую группу клиентов.')}</div>`;
  const layer = mountModal(document.body, modal(content, { title: 'Группы', variant: 'large', surface: 'app' }));
  layer?.querySelector('[data-group-new]')?.addEventListener('click', () => { layer.remove(); void editGroup(); });
  layer?.querySelectorAll('[data-group-edit]').forEach((node) => node.addEventListener('click', () => {
    const group = groups[Number(node.dataset.groupEdit)];
    layer.remove();
    void editGroup(group);
  }));
}

async function editTemplate(template = null) {
  const content = `<form class="form-grid" data-template-form>
    ${field({ label: 'Название шаблона', name: 'name', value: template?.name || '', required: true })}
    ${textareaField({ label: 'Текст сообщения', name: 'body', value: template?.body || '', required: true, rows: 6 })}
    ${button('Сохранить', { type: 'submit' })}
    ${template?.id ? button('Удалить шаблон', { type: 'button', variant: 'danger', data: 'data-template-delete' }) : ''}
  </form>`;
  const layer = mountModal(document.body, modal(content, { title: template ? template.name : 'Новый шаблон', variant: 'large', surface: 'app' }));
  const form = layer?.querySelector('[data-template-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    await saveBroadcastTemplate({ id: template?.id || '', name: data.get('name'), body: data.get('body') });
    layer.remove();
    await manageTemplates();
  });
  layer?.querySelector('[data-template-delete]')?.addEventListener('click', async () => {
    await deleteBroadcastTemplate(template.id);
    layer.remove();
    await manageTemplates();
  });
}

async function manageTemplates() {
  const templates = await getBroadcastTemplates();
  const content = `<div class="form-grid">${button('Новый шаблон', { data: 'data-template-new' })}${templates.length ? listEntries(templates.map((template, index) => listEntry({ title: template.name, subtitle: template.body, data: `data-template-edit="${index}"` }))) : emptyState('Шаблонов пока нет', 'Создайте первый шаблон сообщения.')}</div>`;
  const layer = mountModal(document.body, modal(content, { title: 'Шаблоны', variant: 'large', surface: 'app' }));
  layer?.querySelector('[data-template-new]')?.addEventListener('click', () => { layer.remove(); void editTemplate(); });
  layer?.querySelectorAll('[data-template-edit]').forEach((node) => node.addEventListener('click', () => {
    const template = templates[Number(node.dataset.templateEdit)];
    layer.remove();
    void editTemplate(template);
  }));
}

function openProfileChatSettings() {
  const layer = mountModal(document.body, modal(settingsPanel([
    { label: 'Группы клиентов', data: 'data-chat-groups' },
    { label: 'Шаблоны сообщений', data: 'data-chat-templates' },
  ]), { title: 'Настройки сообщений', variant: 'medium', surface: 'app' }));
  layer?.querySelector('[data-chat-groups]')?.addEventListener('click', () => { layer.remove(); void manageGroups(); });
  layer?.querySelector('[data-chat-templates]')?.addEventListener('click', () => { layer.remove(); void manageTemplates(); });
}

async function openThread(root, state, thread) {
  state.view = 'thread';
  state.thread = thread;
  const phone = String(thread?.cardPhone || '').trim();
  const uei = String(thread?.uei || '').trim();
  screen(root, appHeader({ title: clientName(phone, uei), back: { data: 'data-chat-back', aria: 'К диалогам' } }), emptyState('Загрузка', 'Получаем переписку.'), 'app-view-shell--chat');
  try {
    const messages = withTimes(await getCommunicationThread({ phone, uei }));
    screen(root, appHeader({ title: clientName(phone, uei), back: { data: 'data-chat-back', aria: 'К диалогам' } }), `${messages.length ? messageThread(messages, { viewer: 'profile' }) : emptyState('Сообщений пока нет', 'Напишите клиенту первое сообщение.')}${messageComposer({ placeholder: 'Написать сообщение...', attachments: true })}<div class="muted" data-chat-status aria-live="polite"></div>`, 'app-view-shell--chat');
    root.querySelector('[data-chat-back]')?.addEventListener('click', () => void renderThreads(root, state));
    const form = root.querySelector('[data-message-composer]');
    const getAttachments = bindMessageAttachments(form);
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = form.querySelector('[name="message"]');
      const body = String(input?.value || '').trim();
      const attachments = getAttachments();
      if (!body && !attachments.length) return;
      const submit = form.querySelector('button[type="submit"]');
      const status = root.querySelector('[data-chat-status]');
      if (submit) submit.disabled = true;
      try {
        await sendCommunicationMessage({ phone, uei, body, attachments });
        await openThread(root, state, thread);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось отправить';
        if (submit) submit.disabled = false;
      }
    });
  } catch (error) {
    screen(root, appHeader({ title: clientName(phone, uei), back: { data: 'data-chat-back', aria: 'К диалогам' } }), emptyState('Чат недоступен', error instanceof Error ? error.message : 'Не удалось загрузить переписку'), 'app-view-shell--chat');
    root.querySelector('[data-chat-back]')?.addEventListener('click', () => void renderThreads(root, state));
  }
}

async function renderThreads(root, state) {
  state.view = 'threads';
  state.thread = null;
  screen(root, appHeader({ title: 'Сообщения', action: { label: 'Новое', data: 'data-chat-new' }, settings: { data: 'data-chat-settings', aria: 'Настройки сообщений' } }), emptyState('Загрузка', 'Получаем диалоги.'));
  try {
    const threads = await getCommunicationThreads();
    const items = threads.map((thread, index) => listEntry({
      title: clientName(thread.cardPhone, thread.uei),
      subtitle: thread.body || (Array.isArray(thread.attachments) && thread.attachments.length ? 'Медиа' : 'Открыть диалог'),
      rightTop: messageTime(thread.createdAt),
      data: `data-chat-thread="${index}"`,
      aria: `Открыть диалог с ${clientName(thread.cardPhone, thread.uei)}`,
    }));
    screen(root, appHeader({ title: 'Сообщения', action: { label: 'Новое', data: 'data-chat-new' }, settings: { data: 'data-chat-settings', aria: 'Настройки сообщений' } }), items.length ? listEntries(items) : emptyState('Чат пока пуст', 'Сообщения и системные уведомления клиентов появятся здесь.'));
    root.querySelector('[data-chat-new]')?.addEventListener('click', () => recipientOptions(root, state));
    root.querySelector('[data-chat-settings]')?.addEventListener('click', openProfileChatSettings);
    root.querySelectorAll('[data-chat-thread]').forEach((element) => element.addEventListener('click', () => {
      const thread = threads[Number(element.dataset.chatThread)];
      if (thread) void openThread(root, state, thread);
    }));
  } catch (error) {
    screen(root, appHeader({ title: 'Сообщения', action: { label: 'Новое', data: 'data-chat-new' }, settings: { data: 'data-chat-settings', aria: 'Настройки сообщений' } }), emptyState('Чат недоступен', error instanceof Error ? error.message : 'Не удалось загрузить диалоги'));
    root.querySelector('[data-chat-new]')?.addEventListener('click', () => recipientOptions(root, state));
    root.querySelector('[data-chat-settings]')?.addEventListener('click', openProfileChatSettings);
  }
}

export function renderChat(root) {
  const state = { view: 'threads', thread: null, recipient: null };
  void renderThreads(root, state);
}

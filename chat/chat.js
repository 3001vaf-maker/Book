import { deleteCommunicationMessage, editCommunicationMessage, getCommunicationThread, getCommunicationThreads, sendCommunicationMessage } from '../core/communications/chat.js';
import {
  deleteBroadcastTemplate,
  deleteCommunicationGroup,
  getBroadcastTemplates,
  getCommunicationGroups,
  saveBroadcastTemplate,
  saveCommunicationGroup,
  sendBroadcast,
} from '../core/communications/broadcasts.js';
import { findPeopleByPhone, getAllClients } from '../main/clients/data.js';
import {
  appHeader,
  appShell,
  bindRichTextEditor,
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

function messageContent(message = {}) {
  if (Array.isArray(message?.content?.blocks) && message.content.blocks.length) return message.content;
  const body = String(message.body || '').trim();
  return body ? { version: 1, blocks: [{ type: 'paragraph', spans: [{ text: body, marks: [] }] }] } : { version: 1, blocks: [] };
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
  return getAllClients().filter((person) => person.key && phoneOf(person));
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

async function chooseTemplate(applyTemplate) {
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
    if (template) applyTemplate?.(template.body || '');
    layer.remove();
  }));
}

async function renderCompose(root, state, recipient) {
  state.view = 'compose';
  state.recipient = recipient;
  const oneClient = recipient.mode === 'one';
  screen(root, appHeader({
    title: 'Новое сообщение',
    back: { data: 'data-master-compose-back', aria: 'К диалогам' },
  }), `
    <div class="action-block"><strong>Кому: ${recipientLabel(recipient)}</strong></div>
    ${button('Выбрать шаблон', { variant: 'secondary', data: 'data-master-template-choose' })}
    ${messageComposer({ placeholder: 'Написать сообщение...', attachments: oneClient, rich: oneClient })}
    <div class="muted" data-master-compose-status aria-live="polite"></div>
  `, 'app-view-shell--chat');
  root.querySelector('[data-master-compose-back]')?.addEventListener('click', () => void renderThreads(root, state));
  const form = root.querySelector('[data-message-composer]');
  const plainInput = form?.querySelector('[name="message"]');
  const richEditor = oneClient ? bindRichTextEditor(form) : null;
  const getAttachments = oneClient ? bindMessageAttachments(form) : () => [];
  root.querySelector('[data-master-template-choose]')?.addEventListener('click', () => void chooseTemplate((templateBody) => {
    if (richEditor) richEditor.setValue(messageContent({ body: templateBody }));
    else if (plainInput) plainInput.value = templateBody;
    (richEditor || { focus: () => plainInput?.focus() }).focus();
  }));
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const richValue = richEditor?.getValue();
    const body = oneClient ? String(richValue?.body || '').trim() : String(plainInput?.value || '').trim();
    const content = oneClient ? richValue?.content || null : null;
    const attachments = getAttachments();
    if (!body && !attachments.length) return;
    const submit = form.querySelector('button[type="submit"]');
    const status = root.querySelector('[data-master-compose-status]');
    if (submit) submit.disabled = true;
    if (status) status.textContent = 'Отправляем…';
    try {
      if (oneClient) {
        const person = personByKey(recipient.personKeys?.[0]);
        if (!person) throw new Error('Клиент не найден');
        await sendCommunicationMessage({ phone: phoneOf(person), uei: person.uei || '', body, content, attachments });
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

function openMasterChatSettings() {
  const layer = mountModal(document.body, modal(settingsPanel([
    { label: 'Группы клиентов', data: 'data-chat-groups' },
    { label: 'Шаблоны сообщений', data: 'data-chat-templates' },
  ]), { title: 'Настройки сообщений', variant: 'medium', surface: 'app' }));
  layer?.querySelector('[data-chat-groups]')?.addEventListener('click', () => { layer.remove(); void manageGroups(); });
  layer?.querySelector('[data-chat-templates]')?.addEventListener('click', () => { layer.remove(); void manageTemplates(); });
}

function openMessageActions(root, state, thread, message) {
  const layer = mountModal(document.body, modal(settingsPanel([
    { label: 'Изменить', data: 'data-message-edit' },
    { label: 'Удалить', data: 'data-message-delete', variant: 'danger' },
  ]), { title: 'Сообщение', variant: 'medium', surface: 'app' }));
  layer?.querySelector('[data-message-edit]')?.addEventListener('click', () => {
    layer.remove();
    const editLayer = mountModal(document.body, modal(`<form class="form-grid" data-message-edit-form>${messageComposer({ placeholder: 'Сообщение', attachments: false, rich: true, embedded: true, value: messageContent(message) })}<div class="muted" data-message-edit-status></div></form>`, { title: 'Изменить сообщение', variant: 'large', surface: 'app' }));
    const form = editLayer?.querySelector('[data-message-edit-form]');
    const editor = bindRichTextEditor(form, { value: messageContent(message) });
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = editor.getValue();
      if (!value.body) return;
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        await editCommunicationMessage(message.id, value);
        editLayer.remove();
        await openThread(root, state, thread);
      } catch (error) {
        const status = form.querySelector('[data-message-edit-status]');
        if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось изменить';
        if (submit) submit.disabled = false;
      }
    });
  });
  layer?.querySelector('[data-message-delete]')?.addEventListener('click', () => {
    layer.remove();
    const confirmLayer = mountModal(document.body, modal(`<div class="form-grid"><p>Удалить это сообщение?</p>${button('Удалить', { variant: 'danger', data: 'data-message-delete-confirm' })}${button('Отмена', { variant: 'secondary', data: 'data-message-delete-cancel' })}<div class="muted" data-message-delete-status></div></div>`, { title: 'Удаление сообщения', variant: 'medium', surface: 'app' }));
    confirmLayer?.querySelector('[data-message-delete-cancel]')?.addEventListener('click', () => confirmLayer.remove());
    confirmLayer?.querySelector('[data-message-delete-confirm]')?.addEventListener('click', async () => {
      const control = confirmLayer.querySelector('[data-message-delete-confirm]');
      if (control) control.disabled = true;
      try {
        await deleteCommunicationMessage(message.id);
        confirmLayer.remove();
        await openThread(root, state, thread);
      } catch (error) {
        const status = confirmLayer.querySelector('[data-message-delete-status]');
        if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось удалить';
        if (control) control.disabled = false;
      }
    });
  });
}

async function openThread(root, state, thread) {
  state.view = 'thread';
  state.thread = thread;
  const phone = String(thread?.cardPhone || '').trim();
  const uei = String(thread?.uei || '').trim();
  screen(root, appHeader({ title: clientName(phone, uei), back: { data: 'data-chat-back', aria: 'К диалогам' } }), emptyState('Загрузка', 'Получаем переписку.'), 'app-view-shell--chat');
  try {
    const messages = withTimes(await getCommunicationThread({ phone, uei }));
    screen(root, appHeader({ title: clientName(phone, uei), back: { data: 'data-chat-back', aria: 'К диалогам' } }), `${messages.length ? messageThread(messages, { viewer: 'master', actions: true }) : emptyState('Сообщений пока нет', 'Напишите клиенту первое сообщение.')}${messageComposer({ placeholder: 'Написать сообщение...', attachments: true, rich: true })}<div class="muted" data-chat-status aria-live="polite"></div>`, 'app-view-shell--chat');
    root.querySelector('[data-chat-back]')?.addEventListener('click', () => void renderThreads(root, state));
    root.querySelectorAll('[data-message-actions]').forEach((control) => control.addEventListener('click', () => {
      const message = messages.find((item) => String(item.id) === String(control.dataset.messageActions));
      if (message) openMessageActions(root, state, thread, message);
    }));
    const form = root.querySelector('[data-message-composer]');
    const editor = bindRichTextEditor(form);
    const getAttachments = bindMessageAttachments(form);
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = editor.getValue();
      const attachments = getAttachments();
      if (!value.body && !attachments.length) return;
      const submit = form.querySelector('button[type="submit"]');
      const status = root.querySelector('[data-chat-status]');
      if (submit) submit.disabled = true;
      try {
        await sendCommunicationMessage({ phone, uei, body: value.body, content: value.content, attachments });
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
      subtitle: thread.deletedAt ? 'Сообщение удалено' : thread.body || (Array.isArray(thread.attachments) && thread.attachments.length ? 'Медиа' : 'Открыть диалог'),
      rightTop: messageTime(thread.createdAt),
      data: `data-chat-thread="${index}"`,
      aria: `Открыть диалог с ${clientName(thread.cardPhone, thread.uei)}`,
    }));
    screen(root, appHeader({ title: 'Сообщения', action: { label: 'Новое', data: 'data-chat-new' }, settings: { data: 'data-chat-settings', aria: 'Настройки сообщений' } }), items.length ? listEntries(items) : emptyState('Чат пока пуст', 'Сообщения и системные уведомления клиентов появятся здесь.'));
    root.querySelector('[data-chat-new]')?.addEventListener('click', () => recipientOptions(root, state));
    root.querySelector('[data-chat-settings]')?.addEventListener('click', openMasterChatSettings);
    root.querySelectorAll('[data-chat-thread]').forEach((element) => element.addEventListener('click', () => {
      const thread = threads[Number(element.dataset.chatThread)];
      if (thread) void openThread(root, state, thread);
    }));
  } catch (error) {
    screen(root, appHeader({ title: 'Сообщения', action: { label: 'Новое', data: 'data-chat-new' }, settings: { data: 'data-chat-settings', aria: 'Настройки сообщений' } }), emptyState('Чат недоступен', error instanceof Error ? error.message : 'Не удалось загрузить диалоги'));
    root.querySelector('[data-chat-new]')?.addEventListener('click', () => recipientOptions(root, state));
    root.querySelector('[data-chat-settings]')?.addEventListener('click', openMasterChatSettings);
  }
}

export function renderChat(root) {
  const state = { view: 'threads', thread: null, recipient: null };
  void renderThreads(root, state);
}

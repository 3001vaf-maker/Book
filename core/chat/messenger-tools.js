import {
  button,
  checkList,
  collectCheckList,
  field,
  initCheckList,
  modal,
  mountModal,
  openNotice,
  v2ListEntries,
  v2ListEntry,
} from '../../ui/ui.js';

function close(layer) {
  layer?.v2Close?.();
}

function personLabel(person = {}) {
  return [person?.name, person?.surname].filter(Boolean).join(' ').trim() || String(person?.uei || person?.key || 'Человек');
}

function personPhone(person = {}) {
  return String((Array.isArray(person?.phones) ? person.phones : []).find(Boolean) || '').trim();
}

export function openCreateGroup({ people = [], createGroup, onCreated } = {}) {
  if (typeof createGroup !== 'function') return null;
  const values = (Array.isArray(people) ? people : []).filter((person) => person?.key && (personPhone(person) || person?.uei));
  const list = checkList(values.map((person) => ({
    value: String(person.key),
    label: personLabel(person),
    secondary: personPhone(person) || String(person.uei || ''),
  })));
  const content = `<form data-messenger-group-form>${field({ label: 'Название группы', name: 'title', maxlength: 120, required: true })}<div class="field"><span>Участники</span>${list}</div>${button('Создать группу', { data: 'data-messenger-group-save' })}</form>`;
  const layer = mountModal(document.body, modal(content, {
    title: 'Новая группа',
    variant: 'q',
    surface: 'app',
  }));
  if (!layer) return null;
  initCheckList(layer);
  const form = layer.querySelector('[data-messenger-group-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const keys = new Set(collectCheckList(form));
    const participants = values.filter((person) => keys.has(String(person.key))).map((person) => ({
      phone: personPhone(person),
      uei: String(person?.uei || ''),
      display: personLabel(person),
    }));
    if (!title || !participants.length) {
      openNotice({ title: 'Группа не создана', message: 'Укажите название и хотя бы одного участника.' });
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const created = await createGroup({ title, participants });
      close(layer);
      await onCreated?.(created);
    } catch (error) {
      if (submit) submit.disabled = false;
      openNotice({ title: 'Группа не создана', message: error instanceof Error ? error.message : 'Не удалось создать группу' });
    }
  });
  return layer;
}

export function openCreatePoll({ conversationId = '', createPoll, onCreated } = {}) {
  if (!conversationId || typeof createPoll !== 'function') return null;
  const content = `<form data-messenger-poll-form>${field({ label: 'Вопрос', name: 'question', maxlength: 300, required: true })}${field({ label: 'Вариант 1', name: 'option1', maxlength: 120, required: true })}${field({ label: 'Вариант 2', name: 'option2', maxlength: 120, required: true })}${field({ label: 'Вариант 3', name: 'option3', maxlength: 120 })}${field({ label: 'Вариант 4', name: 'option4', maxlength: 120 })}${button('Создать опрос', { data: 'data-messenger-poll-save' })}</form>`;
  const layer = mountModal(document.body, modal(content, {
    title: 'Опрос',
    variant: 'x',
    surface: 'app',
    xRole: 'editor',
  }));
  const form = layer?.querySelector('[data-messenger-poll-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const question = String(data.get('question') || '').trim();
    const options = ['option1', 'option2', 'option3', 'option4'].map((name) => String(data.get(name) || '').trim()).filter(Boolean);
    if (!question || options.length < 2) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await createPoll(conversationId, { question, options });
      close(layer);
      await onCreated?.();
    } catch (error) {
      if (submit) submit.disabled = false;
      openNotice({ title: 'Опрос не создан', message: error instanceof Error ? error.message : 'Не удалось создать опрос' });
    }
  });
  return layer;
}

export function openThreadSearch({ conversationId = '', search, onResult } = {}) {
  if (!conversationId || typeof search !== 'function') return null;
  const content = `<form data-messenger-search-form>${field({ label: 'Поиск', name: 'query', maxlength: 120, required: true })}${button('Найти', { data: 'data-messenger-search-submit' })}</form>`;
  const layer = mountModal(document.body, modal(content, {
    title: 'Поиск в диалоге',
    variant: 'x',
    surface: 'app',
    xRole: 'editor',
  }));
  const form = layer?.querySelector('[data-messenger-search-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = String(new FormData(form).get('query') || '').trim();
    if (!query) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const results = await search({ query, conversationId });
      close(layer);
      const values = Array.isArray(results) ? results : [];
      const resultLayer = mountModal(document.body, modal(
        values.length
          ? v2ListEntries(values.map((message, index) => v2ListEntry({
            title: String(message?.body || 'Сообщение').slice(0, 120),
            rightTop: message?.createdAt ? new Date(message.createdAt).toLocaleDateString('ru-RU') : '',
            data: `data-messenger-search-result="${index}"`,
            aria: 'Открыть найденное сообщение',
          })))
          : '<p>Ничего не найдено.</p>',
        { title: 'Результаты поиска', variant: 'x', surface: 'app', xRole: 'picker' },
      ));
      resultLayer?.querySelectorAll('[data-messenger-search-result]').forEach((node) => node.addEventListener('click', () => {
        const message = values[Number(node.dataset.messengerSearchResult)];
        close(resultLayer);
        onResult?.(message);
      }));
    } catch (error) {
      if (submit) submit.disabled = false;
      openNotice({ title: 'Поиск недоступен', message: error instanceof Error ? error.message : 'Не удалось выполнить поиск' });
    }
  });
  return layer;
}

export function openConversationTools({
  conversation,
  actions,
  render,
  canCreatePoll = false,
  onSearchResult = null,
} = {}) {
  if (!conversation?.id || !actions) return null;
  const archived = Boolean(conversation.archivedAt);
  const muted = Boolean(conversation.mutedUntil && new Date(conversation.mutedUntil).getTime() > Date.now());
  const items = [
    v2ListEntry({ title: 'Поиск', data: 'data-messenger-tool="search"', aria: 'Поиск' }),
    canCreatePoll ? v2ListEntry({ title: 'Опрос', data: 'data-messenger-tool="poll"', aria: 'Создать опрос' }) : '',
    v2ListEntry({ title: archived ? 'Вернуть из архива' : 'Архивировать', data: 'data-messenger-tool="archive"', aria: archived ? 'Вернуть из архива' : 'Архивировать' }),
    v2ListEntry({ title: muted ? 'Включить звук' : 'Без звука', data: 'data-messenger-tool="mute"', aria: muted ? 'Включить звук' : 'Отключить звук' }),
  ].filter(Boolean);
  const layer = mountModal(document.body, modal(v2ListEntries(items), {
    title: 'Диалог',
    variant: 'x',
    surface: 'app',
    xRole: 'action',
  }));
  layer?.querySelectorAll('[data-messenger-tool]').forEach((node) => node.addEventListener('click', async () => {
    const tool = String(node.dataset.messengerTool || '');
    close(layer);
    if (tool === 'search') {
      openThreadSearch({ conversationId: conversation.id, search: actions.search, onResult: onSearchResult });
      return;
    }
    if (tool === 'poll' && canCreatePoll) {
      openCreatePoll({ conversationId: conversation.id, createPoll: actions.createPoll, onCreated: render });
      return;
    }
    if (tool === 'archive') {
      await actions.setConversationState(conversation.id, { archived: !archived, muted });
      await render?.();
      return;
    }
    if (tool === 'mute') {
      await actions.setConversationState(conversation.id, { archived, muted: !muted });
      await render?.();
    }
  }));
  return layer;
}

import { getNotificationRouting, saveNotificationRouting } from '../../core/notifications/routing.js';
import { getNotificationTemplates, saveNotificationTemplate } from '../../core/notifications/templates.js';
import { actionBlock, button, emptyState, escapeHtml, field, folderList, pageHeader, select, textareaField } from '../../ui/ui.js';

const CHANNEL_OPTIONS = [
  { value: '', label: 'Не использовать' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'EMAIL', label: 'Email' },
];

const VARIABLE_LABELS = {
  client: 'Имя клиента',
  date: 'Дата · 16.09.26',
  time: 'Время · 12:00',
  end_time: 'Окончание · 13:00',
  time_range: 'Время процедуры · 12:00-13:00',
  services: 'Услуги',
};

function policyFrom(items = [], eventType = '') {
  const current = (Array.isArray(items) ? items : []).find((item) => item.eventType === eventType)
    || { eventType, mode: 'always', channels: ['PUSH'] };
  return {
    ...current,
    channels: ['PUSH', ...(Array.isArray(current.channels) ? current.channels : []).filter((channel) => String(channel || '').toUpperCase() !== 'PUSH')],
  };
}

function normalizedExternalChannels(form) {
  const data = new FormData(form);
  return [...new Set([data.get('channel1'), data.get('channel2')]
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean))];
}

function templateVariables(template = {}) {
  const variables = Array.isArray(template.variables) ? template.variables : [];
  if (!variables.length) return '';
  const controls = variables.map((name) => `
    <button class="ui-button ui-button--secondary" type="button" data-template-variable="${escapeHtml(name)}">${escapeHtml(VARIABLE_LABELS[name] || name)}</button>`).join('');
  return `<div class="action-block"><strong>Вставить в текст</strong><div class="muted">Нажмите поле «Заголовок» или «Текст», затем нужную переменную. Переносы строк в тексте сохраняются.</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">${controls}</div></div>`;
}

function installVariableInsertion(form) {
  const title = form.querySelector('input[name="title"]');
  const body = form.querySelector('textarea[name="body"]');
  let target = body || title;
  [title, body].filter(Boolean).forEach((fieldNode) => {
    fieldNode.addEventListener('focus', () => { target = fieldNode; });
  });
  form.querySelectorAll('[data-template-variable]').forEach((control) => {
    control.addEventListener('click', () => {
      const fieldNode = target || body || title;
      if (!fieldNode) return;
      const token = `{{${control.dataset.templateVariable}}}`;
      const start = Number.isInteger(fieldNode.selectionStart) ? fieldNode.selectionStart : fieldNode.value.length;
      const end = Number.isInteger(fieldNode.selectionEnd) ? fieldNode.selectionEnd : start;
      fieldNode.value = `${fieldNode.value.slice(0, start)}${token}${fieldNode.value.slice(end)}`;
      const next = start + token.length;
      fieldNode.focus();
      fieldNode.setSelectionRange?.(next, next);
    });
  });
}

function deliveryFields(template, policy) {
  if (template.audience !== 'CLIENT') {
    return `<div class="action-block"><strong>В Book — всегда</strong><div class="muted">Это входящее уведомление мастеру. Внешние каналы мастера подключим отдельно, когда понадобится.</div></div>`;
  }
  const channels = (Array.isArray(policy.channels) ? policy.channels : []).filter((channel) => String(channel || '').toUpperCase() !== 'PUSH');
  return `
    <div class="action-block"><strong>Push — всегда</strong><div class="muted">Если клиент разрешил Push на устройстве. Внутри Book уведомление создаётся всегда.</div></div>
    ${select({ label: 'Внешние каналы', name: 'mode', value: policy.mode || 'always', options: [
      { value: 'always', label: 'Отправлять по всем выбранным каналам' },
      { value: 'fallback', label: 'Следующий канал, если предыдущий не доставлен' },
    ] })}
    ${select({ label: 'Канал 1', name: 'channel1', value: channels[0] || 'TELEGRAM', options: CHANNEL_OPTIONS })}
    ${select({ label: 'Канал 2', name: 'channel2', value: channels[1] || '', options: CHANNEL_OPTIONS })}`;
}

async function openTemplate(root, navigateBack, template) {
  root.innerHTML = `${pageHeader(template.name)}${emptyState('Загрузка', 'Получаем настройки шаблона.')}`;
  try {
    const routing = template.audience === 'CLIENT' ? await getNotificationRouting() : [];
    const policy = policyFrom(routing, template.key);
    root.innerHTML = `${pageHeader(template.name)}
      <form class="form-grid" data-notification-template-form>
        ${field({ label: 'Заголовок', name: 'title', value: template.title || '', required: true, maxlength: 160 })}
        ${textareaField({ label: 'Текст', name: 'body', value: template.body || '', rows: 7, maxlength: 2000, required: true })}
        ${templateVariables(template)}
        ${deliveryFields(template, policy)}
        <div class="muted" data-notification-template-status aria-live="polite"></div>
        ${actionBlock(`${button('Сохранить', { type: 'submit' })}${button('Назад', { type: 'button', variant: 'secondary', data: 'data-notification-template-back' })}`)}
      </form>`;
    root.querySelector('[data-notification-template-back]')?.addEventListener('click', navigateBack);
    const templateForm = root.querySelector('[data-notification-template-form]');
    if (templateForm) installVariableInsertion(templateForm);
    templateForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = root.querySelector('[data-notification-template-status]');
      const data = new FormData(form);
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const saved = await saveNotificationTemplate(template.key, {
          title: String(data.get('title') || ''),
          body: String(data.get('body') || ''),
        });
        if (template.audience === 'CLIENT') {
          await saveNotificationRouting(template.key, {
            mode: String(data.get('mode') || 'always'),
            channels: normalizedExternalChannels(form),
          });
        }
        Object.assign(template, saved);
        if (status) status.textContent = 'Сохранено.';
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось сохранить';
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  } catch (error) {
    root.innerHTML = `${pageHeader(template.name)}${emptyState('Настройки недоступны', error instanceof Error ? error.message : 'Не удалось загрузить шаблон')}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-notification-template-back' }))}`;
    root.querySelector('[data-notification-template-back]')?.addEventListener('click', navigateBack);
  }
}

function renderTemplateGroup(root, navigateBack, audience, title, templates) {
  const items = templates.map((template, index) => ({
    title: template.name,
    count: '',
    data: `data-notification-template="${index}"`,
    aria: `Открыть шаблон ${template.name}`,
  }));
  const masterMessageInfo = audience === 'MASTER'
    ? '<div class="action-block"><strong>Новое сообщение клиента</strong><div class="muted">Отдельный шаблон не нужен: мастеру показывается само сообщение клиента и счётчик непрочитанных.</div></div>'
    : '';
  root.innerHTML = `${pageHeader(title)}${masterMessageInfo}${items.length ? folderList(items) : emptyState('Шаблонов нет', 'Для этой группы шаблоны не настроены.')}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-notification-group-back' }))}`;
  root.querySelector('[data-notification-group-back]')?.addEventListener('click', navigateBack);
  root.querySelectorAll('[data-notification-template]').forEach((node) => node.addEventListener('click', () => {
    const template = templates[Number(node.dataset.notificationTemplate)];
    if (template) void openTemplate(root, () => renderTemplateGroup(root, navigateBack, audience, title, templates), template);
  }));
}

function openTemplateGroup(root, navigateBack, audience, title) {
  root.innerHTML = `${pageHeader(title)}${emptyState('Загрузка', 'Получаем шаблоны уведомлений.')}`;
  void getNotificationTemplates(audience).then((templates) => {
    renderTemplateGroup(root, navigateBack, audience, title, Array.isArray(templates) ? templates : []);
  }).catch((error) => {
    root.innerHTML = `${pageHeader(title)}${emptyState('Шаблоны недоступны', error instanceof Error ? error.message : 'Не удалось загрузить шаблоны')}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-notification-group-back' }))}`;
    root.querySelector('[data-notification-group-back]')?.addEventListener('click', navigateBack);
  });
}

async function openBroadcasts(root, navigateBack) {
  const { render } = await import('./broadcasts/broadcasts.js');
  render(root, navigateBack);
}

function renderNotifications(root, navigateBack) {
  root.innerHTML = `${pageHeader('Уведомления')}${folderList([
    { title: 'Клиенту', count: '4', data: 'data-communications-open="client"' },
    { title: 'Мастеру', count: '2', data: 'data-communications-open="master"' },
    { title: 'Рассылки', data: 'data-communications-open="broadcasts"' },
  ])}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-communications-back' }))}`;
  root.querySelector('[data-communications-open="client"]')?.addEventListener('click', () => openTemplateGroup(root, () => renderNotifications(root, navigateBack), 'CLIENT', 'Клиенту'));
  root.querySelector('[data-communications-open="master"]')?.addEventListener('click', () => openTemplateGroup(root, () => renderNotifications(root, navigateBack), 'MASTER', 'Мастеру'));
  root.querySelector('[data-communications-open="broadcasts"]')?.addEventListener('click', () => void openBroadcasts(root, () => renderNotifications(root, navigateBack)));
  root.querySelector('[data-communications-back]')?.addEventListener('click', navigateBack);
}

export function render(root, navigateBack = () => {}) {
  renderNotifications(root, navigateBack);
}

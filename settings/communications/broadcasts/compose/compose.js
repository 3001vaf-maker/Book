import { getBroadcastTemplates, previewBroadcast, sendBroadcast } from '../../../../core/communications/broadcasts.js';
import { actionBlock, button, emptyState, escapeHtml, field, pageHeader, select, textareaField } from '../../../../ui/ui.js';

const VARIABLES = [
  { token: '{{client.name}}', label: 'Имя', sample: 'Александр' },
  { token: '{{client.surname}}', label: 'Фамилия', sample: 'Петров' },
  { token: '{{client.code}}', label: 'Код клиента', sample: 'UEI-00123' },
  { token: '{{client.phone}}', label: 'Телефон', sample: '+7 999 000-00-00' },
  { token: '{{client.email}}', label: 'Email', sample: 'client@example.com' },
];

function phonesFrom(value) { return [...new Set(String(value || '').split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean))]; }
function sampleText(body = '') { return VARIABLES.reduce((value, variable) => value.replaceAll(variable.token, variable.sample), String(body || '')); }
function insertAtCursor(input, token) {
  const start = Number(input.selectionStart ?? input.value.length); const end = Number(input.selectionEnd ?? start);
  input.value = `${input.value.slice(0, start)}${token}${input.value.slice(end)}`; const next = start + token.length;
  input.focus(); input.setSelectionRange?.(next, next); input.dispatchEvent(new Event('input', { bubbles: true }));
}
function payloadFrom(form) {
  const data = new FormData(form); const audience = String(data.get('audience') || 'selected');
  return { name: String(data.get('name') || '').trim(), channel: 'TELEGRAM', all: audience === 'all', phones: audience === 'all' ? [] : phonesFrom(data.get('phones')), body: String(data.get('body') || '').trim() };
}

function renderForm(root, navigateBack, templates = []) {
  const templateOptions = [{ value: '', label: 'Без сохранённого шаблона' }, ...templates.map((template) => ({ value: template.id, label: template.name }))];
  const variableButtons = VARIABLES.map((variable) => button(variable.label, { type: 'button', variant: 'secondary', data: `data-broadcast-variable="${escapeHtml(variable.token)}"` })).join('');
  root.innerHTML = `${pageHeader('Новая рассылка')}
    <form class="form-grid" data-broadcast-compose>
      ${field({ label: 'Название рассылки', name: 'name', placeholder: 'Например: Свободное окно 15 сентября' })}
      ${select({ label: 'Шаблон', name: 'template', value: '', options: templateOptions })}
      <div class="action-block"><strong>Доставка</strong><div>Push — по умолчанию.</div><div class="muted">Telegram — внешний канал этой рассылки.</div></div>
      ${select({ label: 'Аудитория', name: 'audience', value: 'selected', options: [{ value: 'selected', label: 'Выбранные клиенты' }, { value: 'all', label: 'Все клиенты' }] })}
      ${textareaField({ label: 'Телефоны выбранных клиентов', name: 'phones', placeholder: 'По одному номеру в строке' })}
      <div class="action-block"><strong>Конструктор сообщения</strong><div class="muted">Временный рабочий конструктор. Финальный UI будет собран штатными элементами Book.</div><div class="modal-actions">${variableButtons}</div></div>
      <label class="form-field"><span>Текст</span><textarea name="body" rows="8" placeholder="Например: Здравствуйте, {{client.name}}!"></textarea></label>
      <div class="action-block"><strong>Как увидит клиент</strong><div class="muted" data-broadcast-message-preview>Начните вводить текст.</div></div>
      <div class="muted">Перед отправкой Book проверит согласие и доступность Telegram у каждого клиента.</div>
      <div class="muted" data-broadcast-result aria-live="polite"></div>
      ${actionBlock(`${button('Проверить аудиторию', { type: 'submit' })}${button('Отправить', { type: 'button', variant: 'secondary', data: 'data-broadcast-send' })}${button('Назад', { type: 'button', variant: 'secondary', data: 'data-broadcast-back' })}`)}
    </form>`;
  const form = root.querySelector('[data-broadcast-compose]'); const result = root.querySelector('[data-broadcast-result]'); const send = root.querySelector('[data-broadcast-send]');
  const bodyInput = form?.querySelector('[name="body"]'); const nameInput = form?.querySelector('[name="name"]'); const messagePreview = root.querySelector('[data-broadcast-message-preview]'); let lastPreview = null;
  if (send) send.disabled = true;
  const refreshMessagePreview = () => { if (!messagePreview) return; const value = sampleText(bodyInput?.value || ''); messagePreview.innerHTML = value ? escapeHtml(value).replaceAll('\n', '<br>') : 'Начните вводить текст.'; };
  root.querySelectorAll('[data-broadcast-variable]').forEach((control) => control.addEventListener('click', () => { if (bodyInput) insertAtCursor(bodyInput, String(control.dataset.broadcastVariable || '')); }));
  root.querySelector('[name="template"]')?.addEventListener('change', (event) => { const template = templates.find((item) => item.id === event.currentTarget.value); if (!template) return; if (bodyInput) bodyInput.value = String(template.body || ''); if (nameInput && !nameInput.value.trim()) nameInput.value = String(template.name || ''); refreshMessagePreview(); lastPreview = null; if (send) send.disabled = true; });
  root.querySelector('[name="audience"]')?.addEventListener('change', (event) => { const phones = root.querySelector('[name="phones"]'); if (phones) phones.disabled = event.currentTarget.value === 'all'; lastPreview = null; if (send) send.disabled = true; });
  bodyInput?.addEventListener('input', refreshMessagePreview); form?.addEventListener('input', () => { lastPreview = null; if (send) send.disabled = true; });
  form?.addEventListener('submit', async (event) => { event.preventDefault(); if (result) result.textContent = 'Проверяем аудиторию…'; try { const payload = payloadFrom(form); if (!payload.name) throw new Error('Введите название рассылки.'); if (!payload.body) throw new Error('Введите текст рассылки.'); lastPreview = await previewBroadcast(payload); if (result) result.textContent = `Telegram: можно отправить ${lastPreview.eligibleCount}. Исключено: ${lastPreview.excludedCount}.`; if (send) send.disabled = !lastPreview.eligibleCount; } catch (error) { lastPreview = null; if (send) send.disabled = true; if (result) result.textContent = error instanceof Error ? error.message : 'Не удалось проверить аудиторию'; } });
  send?.addEventListener('click', async () => { if (!lastPreview) return; const payload = payloadFrom(form); send.disabled = true; if (result) result.textContent = 'Отправляем…'; try { const sent = await sendBroadcast(payload); if (result) result.textContent = `Telegram отправлено: ${sent.sentCount}. Ошибок: ${sent.failedCount}.`; lastPreview = null; } catch (error) { if (result) result.textContent = error instanceof Error ? error.message : 'Не удалось отправить рассылку'; send.disabled = false; } });
  root.querySelector('[data-broadcast-back]')?.addEventListener('click', navigateBack);
}

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Новая рассылка')}${emptyState('Загрузка', 'Получаем шаблоны сообщений.')}`;
  void getBroadcastTemplates().then((templates) => renderForm(root, navigateBack, Array.isArray(templates) ? templates : [])).catch(() => renderForm(root, navigateBack, []));
}

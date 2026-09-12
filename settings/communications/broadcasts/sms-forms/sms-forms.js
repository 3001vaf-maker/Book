import { deleteBroadcastTemplate, getBroadcastTemplates, saveBroadcastTemplate } from '../../../../core/communications/broadcasts.js';
import { actionBlock, button, emptyState, escapeHtml, field, folderList, pageHeader } from '../../../../ui/ui.js';

function renderEditor(root, navigateBack, template = null) {
  const id = String(template?.id || '');
  root.innerHTML = `${pageHeader(id ? 'Шаблон сообщения' : 'Новый шаблон')}
    <form class="form-grid" data-template-form>
      ${field({ label: 'Название шаблона', name: 'name', value: String(template?.name || ''), placeholder: 'Например: Напоминание о записи' })}
      <label class="form-field"><span>Текст сообщения</span><textarea name="body" rows="8">${escapeHtml(String(template?.body || ''))}</textarea></label>
      <div class="muted">Переменные поддерживаются сервером. Финальный селектор данных будет собран штатным UI Book отдельно.</div>
      <div class="muted" data-template-status aria-live="polite"></div>
      ${actionBlock(`${button('Сохранить шаблон', { type: 'submit' })}${id ? button('Удалить', { type: 'button', variant: 'danger', data: 'data-template-delete' }) : ''}${button('Назад', { type: 'button', variant: 'secondary', data: 'data-template-back' })}`)}
    </form>`;
  const form = root.querySelector('[data-template-form]'); const status = root.querySelector('[data-template-status]');
  root.querySelector('[data-template-back]')?.addEventListener('click', navigateBack);
  form?.addEventListener('submit', async (event) => {
    event.preventDefault(); const data = new FormData(form); if (status) status.textContent = 'Сохраняем…';
    try { await saveBroadcastTemplate({ id, name: String(data.get('name') || '').trim(), body: String(data.get('body') || '').trim() }); navigateBack(); }
    catch (error) { if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось сохранить'; }
  });
  root.querySelector('[data-template-delete]')?.addEventListener('click', async () => {
    try { await deleteBroadcastTemplate(id); navigateBack(); }
    catch (error) { if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось удалить'; }
  });
}

async function renderList(root, navigateBack) {
  root.innerHTML = `${pageHeader('Шаблоны сообщений')}${emptyState('Загрузка', 'Получаем шаблоны.')}`;
  try {
    const templates = await getBroadcastTemplates(); const list = Array.isArray(templates) ? templates : [];
    root.innerHTML = `${pageHeader('Шаблоны сообщений')}${button('+ Новый шаблон', { data: 'data-template-new' })}${list.length ? folderList(list.map((template, index) => ({ title: template.name, count: 'Шаблон', data: `data-template-open="${index}"` }))) : emptyState('Шаблонов пока нет', 'Создайте первый шаблон сообщения.')}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-template-list-back' }))}`;
    root.querySelector('[data-template-new]')?.addEventListener('click', () => renderEditor(root, () => void renderList(root, navigateBack)));
    root.querySelectorAll('[data-template-open]').forEach((control) => control.addEventListener('click', () => { const template = list[Number(control.dataset.templateOpen)]; if (template) renderEditor(root, () => void renderList(root, navigateBack), template); }));
    root.querySelector('[data-template-list-back]')?.addEventListener('click', navigateBack);
  } catch (error) {
    root.innerHTML = `${pageHeader('Шаблоны сообщений')}${emptyState('Шаблоны недоступны', error instanceof Error ? error.message : 'Не удалось загрузить шаблоны')}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-template-list-back' }))}`;
    root.querySelector('[data-template-list-back]')?.addEventListener('click', navigateBack);
  }
}
export function render(root, navigateBack = () => {}) { void renderList(root, navigateBack); }

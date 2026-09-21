function formatMoment(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function kindLabel(value) {
  if (value === 'REQUIRED_ACTION') return 'Обязательное действие';
  if (value === 'REQUIRED_INFO') return 'Обязательное ознакомление';
  if (value === 'OPTIONAL_INFO') return 'Ознакомительный';
  return 'Системный';
}

function statusLabel(value) {
  if (value === 'PUBLISHED') return 'Опубликована';
  if (value === 'DRAFT') return 'Черновик';
  return 'Архив';
}

function stepRow(step, escapeHtml) {
  return `<div class="admin-scenario-step" draggable="true" data-scenario-step="${escapeHtml(step.key)}">
    <div class="admin-scenario-step__move">
      <button type="button" data-step-up aria-label="Поднять">↑</button>
      <button type="button" data-step-down aria-label="Опустить">↓</button>
    </div>
    <button type="button" class="admin-scenario-step__main" data-step-edit>
      <strong>${escapeHtml(step.title)}</strong>
      <span>${escapeHtml(kindLabel(step.kind))}</span>
    </button>
    <button type="button" class="admin-button secondary" data-step-preview>Предпросмотр</button>
  </div>`;
}

function openPreview(step) {
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-preview-backdrop';
  backdrop.innerHTML = `<div class="admin-preview-shell">
    <div class="admin-preview-head">
      <strong>Предпросмотр</strong>
      <button type="button" class="admin-close" data-preview-close aria-label="Закрыть">×</button>
    </div>
    <iframe class="admin-preview-frame" src="./first-run-preview.html" title="Предпросмотр экрана"></iframe>
  </div>`;
  document.body.append(backdrop);
  backdrop.querySelector('[data-preview-close]')?.addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.remove(); });
  const frame = backdrop.querySelector('iframe');
  frame?.addEventListener('load', () => {
    frame.contentWindow?.postMessage({ type: 'first-run-preview', step }, location.origin);
  });
}

function openEditor(step, { request, escapeHtml, onSaved }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-drawer-backdrop';
  backdrop.innerHTML = `
    <aside class="admin-drawer admin-document-drawer">
      <div class="admin-drawer-head">
        <div><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.key)}</p></div>
        <button class="admin-close" data-close aria-label="Закрыть">×</button>
      </div>
      <form class="admin-form" data-step-form>
        <label class="admin-field"><span>Название этапа</span><input name="title" value="${escapeHtml(step.title)}" required></label>
        <label class="admin-field"><span>Тип</span>
          <select name="kind">
            ${['REQUIRED_ACTION','REQUIRED_INFO','OPTIONAL_INFO','SYSTEM'].map((value) => `<option value="${value}" ${step.kind === value ? 'selected' : ''}>${kindLabel(value)}</option>`).join('')}
          </select>
        </label>
        <label class="admin-field"><span>Заголовок модального окна</span><input name="modalTitle" value="${escapeHtml(step.modalTitle)}" required></label>
        <label class="admin-field"><span>Текст модального окна</span><textarea name="modalBody" rows="12" required>${escapeHtml(step.modalBody)}</textarea></label>
        <div class="admin-two-fields">
          <label class="admin-field"><span>Основная кнопка</span><input name="primaryLabel" value="${escapeHtml(step.primaryLabel || '')}"></label>
          <label class="admin-field"><span>Кнопка пропуска</span><input name="skipLabel" value="${escapeHtml(step.skipLabel || '')}"></label>
        </div>
        <label class="admin-check"><input type="checkbox" name="isActive" ${step.isActive !== false ? 'checked' : ''}><span>Этап включён</span></label>
        <div class="admin-actions">
          <button type="button" class="admin-button secondary" data-preview-current>Предпросмотр</button>
          <button type="submit" class="admin-button">Сохранить в черновик</button>
        </div>
        <p class="admin-inline-message" data-message></p>
      </form>
    </aside>`;
  document.body.append(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector('[data-close]')?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });

  const form = backdrop.querySelector('[data-step-form]');
  const stepFromForm = () => {
    const data = new FormData(form);
    return {
      ...step,
      title: String(data.get('title') || '').trim(),
      kind: String(data.get('kind') || ''),
      modalTitle: String(data.get('modalTitle') || '').trim(),
      modalBody: String(data.get('modalBody') || '').trim(),
      primaryLabel: String(data.get('primaryLabel') || '').trim(),
      skipLabel: String(data.get('skipLabel') || '').trim(),
      isActive: Boolean(data.get('isActive')),
    };
  };

  backdrop.querySelector('[data-preview-current]')?.addEventListener('click', () => openPreview(stepFromForm()));
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = backdrop.querySelector('[data-message]');
    message.textContent = '';
    try {
      const next = stepFromForm();
      await request(`/first-run-scenario/steps/${encodeURIComponent(step.key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      message.textContent = 'Черновик сохранён.';
      await onSaved();
      close();
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось сохранить';
      message.classList.add('error');
    }
  });
}

function analyticsMarkup(rows, escapeHtml) {
  if (!Array.isArray(rows) || !rows.length) return '<div class="admin-card admin-empty-card">Данных пока нет.</div>';
  return rows.map((version) => `
    <section class="admin-card admin-analytics-card">
      <div class="admin-documents-head">
        <div><h3>Версия ${escapeHtml(version.version)}</h3><p>${escapeHtml(statusLabel(version.status))} · назначено: ${escapeHtml(version.assigned)} · завершили: ${escapeHtml(version.completed)}</p></div>
      </div>
      <div class="admin-document-list">
        ${version.steps.map((step) => `<div class="admin-analytics-row">
          <strong>${escapeHtml(step.title)}</strong>
          <span>показано ${escapeHtml(step.shown)}</span>
          <span>завершено ${escapeHtml(step.completed)}</span>
          <span>пропущено ${escapeHtml(step.skipped)}</span>
        </div>`).join('')}
      </div>
    </section>`).join('');
}

export async function renderFirstRunAdmin(root, {
  request,
  escapeHtml,
  setTitle,
} = {}) {
  setTitle('Первое знакомство');
  root.innerHTML = '<div class="admin-card admin-empty-card">Загрузка сценария…</div>';

  let scenario;
  let analytics;
  try {
    [scenario, analytics] = await Promise.all([
      request('/first-run-scenario'),
      request('/first-run-analytics'),
    ]);
  } catch (error) {
    root.innerHTML = `<div class="admin-card admin-empty-card">${escapeHtml(error instanceof Error ? error.message : 'Не удалось загрузить сценарий')}</div>`;
    return;
  }

  let tab = 'scenario';

  const redraw = () => {
    const published = scenario?.published || null;
    const draft = scenario?.draft || null;
    const editing = draft || published;
    root.innerHTML = `
      <div class="admin-heading">
        <div><h2>Первое знакомство</h2><p>Порядок этапов, тексты, версии, предпросмотр и прохождение.</p></div>
        <div class="admin-actions" style="margin-top:0">
          ${draft ? '<button class="admin-button" data-publish>Опубликовать черновик</button>' : '<button class="admin-button" data-create-draft>Создать черновик</button>'}
        </div>
      </div>
      <div class="admin-documents-tabs">
        <button type="button" data-tab="scenario" class="${tab === 'scenario' ? 'is-active' : ''}">Сценарий</button>
        <button type="button" data-tab="analytics" class="${tab === 'analytics' ? 'is-active' : ''}">Аналитика</button>
        <button type="button" data-tab="versions" class="${tab === 'versions' ? 'is-active' : ''}">Версии</button>
      </div>
      <div data-tab-content></div>`;

    root.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
      tab = button.dataset.tab;
      redraw();
    }));

    const content = root.querySelector('[data-tab-content]');
    if (tab === 'analytics') {
      content.innerHTML = analyticsMarkup(analytics, escapeHtml);
    } else if (tab === 'versions') {
      content.innerHTML = `<section class="admin-card"><div class="admin-document-list">
        ${(scenario?.versions || []).map((version) => `<div class="admin-history-row">
          <strong>Версия ${escapeHtml(version.version)}</strong>
          <span>${escapeHtml(statusLabel(version.status))}</span>
          <span>${escapeHtml(formatMoment(version.publishedAt || version.createdAt))}</span>
        </div>`).join('')}
      </div></section>`;
    } else if (!editing) {
      content.innerHTML = '<div class="admin-card admin-empty-card">Сценарий ещё не создан.</div>';
    } else {
      content.innerHTML = `
        <section class="admin-card admin-scenario-card">
          <div class="admin-documents-head">
            <div>
              <h3>${draft ? `Черновик · версия ${escapeHtml(draft.version)}` : `Опубликовано · версия ${escapeHtml(published.version)}`}</h3>
              <p>${draft ? 'Изменения увидят только пользователи, активировавшие ссылку после публикации.' : 'Создайте черновик, чтобы изменить тексты или порядок.'}</p>
            </div>
          </div>
          <div class="admin-scenario-list" data-scenario-list>
            ${(editing.steps || []).map((step) => stepRow(step, escapeHtml)).join('')}
          </div>
        </section>`;
      bindScenarioList(content, editing, Boolean(draft));
    }

    root.querySelector('[data-create-draft]')?.addEventListener('click', async () => {
      scenario = await request('/first-run-scenario/draft', { method: 'POST' });
      redraw();
    });
    root.querySelector('[data-publish]')?.addEventListener('click', async () => {
      scenario = await request('/first-run-scenario/publish', { method: 'POST' });
      analytics = await request('/first-run-analytics');
      redraw();
    });
  };

  const bindScenarioList = (content, editing, canEdit) => {
    const list = content.querySelector('[data-scenario-list]');
    if (!list) return;

    const persistOrder = async () => {
      if (!canEdit) return;
      const keys = [...list.querySelectorAll('[data-scenario-step]')].map((row) => row.dataset.scenarioStep);
      scenario = await request('/first-run-scenario/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepKeys: keys }),
      });
    };

    const move = async (row, delta) => {
      if (!canEdit) return;
      const sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling) return;
      if (delta < 0) list.insertBefore(row, sibling);
      else list.insertBefore(sibling, row);
      await persistOrder();
    };

    list.querySelectorAll('[data-scenario-step]').forEach((row) => {
      const key = row.dataset.scenarioStep;
      const step = (editing.steps || []).find((item) => item.key === key);
      row.querySelector('[data-step-up]')?.addEventListener('click', () => void move(row, -1));
      row.querySelector('[data-step-down]')?.addEventListener('click', () => void move(row, 1));
      row.querySelector('[data-step-preview]')?.addEventListener('click', () => step && openPreview(step));
      row.querySelector('[data-step-edit]')?.addEventListener('click', () => {
        if (!step) return;
        if (!canEdit) {
          openPreview(step);
          return;
        }
        openEditor(step, {
          request,
          escapeHtml,
          onSaved: async () => {
            scenario = await request('/first-run-scenario');
            redraw();
          },
        });
      });
      row.addEventListener('dragstart', (event) => {
        if (!canEdit) { event.preventDefault(); return; }
        row.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', key);
      });
      row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
      row.addEventListener('dragover', (event) => {
        if (!canEdit) return;
        event.preventDefault();
        const dragging = list.querySelector('.is-dragging');
        if (!dragging || dragging === row) return;
        const rect = row.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        list.insertBefore(dragging, before ? row : row.nextSibling);
      });
      row.addEventListener('drop', (event) => {
        if (!canEdit) return;
        event.preventDefault();
        void persistOrder();
      });
    });
  };

  redraw();
}

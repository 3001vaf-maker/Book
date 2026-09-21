import { apiRequest } from '../../core/auth.js';
import { actionBlock, button, emptyState, escapeHtml, list, page, pageHeader } from '../../ui/ui.js';

async function request(path, options = {}) {
  const response = await apiRequest(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Не удалось загрузить настройки');
  return payload;
}

function moment(value) {
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

function actionText(action) {
  if (action === 'CONSENTED') return 'Дано';
  if (action === 'REVOKED') return 'Отозвано';
  if (action === 'DECLINED') return 'Не дано';
  return action || 'Не дано';
}

function consentMarkup(consents) {
  if (!consents.length) return emptyState('Согласий пока нет', 'Здесь появятся отдельные согласия, которые относятся к вашей учётной записи.');
  return `<div class="account-controls-list">${consents.map((item) => `
    <section class="account-controls-card">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(actionText(item.action))} · версия ${escapeHtml(item.eventVersion || item.currentVersion || '—')}</span>
        ${item.occurredAt ? `<small>${escapeHtml(moment(item.occurredAt))}</small>` : ''}
      </div>
      ${button(item.active ? 'Отозвать' : 'Дать согласие', {
        variant: item.active ? 'secondary' : 'primary',
        data: `data-consent-toggle="${escapeHtml(item.key)}" data-active="${item.active ? 'true' : 'false'}"`,
      })}
    </section>`).join('')}</div>`;
}

function historyMarkup(history) {
  if (!history.length) return emptyState('История пока пуста', 'Изменения согласий будут сохраняться здесь.');
  return list({
    items: history.map((item) => ({
      title: item.title,
      secondary: `${actionText(item.action)} · версия ${item.version} · ${moment(item.occurredAt)}`,
    })),
  });
}

function renderState(root, navigateBack, state, view = 'root') {
  if (view === 'history') {
    root.innerHTML = page([
      pageHeader('История согласий'),
      historyMarkup(Array.isArray(state.history) ? state.history : []),
      actionBlock(button('Назад', { variant: 'secondary', data: 'data-controls-root' })),
    ]);
    root.querySelector('[data-controls-root]')?.addEventListener('click', () => renderState(root, navigateBack, state));
    return;
  }

  const emailEnabled = state.serviceNotifications?.email !== false;
  root.innerHTML = page([
    pageHeader('Согласия и уведомления'),
    `<section class="account-controls-section">
      <div class="section-heading"><h2>Согласия</h2></div>
      ${consentMarkup(Array.isArray(state.consents) ? state.consents : [])}
      <div class="account-controls-history-link">${button('История согласий', { variant: 'secondary', data: 'data-consent-history' })}</div>
    </section>`,
    `<section class="account-controls-section">
      <div class="section-heading"><h2>Сервисные уведомления</h2></div>
      <label class="account-controls-switch">
        <span><strong>Email</strong><small>Сервисные сообщения по вашей учётной записи.</small></span>
        <input type="checkbox" data-service-email ${emailEnabled ? 'checked' : ''}>
      </label>
      <p class="muted">Показываются только реально подключённые сервисные каналы. Телефон появится после подключения соответствующего модуля.</p>
      <div class="muted" data-controls-status></div>
    </section>`,
    actionBlock(button('Назад', { variant: 'secondary', data: 'data-controls-back' })),
  ]);

  root.querySelector('[data-controls-back]')?.addEventListener('click', navigateBack);
  root.querySelector('[data-consent-history]')?.addEventListener('click', () => renderState(root, navigateBack, state, 'history'));

  root.querySelectorAll('[data-consent-toggle]').forEach((control) => {
    control.addEventListener('click', async () => {
      const key = control.dataset.consentToggle;
      const active = control.dataset.active === 'true';
      control.disabled = true;
      try {
        const next = await request(`/profile/account-controls/consents/${encodeURIComponent(key)}`, {
          method: 'PUT',
          body: JSON.stringify({ active: !active }),
        });
        renderState(root, navigateBack, next);
      } catch (error) {
        control.disabled = false;
        const status = root.querySelector('[data-controls-status]');
        if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось изменить согласие';
      }
    });
  });

  root.querySelector('[data-service-email]')?.addEventListener('change', async (event) => {
    const input = event.currentTarget;
    const status = root.querySelector('[data-controls-status]');
    input.disabled = true;
    if (status) status.textContent = 'Сохраняем…';
    try {
      const next = await request('/profile/account-controls/service-notifications', {
        method: 'PUT',
        body: JSON.stringify({ email: input.checked }),
      });
      if (status) status.textContent = 'Сохранено.';
      input.checked = next.serviceNotifications?.email !== false;
    } catch (error) {
      input.checked = !input.checked;
      if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось сохранить';
    } finally {
      input.disabled = false;
    }
  });
}

export async function renderAccountControls(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Согласия и уведомления')}${emptyState('Загрузка', 'Получаем актуальные состояния.')}`;
  try {
    const state = await request('/profile/account-controls');
    renderState(root, navigateBack, state);
  } catch (error) {
    root.innerHTML = page([
      pageHeader('Согласия и уведомления'),
      emptyState('Раздел недоступен', error instanceof Error ? error.message : 'Не удалось загрузить данные'),
      actionBlock(button('Назад', { variant: 'secondary', data: 'data-controls-back' })),
    ]);
    root.querySelector('[data-controls-back]')?.addEventListener('click', navigateBack);
  }
}

export { renderAccountControls as render };

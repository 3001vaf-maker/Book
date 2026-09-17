import { apiRequest } from '../core/auth.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

async function testRequest(path = '', options = {}) {
  const response = await apiRequest(`/saas-admin/test-masters${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Ошибка TEST-контура');
  return payload;
}

function injectButton() {
  const nav = document.querySelector('.admin-nav');
  if (!nav || nav.querySelector('[data-test-panel]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testPanel = 'true';
  button.textContent = 'Тестирование';
  button.addEventListener('click', () => renderTestPanel());
  nav.append(button);
}

function activatePanel() {
  document.querySelectorAll('.admin-nav button').forEach((button) => button.classList.remove('is-active'));
  document.querySelector('[data-test-panel]')?.classList.add('is-active');
  const title = document.querySelector('[data-toolbar-title]');
  if (title) title.textContent = 'Тестирование';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
}

function testItem(item) {
  const registration = item.registered ? 'зарегистрирован' : 'ожидает TEST-регистрацию';
  return `<div class="admin-test-item">
    <div class="admin-test-item-main">
      <strong>${escapeHtml(item.tenantName)}</strong>
      <small>TEST · ${escapeHtml(item.operationMode || 'DEMO')} · ${escapeHtml(item.filingStatus || 'NOT_PREPARED')} · ${registration}</small>
      <small>${escapeHtml(item.userEmail || '')}${item.createdAt ? ` · ${formatDate(item.createdAt)}` : ''}</small>
    </div>
    <div class="admin-test-actions">
      <button class="admin-button danger" type="button" data-remove-test="${escapeHtml(item.tenantId)}">Удалить TEST</button>
    </div>
  </div>`;
}

async function renderTestPanel() {
  activatePanel();
  const content = document.querySelector('[data-content]');
  if (!content) return;
  content.innerHTML = '<div class="admin-card" style="padding:20px">Загружаем TEST-контур…</div>';
  try {
    const items = await testRequest();
    content.innerHTML = `
      <div class="admin-heading"><div><h2>TEST-контур мастера</h2><p>Полный безопасный путь без реальных персональных данных и без внешних сообщений.</p></div></div>
      <div class="admin-test-banner">
        <strong>TEST и DEMO — это разные вещи.</strong>
        <p>TEST означает синтетического мастера. DEMO означает режим работы Tenant. TEST Book навсегда заблокирован от перехода в LIVE на уровне базы данных.</p>
      </div>
      <section class="admin-invite-panel">
        <h3>Создать синтетического мастера</h3>
        <form class="admin-invite-grid" data-test-create-form>
          <label class="admin-field"><span>Имя для теста</span><input name="name" placeholder="Например: Тест Анна"></label>
          <div></div>
          <button class="admin-button" type="submit">Создать TEST мастера</button>
        </form>
        <p class="admin-inline-message" data-test-create-message></p>
        <div data-test-link-slot></div>
      </section>
      <section class="admin-card" style="padding:18px">
        <h3 style="margin-top:0">Созданные TEST Book</h3>
        <div class="admin-test-list">${Array.isArray(items) && items.length ? items.map(testItem).join('') : '<p style="color:#817a74">TEST мастеров пока нет.</p>'}</div>
      </section>`;

    const form = content.querySelector('[data-test-create-form]');
    const message = content.querySelector('[data-test-create-message]');
    const linkSlot = content.querySelector('[data-test-link-slot]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      button.disabled = true;
      message.textContent = '';
      message.classList.remove('error');
      try {
        const created = await testRequest('', {
          method: 'POST',
          body: JSON.stringify({ name: data.get('name') }),
        });
        const relative = String(created.invitePath || '').replace(/^\/invite\//, '../invite/');
        const inviteUrl = new URL(relative || '../invite/', location.href).href;
        linkSlot.innerHTML = `<div class="admin-test-link"><strong>TEST-ссылка:</strong><br>${escapeHtml(inviteUrl)}<div class="admin-test-actions" style="margin-top:10px"><a class="admin-button" href="${escapeHtml(inviteUrl)}" target="_blank" rel="noopener">Открыть TEST-регистрацию</a></div></div>`;
        message.textContent = 'Синтетический мастер создан. Открой TEST-ссылку и пройди регистрацию как мастер.';
      } catch (error) {
        message.textContent = error instanceof Error ? error.message : 'Не удалось создать TEST мастера';
        message.classList.add('error');
      } finally {
        button.disabled = false;
      }
    });

    content.querySelectorAll('[data-remove-test]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!window.confirm('Удалить этот синтетический TEST Book целиком?')) return;
        button.disabled = true;
        try {
          await testRequest(`/${encodeURIComponent(button.dataset.removeTest)}`, { method: 'DELETE' });
          await renderTestPanel();
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'Не удалось удалить TEST Book');
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    content.innerHTML = `<div class="admin-card" style="padding:20px;color:#a33d32">${escapeHtml(error instanceof Error ? error.message : 'Не удалось открыть TEST-контур')}</div>`;
  }
}

const observer = new MutationObserver(() => injectButton());
observer.observe(document.documentElement, { childList: true, subtree: true });
injectButton();

import { apiRequest } from '../core/auth.js';

let loading = false;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
}

async function injectAcceptanceLedger() {
  const content = document.querySelector('[data-content]');
  if (!content || loading || content.querySelector('[data-legal-acceptance-ledger]')) return;
  const heading = content.querySelector('.admin-heading h2');
  if (!heading || heading.textContent.trim() !== 'Юридическая готовность Book') return;

  loading = true;
  const section = document.createElement('section');
  section.className = 'admin-legal-card';
  section.dataset.legalAcceptanceLedger = 'true';
  section.innerHTML = '<h3>Принятие документов мастерами</h3><p class="admin-legal-note">Загружаем evidence…</p>';
  content.append(section);

  try {
    const response = await apiRequest('/platform/legal/acceptances');
    const rows = await response.json().catch(() => []);
    if (!response.ok) throw new Error(rows?.message || 'Не удалось загрузить принятия документов');
    const items = Array.isArray(rows) ? rows : [];
    section.innerHTML = `
      <h3>Принятие документов мастерами</h3>
      <p class="admin-legal-note">Каждая строка привязана к конкретной неизменяемой версии документа.</p>
      <div class="admin-card" style="margin-top:12px;overflow:auto">
        <table class="admin-table">
          <thead><tr><th>Мастер / Book</th><th>Документ</th><th>Версия</th><th>Факт</th><th>Дата</th></tr></thead>
          <tbody>${items.length ? items.map((item) => {
            const test = String(item.tenantName || '').startsWith('[TEST]');
            return `<tr style="cursor:default"><td><strong>${escapeHtml(item.email || '')}</strong><br><small>${escapeHtml(item.tenantName || '—')} ${test ? '· TEST' : '· REAL'}</small></td><td>${escapeHtml(item.documentTitle || item.documentKey || '')}<br><small>${escapeHtml(item.documentKey || '')}</small></td><td>v${Number(item.documentVersion || 1)}<br><small>${escapeHtml(String(item.contentHash || '').slice(0, 12))}</small></td><td>${escapeHtml(item.action || '')}<br><small>${escapeHtml(item.source || '')}</small></td><td>${formatDate(item.occurredAt)}</td></tr>`;
          }).join('') : '<tr><td colspan="5">Пока нет зафиксированных принятий документов.</td></tr>'}</tbody>
        </table>
      </div>`;
  } catch (error) {
    section.innerHTML = `<h3>Принятие документов мастерами</h3><p class="admin-legal-error">${escapeHtml(error instanceof Error ? error.message : 'Не удалось загрузить evidence')}</p>`;
  } finally {
    loading = false;
  }
}

const observer = new MutationObserver(() => injectAcceptanceLedger());
observer.observe(document.documentElement, { childList: true, subtree: true });
injectAcceptanceLedger();

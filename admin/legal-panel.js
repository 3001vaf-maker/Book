import { apiRequest } from '../core/auth.js';

const CHECKLIST_LABELS = {
  operatorDocumentsPublished: 'Документы оператора опубликованы',
  privacyPolicyPublished: 'Политика обработки ПД опубликована',
  consentFormsPrepared: 'Формы согласий подготовлены',
  saasAgreementPublished: 'SaaS-оферта опубликована',
  dpaPublished: 'DPA опубликовано',
  operatorIdentityConfigured: 'Реквизиты оператора зафиксированы',
  rknFilingConfirmed: 'Подача в Роскомнадзор подтверждена',
  productionInfrastructureChecked: 'Production-инфраструктура проверена',
};

const DOCUMENT_PRESETS = [
  { key: 'privacy-policy', title: 'Политика обработки персональных данных', type: 'PRIVACY_POLICY', requiredForRegistration: true },
  { key: 'saas-agreement', title: 'SaaS-оферта / договор использования Book', type: 'SAAS_AGREEMENT', requiredForRegistration: true },
  { key: 'dpa', title: 'Поручение на обработку персональных данных (DPA)', type: 'DPA', requiredForRegistration: true },
  { key: 'master-pd-consent', title: 'Согласие мастера на обработку персональных данных', type: 'MASTER_PD_CONSENT', requiredForRegistration: true },
  { key: 'marketing-consent', title: 'Согласие на рекламные и маркетинговые сообщения', type: 'MARKETING_CONSENT', requiredForRegistration: false },
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU');
}

async function legalRequest(path, options = {}) {
  const response = await apiRequest(`/platform/legal${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Ошибка юридического раздела');
  return payload;
}

function injectButton() {
  const nav = document.querySelector('.admin-nav');
  if (!nav || nav.querySelector('[data-legal-panel]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.legalPanel = 'true';
  button.textContent = 'Юридическая готовность';
  button.addEventListener('click', () => renderLegalPanel());
  nav.append(button);
}

function activatePanel() {
  document.querySelectorAll('.admin-nav button').forEach((button) => button.classList.remove('is-active'));
  document.querySelector('[data-legal-panel]')?.classList.add('is-active');
  const title = document.querySelector('[data-toolbar-title]');
  if (title) title.textContent = 'Юридическая готовность';
}

function stateBadge(state) {
  const status = state?.status || 'PRE_LAUNCH';
  const cls = status === 'LEGAL_READY' ? 'good' : 'warn';
  return `<span class="admin-legal-badge ${cls}">${escapeHtml(status)}</span>`;
}

function filingBadge(state) {
  const status = state?.filingStatus || 'NOT_PREPARED';
  const cls = status === 'SUBMITTED' ? 'good' : status === 'PREPARED' ? 'warn' : 'danger';
  return `<span class="admin-legal-badge ${cls}">${escapeHtml(status)}</span>`;
}

function documentRow(document) {
  const version = document.currentVersion;
  const flags = [
    document.requiredForRegistration ? '<span class="admin-legal-badge good">регистрация</span>' : '',
    document.requiredForLive ? '<span class="admin-legal-badge">LIVE</span>' : '',
    document.requiredForPublicBooking ? '<span class="admin-legal-badge">публичная запись</span>' : '',
  ].filter(Boolean).join('');
  return `<div class="admin-legal-row">
    <div class="admin-legal-row-main">
      <strong>${escapeHtml(document.title || document.key)}</strong>
      <small>${escapeHtml(document.key)} · ${escapeHtml(document.type)}${version ? ` · версия ${Number(version.version || 1)} · ${formatDate(version.publishedAt)}` : ' · версия отсутствует'}</small>
      <div class="admin-legal-badges">${flags}</div>
    </div>
    <button class="admin-button secondary" type="button" data-edit-document="${escapeHtml(document.key)}">${version ? 'Новая версия' : 'Опубликовать'}</button>
  </div>`;
}

function documentFormHtml(readiness, selected = null) {
  const preset = DOCUMENT_PRESETS.find((item) => item.key === selected?.key) || DOCUMENT_PRESETS[0];
  const current = selected?.currentVersion || null;
  const identity = current?.operatorIdentitySnapshot && typeof current.operatorIdentitySnapshot === 'object'
    ? current.operatorIdentitySnapshot
    : {};
  const platformLocked = readiness?.state?.status !== 'PRE_LAUNCH';
  return `<section class="admin-legal-card" data-document-editor>
    <h3>${selected?.currentVersion ? 'Новая версия документа' : 'Публикация документа'}</h3>
    ${platformLocked ? '<p class="admin-legal-note">Новые версии можно публиковать только в PRE_LAUNCH. Сначала верните платформу в PRE_LAUNCH.</p>' : ''}
    <form class="admin-legal-form" data-legal-document-form>
      <div class="admin-legal-columns">
        <label class="admin-field"><span>Документ</span><select name="key" ${platformLocked ? 'disabled' : ''}>${DOCUMENT_PRESETS.map((item) => `<option value="${escapeHtml(item.key)}" ${item.key === (selected?.key || preset.key) ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></label>
        <label class="admin-field"><span>Тип</span><input name="type" value="${escapeHtml(selected?.type || preset.type)}" ${platformLocked ? 'disabled' : ''}></label>
      </div>
      <label class="admin-field"><span>Название</span><input name="title" value="${escapeHtml(selected?.title || preset.title)}" ${platformLocked ? 'disabled' : ''}></label>
      <div class="admin-legal-columns">
        <label class="admin-field"><span>Оператор / ИП</span><input name="operatorName" value="${escapeHtml(identity.name || '')}" placeholder="ИП ФИО" ${platformLocked ? 'disabled' : ''}></label>
        <label class="admin-field"><span>ИНН</span><input name="inn" value="${escapeHtml(identity.inn || '')}" ${platformLocked ? 'disabled' : ''}></label>
        <label class="admin-field"><span>ОГРНИП</span><input name="ogrnip" value="${escapeHtml(identity.ogrnip || '')}" ${platformLocked ? 'disabled' : ''}></label>
        <label class="admin-field"><span>Email оператора</span><input name="operatorEmail" type="email" value="${escapeHtml(identity.email || '')}" ${platformLocked ? 'disabled' : ''}></label>
      </div>
      <label class="admin-field"><span>Текст документа</span><textarea name="content" ${platformLocked ? 'disabled' : ''}>${escapeHtml(current?.contentSnapshot || '')}</textarea></label>
      <label class="admin-field"><span>Загрузить текстовый файл</span><input name="documentFile" type="file" accept=".txt,.md,.html,text/plain,text/markdown,text/html" ${platformLocked ? 'disabled' : ''}></label>
      <div class="admin-legal-flags">
        <label><input name="requiredForRegistration" type="checkbox" ${(selected?.requiredForRegistration ?? preset.requiredForRegistration) ? 'checked' : ''} ${platformLocked ? 'disabled' : ''}> обязательно при регистрации мастера</label>
        <label><input name="requiredForLive" type="checkbox" ${selected?.requiredForLive ? 'checked' : ''} ${platformLocked ? 'disabled' : ''}> обязательно для LIVE</label>
        <label><input name="requiredForPublicBooking" type="checkbox" ${selected?.requiredForPublicBooking ? 'checked' : ''} ${platformLocked ? 'disabled' : ''}> обязательно для публичной записи</label>
      </div>
      <div class="admin-legal-actions"><button class="admin-button" type="submit" ${platformLocked ? 'disabled' : ''}>Опубликовать новую версию</button></div>
      <p class="admin-inline-message" data-document-message></p>
    </form>
  </section>`;
}

function renderReadiness(readiness) {
  const state = readiness?.state || {};
  const documents = Array.isArray(readiness?.documents) ? readiness.documents : [];
  const checklist = state?.checklist && typeof state.checklist === 'object' ? state.checklist : {};
  const missing = Array.isArray(readiness?.missingDocuments) ? readiness.missingDocuments : [];
  const content = document.querySelector('[data-content]');
  if (!content) return;

  content.innerHTML = `
    <div class="admin-heading"><div><h2>Юридическая готовность Book</h2><p>Документы оператора, подача и переход платформы в рабочий режим.</p></div></div>
    <div class="admin-legal-grid">
      <div class="admin-legal-stat"><span>Платформа</span><strong>${stateBadge(state)}</strong></div>
      <div class="admin-legal-stat"><span>Роскомнадзор</span><strong>${filingBadge(state)}</strong></div>
      <div class="admin-legal-stat"><span>Готовность</span><strong>${readiness?.canBecomeLegalReady ? 'Можно включать LEGAL_READY' : 'Не завершена'}</strong></div>
    </div>
    <section class="admin-legal-card">
      <h3>Документы платформы</h3>
      <div class="admin-card">${documents.map(documentRow).join('') || '<div class="admin-legal-row">Документы ещё не опубликованы.</div>'}</div>
      ${missing.length ? `<p class="admin-legal-note">Не хватает обязательных документов:</p><ul class="admin-legal-missing">${missing.map((key) => `<li>${escapeHtml(key)}</li>`).join('')}</ul>` : '<p class="admin-legal-success">Все базовые обязательные документы опубликованы.</p>'}
      <div class="admin-legal-actions" style="margin-top:14px"><button class="admin-button" type="button" data-new-document ${state.status !== 'PRE_LAUNCH' ? 'disabled' : ''}>Добавить / опубликовать документ</button></div>
    </section>
    <div data-document-editor-slot></div>
    <section class="admin-legal-card">
      <h3>Checklist оператора</h3>
      <div class="admin-legal-checklist">${(readiness?.checklistKeys || []).map((key) => `<label class="admin-legal-check"><input type="checkbox" data-checklist-key="${escapeHtml(key)}" ${checklist[key] === true ? 'checked' : ''} ${state.status === 'LEGAL_READY' ? 'disabled' : ''}><span>${escapeHtml(CHECKLIST_LABELS[key] || key)}</span></label>`).join('')}</div>
      <p class="admin-inline-message" data-checklist-message></p>
    </section>
    <section class="admin-legal-card">
      <h3>Подача и рабочий режим</h3>
      <div class="admin-legal-actions">
        <button class="admin-button secondary" type="button" data-mark-prepared ${state.filingStatus !== 'NOT_PREPARED' ? 'disabled' : ''}>Отметить PREPARED</button>
        <button class="admin-button secondary" type="button" data-mark-submitted ${state.filingStatus !== 'PREPARED' ? 'disabled' : ''}>Зафиксировать SUBMITTED</button>
        <button class="admin-button" type="button" data-mark-legal-ready ${!readiness?.canBecomeLegalReady || state.status === 'LEGAL_READY' ? 'disabled' : ''}>Перевести Book в LEGAL_READY</button>
        <button class="admin-button danger" type="button" data-return-prelaunch ${state.status !== 'LEGAL_READY' ? 'disabled' : ''}>Вернуть в PRE_LAUNCH</button>
      </div>
      <p class="admin-legal-note">SUBMITTED здесь означает зафиксированное подтверждение факта подачи. Это не подтверждение или одобрение со стороны государственного органа.</p>
      <p class="admin-inline-message" data-state-message></p>
    </section>`;

  content.querySelector('[data-new-document]')?.addEventListener('click', () => showDocumentEditor(readiness, null));
  content.querySelectorAll('[data-edit-document]').forEach((button) => {
    button.addEventListener('click', () => {
      const documentItem = documents.find((item) => item.key === button.dataset.editDocument) || null;
      showDocumentEditor(readiness, documentItem);
    });
  });

  content.querySelectorAll('[data-checklist-key]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const message = content.querySelector('[data-checklist-message]');
      checkbox.disabled = true;
      try {
        const next = await legalRequest('/checklist', {
          method: 'PUT',
          body: JSON.stringify({ checklist: { [checkbox.dataset.checklistKey]: checkbox.checked } }),
        });
        renderReadiness(next);
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        checkbox.disabled = false;
        message.textContent = error instanceof Error ? error.message : 'Не удалось сохранить checklist';
        message.classList.add('error');
      }
    });
  });

  content.querySelector('[data-mark-prepared]')?.addEventListener('click', () => runStateAction('/filing/prepared', {}));
  content.querySelector('[data-mark-submitted]')?.addEventListener('click', async () => {
    const submissionReference = window.prompt('Укажи номер, идентификатор или иное основание подтверждения подачи:');
    if (!submissionReference) return;
    await runStateAction('/filing/submitted', { submissionReference, evidenceMetadata: { source: 'book-admin' } });
  });
  content.querySelector('[data-mark-legal-ready]')?.addEventListener('click', () => runStateAction('/legal-ready', {}));
  content.querySelector('[data-return-prelaunch]')?.addEventListener('click', async () => {
    const reason = window.prompt('Причина возврата в PRE_LAUNCH:');
    if (!reason) return;
    await runStateAction('/pre-launch', { reason });
  });
}

function showDocumentEditor(readiness, selected) {
  const slot = document.querySelector('[data-document-editor-slot]');
  if (!slot) return;
  slot.innerHTML = documentFormHtml(readiness, selected);
  slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const form = slot.querySelector('[data-legal-document-form]');
  if (!form) return;
  const keySelect = form.querySelector('[name="key"]');
  const fileInput = form.querySelector('[name="documentFile"]');
  const textarea = form.querySelector('[name="content"]');

  keySelect?.addEventListener('change', () => {
    const preset = DOCUMENT_PRESETS.find((item) => item.key === keySelect.value);
    if (!preset) return;
    form.elements.type.value = preset.type;
    form.elements.title.value = preset.title;
    form.elements.requiredForRegistration.checked = Boolean(preset.requiredForRegistration);
  });

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    textarea.value = await file.text();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = form.querySelector('[data-document-message]');
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    message.textContent = '';
    message.classList.remove('error');
    button.disabled = true;
    try {
      const operatorIdentity = {
        name: String(data.get('operatorName') || '').trim(),
        inn: String(data.get('inn') || '').trim(),
        ogrnip: String(data.get('ogrnip') || '').trim(),
        email: String(data.get('operatorEmail') || '').trim(),
      };
      if (!operatorIdentity.name) throw new Error('Укажи оператора / ИП');
      const payload = {
        key: String(data.get('key') || ''),
        type: String(data.get('type') || ''),
        title: String(data.get('title') || ''),
        content: String(data.get('content') || ''),
        operatorIdentity,
        requiredForRegistration: data.get('requiredForRegistration') === 'on',
        requiredForLive: data.get('requiredForLive') === 'on',
        requiredForPublicBooking: data.get('requiredForPublicBooking') === 'on',
      };
      await legalRequest('/documents', { method: 'POST', body: JSON.stringify(payload) });
      const next = await legalRequest('/readiness');
      renderReadiness(next);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось опубликовать документ';
      message.classList.add('error');
      button.disabled = false;
    }
  });
}

async function runStateAction(path, body) {
  const content = document.querySelector('[data-content]');
  const message = content?.querySelector('[data-state-message]');
  if (message) {
    message.textContent = '';
    message.classList.remove('error');
  }
  try {
    const next = await legalRequest(path, { method: 'POST', body: JSON.stringify(body || {}) });
    renderReadiness(next);
  } catch (error) {
    if (message) {
      message.textContent = error instanceof Error ? error.message : 'Не удалось изменить юридический статус';
      message.classList.add('error');
    }
  }
}

async function renderLegalPanel() {
  activatePanel();
  const content = document.querySelector('[data-content]');
  if (!content) return;
  content.innerHTML = '<div class="admin-legal-card">Загружаем юридическую готовность…</div>';
  try {
    const readiness = await legalRequest('/readiness');
    renderReadiness(readiness);
  } catch (error) {
    content.innerHTML = `<div class="admin-legal-card"><p class="admin-legal-error">${escapeHtml(error instanceof Error ? error.message : 'Не удалось открыть юридический раздел')}</p></div>`;
  }
}

const observer = new MutationObserver(() => injectButton());
observer.observe(document.documentElement, { childList: true, subtree: true });
injectButton();

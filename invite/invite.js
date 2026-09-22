import { setAuthToken } from '../core/auth.js';
import { API_BASE } from '../core/environment.js';

const state = document.querySelector('#invite-state');
const token = new URLSearchParams(location.search).get('token') || '';

async function post(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Ошибка сервера');
  return payload;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char] || char);
}

function formatDateTime(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function renderError(message) {
  state.innerHTML = '<h1>Ссылка недоступна</h1><p data-error></p>';
  state.querySelector('[data-error]').textContent = message || 'Не удалось открыть регистрационную ссылку.';
}

function documentRow(documentItem) {
  const required = Boolean(documentItem.required);
  const note = required ? 'Обязательно' : 'Необязательно';
  return `
    <section class="invite-document" data-document-row="${escapeHtml(documentItem.key)}">
      <div class="invite-document__head">
        <label class="invite-document__choice">
          <input
            type="checkbox"
            data-document-check="${escapeHtml(documentItem.key)}"
            data-document-version="${escapeHtml(documentItem.version)}"
            ${required ? 'data-required-document' : ''}
          >
          <span><strong>${escapeHtml(documentItem.title)}</strong><small>${note} · версия ${escapeHtml(documentItem.version)}</small></span>
        </label>
        <button class="invite-document__open" type="button" data-document-open="${escapeHtml(documentItem.key)}">Открыть</button>
      </div>
      <div class="invite-document__content" data-document-content="${escapeHtml(documentItem.key)}" hidden>
        <pre>${escapeHtml(documentItem.content)}</pre>
      </div>
    </section>`;
}

function registrationFacts(invitation) {
  const documents = Array.isArray(invitation.documents) ? invitation.documents : [];
  return documents.map((documentItem) => ({
    key: documentItem.key,
    version: documentItem.version,
    accepted: Boolean(state.querySelector(`[data-document-check="${CSS.escape(documentItem.key)}"]`)?.checked),
  }));
}

function renderForm(invitation) {
  const documents = Array.isArray(invitation.documents) ? invitation.documents : [];
  state.innerHTML = `
    <h1>Создайте учётную запись</h1>
    <p>Сначала подтвердите документы, затем укажите основные данные. 14 дней DEMO начнутся только после открытия вашего профиля.</p>
    <div class="invite-meta">
      <strong data-name></strong>
      <span data-email></span>
      <span>DEMO · 14 дней с первого открытия профиля</span>
    </div>

    <form class="invite-form" data-form>
      <section class="invite-legal">
        <div class="invite-legal__heading">
          <h2>Документы и согласия</h2>
          <p>Подтвердите обязательные документы. Отдельное согласие на рекламные и маркетинговые сообщения можно дать здесь же.</p>
        </div>
        <div class="invite-documents">${documents.map(documentRow).join('')}</div>
      </section>

      <section data-registration-data hidden>
        <div class="invite-legal__heading">
          <h2>Основные данные</h2>
          <p>Имя и номер телефона обязательны. Фамилию можно добавить сейчас или позже в профиле.</p>
        </div>

        <label class="invite-field">
          <span>Имя</span>
          <input name="name" type="text" autocomplete="given-name" required>
        </label>
        <label class="invite-field">
          <span>Фамилия</span>
          <input name="surname" type="text" autocomplete="family-name">
        </label>
        <label class="invite-field">
          <span>Телефон</span>
          <input name="phone" type="tel" autocomplete="tel" required>
        </label>

        ${invitation.requiresEmail ? `<label class="invite-field">
          <span>Email</span>
          <input name="email" type="email" autocomplete="email" required>
        </label>` : ''}

        <label class="invite-field">
          <span>Пароль</span>
          <input name="password" type="password" minlength="10" autocomplete="new-password" required>
        </label>
        <label class="invite-field">
          <span>Повторите пароль</span>
          <input name="passwordConfirm" type="password" minlength="10" autocomplete="new-password" required>
        </label>

        <p class="invite-error" data-form-error role="alert"></p>
        <button class="invite-button" type="submit">Создать учётную запись</button>
      </section>
    </form>`;

  state.querySelector('[data-name]').textContent = invitation.name || 'Новое рабочее пространство';
  state.querySelector('[data-email]').textContent = invitation.email || '';
  const registrationName = state.querySelector('[name="name"]');
  if (registrationName && invitation.name) registrationName.value = invitation.name;

  state.querySelectorAll('[data-document-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.documentOpen || '';
      const content = state.querySelector(`[data-document-content="${CSS.escape(key)}"]`);
      if (!content) return;
      content.hidden = !content.hidden;
      button.textContent = content.hidden ? 'Открыть' : 'Свернуть';
    });
  });

  const form = state.querySelector('[data-form]');
  const error = state.querySelector('[data-form-error]');
  const button = form.querySelector('button[type="submit"]');
  const registrationData = form.querySelector('[data-registration-data]');
  const requiredChecks = [...form.querySelectorAll('[data-required-document]')];

  const syncReady = () => {
    const legalReady = requiredChecks.every((checkbox) => checkbox.checked);
    registrationData.hidden = !legalReady;
  };
  form.querySelectorAll('[data-document-check]').forEach((checkbox) => checkbox.addEventListener('change', syncReady));
  syncReady();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (registrationData.hidden) return;
    error.textContent = '';

    const data = new FormData(form);
    const password = String(data.get('password') || '');
    const confirm = String(data.get('passwordConfirm') || '');
    if (password.length < 10) {
      error.textContent = 'Пароль должен содержать минимум 10 символов.';
      return;
    }
    if (password !== confirm) {
      error.textContent = 'Пароли не совпадают.';
      return;
    }

    button.disabled = true;
    button.textContent = 'Создаём учётную запись…';
    try {
      const account = await post('/tenant-invitations/accept', {
        token,
        password,
        email: invitation.requiresEmail ? data.get('email') : undefined,
        name: data.get('name'),
        surname: data.get('surname'),
        phone: data.get('phone'),
        documents: registrationFacts(invitation),
      });
      setAuthToken(account.accessToken);
      state.innerHTML = '<h1>Учётная запись создана</h1><p class="invite-success">Открываем настройку профиля…</p>';
      window.setTimeout(() => location.replace('../'), 350);
    } catch (acceptError) {
      error.textContent = acceptError instanceof Error ? acceptError.message : 'Не удалось завершить регистрацию';
      button.disabled = false;
      button.textContent = 'Создать учётную запись';
      syncReady();
    }
  });
}

if (!token) {
  renderError('В ссылке отсутствует код приглашения.');
} else {
  try {
    const invitation = await post('/tenant-invitations/inspect', { token });
    renderForm(invitation);
  } catch (error) {
    renderError(error instanceof Error ? error.message : 'Не удалось проверить ссылку');
  }
}

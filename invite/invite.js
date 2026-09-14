import { API_BASE } from '../core/environment.js';

const TOKEN_KEY = 'book.auth.token';
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

function renderError(message) {
  state.innerHTML = '<h1>Приглашение недоступно</h1><p data-error></p>';
  state.querySelector('[data-error]').textContent = message || 'Не удалось открыть приглашение.';
}

function renderForm(invitation) {
  state.innerHTML = `
    <h1>Создайте свой Book</h1>
    <p>Задайте пароль. После этого откроется ваш персональный рабочий Book.</p>
    <div class="invite-meta">
      <strong data-name></strong>
      <span data-email></span>
    </div>
    <form class="invite-form" data-form>
      <label class="invite-field">
        <span>Пароль</span>
        <input name="password" type="password" minlength="10" autocomplete="new-password" required>
      </label>
      <label class="invite-field">
        <span>Повторите пароль</span>
        <input name="passwordConfirm" type="password" minlength="10" autocomplete="new-password" required>
      </label>
      <p class="invite-error" data-form-error role="alert"></p>
      <button class="invite-button" type="submit">Создать пароль и войти</button>
    </form>`;

  state.querySelector('[data-name]').textContent = invitation.name || invitation.tenant?.name || 'Ваш Book';
  state.querySelector('[data-email]').textContent = invitation.email || '';

  const form = state.querySelector('[data-form]');
  const error = state.querySelector('[data-form-error]');
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
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
    button.textContent = 'Создаём Book…';
    try {
      const account = await post('/master-invitations/accept', { token, password });
      sessionStorage.setItem(TOKEN_KEY, account.accessToken);
      state.innerHTML = '<h1>Book создан</h1><p class="invite-success">Открываем ваше рабочее пространство…</p>';
      window.setTimeout(() => location.replace('../'), 350);
    } catch (acceptError) {
      error.textContent = acceptError instanceof Error ? acceptError.message : 'Не удалось принять приглашение';
      button.disabled = false;
      button.textContent = 'Создать пароль и войти';
    }
  });
}

if (!token) {
  renderError('В ссылке отсутствует код приглашения.');
} else {
  try {
    const invitation = await post('/master-invitations/inspect', { token });
    renderForm(invitation);
  } catch (error) {
    renderError(error instanceof Error ? error.message : 'Не удалось проверить приглашение');
  }
}

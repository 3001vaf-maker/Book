import { setAuthToken } from '../core/auth.js';
import { API_BASE } from '../core/environment.js';

const state = document.querySelector('#register-state');
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
  state.innerHTML = '<h1>Ссылка недоступна</h1><p data-error></p>';
  state.querySelector('[data-error]').textContent = message || 'Не удалось открыть регистрацию.';
}

function renderForm(payload) {
  const expiresAt = payload?.expiresAt ? new Date(payload.expiresAt) : null;
  const expires = expiresAt && Number.isFinite(expiresAt.getTime())
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(expiresAt)
    : '';

  state.innerHTML = `
    <h1>Создание профиля</h1>
    <p>Укажите email и придумайте пароль. Остальные данные заполняются после входа.</p>
    ${expires ? `<div class="invite-meta"><span>Ссылка действует до ${expires}</span></div>` : ''}
    <form class="invite-form" data-form>
      <label class="invite-field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
      <label class="invite-field"><span>Пароль</span><input name="password" type="password" minlength="10" autocomplete="new-password" required></label>
      <label class="invite-field"><span>Повторите пароль</span><input name="passwordConfirm" type="password" minlength="10" autocomplete="new-password" required></label>
      <p class="invite-error" data-form-error role="alert"></p>
      <button class="invite-button" type="submit">Создать профиль и войти</button>
    </form>`;

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
    button.textContent = 'Создаём…';
    try {
      const account = await post('/tenant-invitations/registration-link/accept', {
        token,
        email: data.get('email'),
        password,
      });
      setAuthToken(account.accessToken);
      state.innerHTML = '<h1>Профиль создан</h1><p class="invite-success">Открываем рабочее пространство…</p>';
      window.setTimeout(() => location.replace('../'), 350);
    } catch (submitError) {
      error.textContent = submitError instanceof Error ? submitError.message : 'Не удалось зарегистрироваться';
      button.disabled = false;
      button.textContent = 'Создать профиль и войти';
    }
  });
}

if (!token) {
  renderError('В ссылке отсутствует код регистрации.');
} else {
  try {
    const payload = await post('/tenant-invitations/registration-link/inspect', { token });
    renderForm(payload);
  } catch (error) {
    renderError(error instanceof Error ? error.message : 'Не удалось проверить ссылку');
  }
}

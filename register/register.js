import { setAuthToken } from '../core/auth.js';
import { API_BASE } from '../core/environment.js';
import { startRegistrationFlow } from '../registration/registration-flow.js';

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

if (!token) {
  renderError('В ссылке отсутствует код регистрации.');
} else {
  try {
    const payload = await post('/manual-invitations/inspect', { token });
    startRegistrationFlow({
      root: state,
      documents: Array.isArray(payload?.documents) ? payload.documents : [],
      collectIdentity: true,
      onSubmit: async ({ identity, password, remember, facts }) => {
        const account = await post('/manual-invitations/accept', {
          token,
          ...identity,
          password,
          ...facts,
        });
        setAuthToken(account.accessToken, remember);
        state.innerHTML = '<h1>Book создан</h1><p class="invite-success">Открываем ваш Book в режиме DEMO…</p>';
        window.setTimeout(() => location.replace('../'), 350);
      },
    });
  } catch (error) {
    renderError(error instanceof Error ? error.message : 'Не удалось проверить ссылку');
  }
}

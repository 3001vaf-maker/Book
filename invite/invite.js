import { setAuthToken } from '../core/auth.js';
import { API_BASE } from '../core/environment.js';
import { startRegistrationFlow } from '../ui/auth/registration-flow.js';

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

if (!token) {
  renderError('В ссылке отсутствует код приглашения.');
} else {
  try {
    const [invitation, documents] = await Promise.all([
      post('/master-invitations/inspect', { token }),
      post('/master-invitations/documents', {}),
    ]);
    startRegistrationFlow({
      root: state,
      documents: Array.isArray(documents) ? documents : [],
      initial: {
        name: invitation?.name || invitation?.tenant?.name || '',
        email: invitation?.email || '',
      },
      collectIdentity: false,
      onSubmit: async ({ password, remember, facts }) => {
        const account = await post('/master-invitations/accept', {
          token,
          password,
          ...facts,
        });
        setAuthToken(account.accessToken, remember);
        state.innerHTML = '<h1>Book создан</h1><p class="invite-success">Открываем ваш Book в режиме DEMO…</p>';
        window.setTimeout(() => location.replace('../'), 350);
      },
    });
  } catch (error) {
    renderError(error instanceof Error ? error.message : 'Не удалось проверить приглашение');
  }
}

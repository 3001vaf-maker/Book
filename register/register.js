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

function documentBlock(document) {
  return `
    <details class="invite-legal-document">
      <summary>${escapeHtml(document.title || document.key)} · версия ${Number(document.version || 1)}</summary>
      <pre>${escapeHtml(document.content || '')}</pre>
    </details>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

function requiredKeys(payload) {
  return new Set(Array.isArray(payload?.legal?.required) ? payload.legal.required.map((item) => String(item?.key || '')) : []);
}

function legalCheckboxes(payload) {
  const documents = Array.isArray(payload?.documents) ? payload.documents : [];
  const byKey = new Map(documents.map((item) => [item.key, item]));
  const required = requiredKeys(payload);
  const rows = [];
  if (byKey.has('saas-agreement')) rows.push(`<label class="invite-legal-check"><input name="saasAgreementAccepted" type="checkbox" ${required.has('saas-agreement') ? 'required' : ''}> <span>Принимаю договор-оферту на использование Book.</span></label>`);
  if (byKey.has('dpa')) rows.push(`<label class="invite-legal-check"><input name="dpaAccepted" type="checkbox" ${required.has('dpa') ? 'required' : ''}> <span>Принимаю поручение на обработку персональных данных клиентов (DPA).</span></label>`);
  if (byKey.has('privacy-policy')) rows.push(`<label class="invite-legal-check"><input name="privacyAcknowledged" type="checkbox" ${required.has('privacy-policy') ? 'required' : ''}> <span>Ознакомился с политикой обработки персональных данных Book.</span></label>`);
  if (byKey.has('master-pd-consent')) rows.push(`<label class="invite-legal-check"><input name="pdConsentAccepted" type="checkbox" ${required.has('master-pd-consent') ? 'required' : ''}> <span>Даю согласие на обработку моих персональных данных.</span></label>`);
  if (byKey.has('marketing-consent')) rows.push('<label class="invite-legal-check"><input name="marketingConsentAccepted" type="checkbox"> <span>Хочу получать рекламные и маркетинговые сообщения Book. Это необязательно.</span></label>');
  return rows.join('');
}

function renderForm(payload) {
  const documents = Array.isArray(payload?.documents) ? payload.documents : [];
  state.innerHTML = `
    <h1>Создайте свой Book</h1>
    <p>Заполните основные данные и придумайте пароль.</p>
    <form class="invite-form" data-form>
      <label class="invite-field"><span>Имя</span><input name="name" autocomplete="given-name" required></label>
      <label class="invite-field"><span>Фамилия</span><input name="surname" autocomplete="family-name" required></label>
      <label class="invite-field"><span>Телефон</span><input name="phone" type="tel" autocomplete="tel" required></label>
      <label class="invite-field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
      <label class="invite-field"><span>Пароль</span><input name="password" type="password" minlength="10" autocomplete="new-password" required></label>
      <label class="invite-field"><span>Повторите пароль</span><input name="passwordConfirm" type="password" minlength="10" autocomplete="new-password" required></label>
      <label style="display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600"><input name="showPassword" type="checkbox" style="width:18px;height:18px">Показать пароли</label>
      <label style="display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600"><input name="remember" type="checkbox" checked style="width:18px;height:18px">Запомнить меня на этом устройстве</label>

      <section class="invite-legal" aria-label="Юридические документы">
        <h2>Документы Book</h2>
        ${documents.map(documentBlock).join('')}
        <div class="invite-legal-checks">${legalCheckboxes(payload)}</div>
      </section>

      <p class="invite-error" data-form-error role="alert"></p>
      <button class="invite-button" type="submit">Создать Book и войти в DEMO</button>
    </form>`;

  const form = state.querySelector('[data-form]');
  const error = state.querySelector('[data-form-error]');
  const button = form.querySelector('button[type="submit"]');
  const passwordInput = form.querySelector('input[name="password"]');
  const passwordConfirmInput = form.querySelector('input[name="passwordConfirm"]');
  const showPassword = form.querySelector('input[name="showPassword"]');

  showPassword.addEventListener('change', () => {
    const type = showPassword.checked ? 'text' : 'password';
    passwordInput.type = type;
    passwordConfirmInput.type = type;
  });

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
      const account = await post('/manual-invitations/accept', {
        token,
        name: data.get('name'),
        surname: data.get('surname'),
        phone: data.get('phone'),
        email: data.get('email'),
        password,
        saasAgreementAccepted: data.get('saasAgreementAccepted') === 'on',
        dpaAccepted: data.get('dpaAccepted') === 'on',
        privacyAcknowledged: data.get('privacyAcknowledged') === 'on',
        pdConsentAccepted: data.get('pdConsentAccepted') === 'on',
        marketingConsentAccepted: data.get('marketingConsentAccepted') === 'on',
      });
      setAuthToken(account.accessToken, data.get('remember') === 'on');
      state.innerHTML = '<h1>Book создан</h1><p class="invite-success">Открываем DEMO и юридическую подготовку…</p>';
      window.setTimeout(() => location.replace('../'), 350);
    } catch (submitError) {
      error.textContent = submitError instanceof Error ? submitError.message : 'Не удалось зарегистрироваться';
      button.disabled = false;
      button.textContent = 'Создать Book и войти';
    }
  });
}

if (!token) {
  renderError('В ссылке отсутствует код регистрации.');
} else {
  try {
    const payload = await post('/manual-invitations/inspect', { token });
    renderForm(payload);
  } catch (error) {
    renderError(error instanceof Error ? error.message : 'Не удалось проверить ссылку');
  }
}

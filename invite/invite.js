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
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

function renderError(message) {
  state.innerHTML = '<h1>Приглашение недоступно</h1><p data-error></p>';
  state.querySelector('[data-error]').textContent = message || 'Не удалось открыть приглашение.';
}

function documentBlock(document) {
  return `
    <details class="invite-legal-document">
      <summary>${escapeHtml(document.title || document.key)} · версия ${Number(document.version || 1)}</summary>
      <pre>${escapeHtml(document.content || '')}</pre>
    </details>`;
}

function required(document, invitation) {
  const keys = new Set(Array.isArray(invitation?.legal?.required) ? invitation.legal.required.map((item) => String(item?.key || '')) : []);
  return Boolean(document.requiredForRegistration || keys.has(document.key));
}

function legalCheckboxes(invitation, documents) {
  const byKey = new Map(documents.map((item) => [item.key, item]));
  const saas = byKey.get('saas-agreement');
  const dpa = byKey.get('dpa');
  const privacy = byKey.get('privacy-policy');
  const pdConsent = byKey.get('master-pd-consent');
  const marketing = byKey.get('marketing-consent');
  const rows = [];

  if (saas || dpa) {
    const must = Boolean((saas && required(saas, invitation)) || (dpa && required(dpa, invitation)));
    rows.push(`<label class="invite-legal-check"><input name="saasAgreementAccepted" type="checkbox" ${must ? 'required' : ''}> <span>Принимаю договор / оферту SaaS${dpa ? ' и поручение на обработку ПД (DPA)' : ''}.</span></label>`);
  }
  if (privacy) {
    rows.push(`<label class="invite-legal-check"><input name="privacyAcknowledged" type="checkbox" ${required(privacy, invitation) ? 'required' : ''}> <span>Ознакомился с политикой обработки персональных данных Book.</span></label>`);
  }
  if (pdConsent) {
    rows.push(`<label class="invite-legal-check"><input name="pdConsentAccepted" type="checkbox" ${required(pdConsent, invitation) ? 'required' : ''}> <span>Даю согласие на обработку моих персональных данных в объёме опубликованного согласия.</span></label>`);
  }
  if (marketing) {
    rows.push('<label class="invite-legal-check"><input name="marketingConsentAccepted" type="checkbox"> <span>Хочу получать рекламные и маркетинговые сообщения Book. Это необязательно и не влияет на регистрацию.</span></label>');
  }
  return rows.join('');
}

function renderForm(invitation, documents) {
  const currentDocuments = Array.isArray(documents) ? documents : [];
  state.innerHTML = `
    <h1>Создайте свой Book</h1>
    <p>Сначала Book откроется в безопасном режиме DEMO. Реальные клиенты и внешние сообщения станут доступны только после юридической подготовки и перехода в LIVE.</p>
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
      <label style="display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600"><input name="showPassword" type="checkbox" style="width:18px;height:18px">Показать пароли</label>
      <label style="display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600"><input name="remember" type="checkbox" checked style="width:18px;height:18px">Запомнить меня на этом устройстве</label>

      <section class="invite-legal" aria-label="Юридические документы">
        <h2>Документы</h2>
        ${currentDocuments.map(documentBlock).join('')}
        <div class="invite-legal-checks">${legalCheckboxes(invitation, currentDocuments)}</div>
      </section>

      <p class="invite-error" data-form-error role="alert"></p>
      <button class="invite-button" type="submit">Создать пароль и войти в DEMO</button>
    </form>`;

  state.querySelector('[data-name]').textContent = invitation.name || invitation.tenant?.name || 'Ваш Book';
  state.querySelector('[data-email]').textContent = invitation.email || '';

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
      const account = await post('/master-invitations/accept', {
        token,
        password,
        saasAgreementAccepted: data.get('saasAgreementAccepted') === 'on',
        privacyAcknowledged: data.get('privacyAcknowledged') === 'on',
        pdConsentAccepted: data.get('pdConsentAccepted') === 'on',
        marketingConsentAccepted: data.get('marketingConsentAccepted') === 'on',
      });
      setAuthToken(account.accessToken, data.get('remember') === 'on');
      state.innerHTML = '<h1>Book создан</h1><p class="invite-success">Открываем безопасный режим DEMO…</p>';
      window.setTimeout(() => location.replace('../'), 350);
    } catch (acceptError) {
      error.textContent = acceptError instanceof Error ? acceptError.message : 'Не удалось принять приглашение';
      button.disabled = false;
      button.textContent = 'Создать пароль и войти в DEMO';
    }
  });
}

if (!token) {
  renderError('В ссылке отсутствует код приглашения.');
} else {
  try {
    const [invitation, documents] = await Promise.all([
      post('/master-invitations/inspect', { token }),
      post('/master-invitations/documents', {}),
    ]);
    renderForm(invitation, documents);
  } catch (error) {
    renderError(error instanceof Error ? error.message : 'Не удалось проверить приглашение');
  }
}

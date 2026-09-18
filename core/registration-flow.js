const LEGAL_FACTS = {
  'saas-agreement': { field: 'saasAgreementAccepted', label: 'Принимаю оферту Book' },
  dpa: { field: 'dpaAccepted', label: 'Принимаю поручение Book на обработку данных клиентов' },
  'privacy-policy': { field: 'privacyAcknowledged', label: 'Ознакомился с политикой обработки персональных данных Book' },
  'master-pd-consent': { field: 'pdConsentAccepted', label: 'Даю согласие на обработку моих данных для работы аккаунта Book' },
  'marketing-consent': { field: 'marketingConsentAccepted', label: 'Хочу получать новости и предложения Book', optional: true },
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

function agreementRows(documents, facts) {
  return documents.map((document) => {
    const config = LEGAL_FACTS[document.key];
    if (!config) return '';
    const required = Boolean(document.requiredForRegistration) && !config.optional;
    const checked = facts[config.field] === true;
    return `<article class="invite-document">
      <details>
        <summary>${escapeHtml(document.title || config.label)} · версия ${Number(document.version || 1)}</summary>
        <pre>${escapeHtml(document.content || '')}</pre>
      </details>
      <label class="invite-legal-check">
        <input type="checkbox" data-legal-fact="${escapeHtml(config.field)}" ${checked ? 'checked' : ''} ${required ? 'data-required-legal="1"' : ''}>
        <span>${escapeHtml(config.label)}${config.optional ? ' — необязательно' : ''}</span>
      </label>
    </article>`;
  }).join('');
}

function collectFacts(root, facts) {
  root.querySelectorAll('[data-legal-fact]').forEach((input) => {
    facts[input.dataset.legalFact] = Boolean(input.checked);
  });
}

function requiredAccepted(root) {
  return [...root.querySelectorAll('[data-required-legal="1"]')].every((input) => input.checked);
}

export function startRegistrationFlow({
  root,
  documents = [],
  initial = {},
  emailLocked = false,
  onSubmit,
}) {
  const facts = {
    saasAgreementAccepted: false,
    dpaAccepted: false,
    privacyAcknowledged: false,
    pdConsentAccepted: false,
    marketingConsentAccepted: false,
  };

  const renderWelcome = () => {
    root.innerHTML = `
      <h1>Добро пожаловать в Book</h1>
      <p>Сначала создайте доступ к Book. После регистрации откроется настоящий Book в режиме DEMO — профиль и рабочие настройки заполняются уже внутри приложения.</p>
      <div class="invite-actions">
        <button class="invite-button" type="button" data-next>Продолжить</button>
      </div>`;
    root.querySelector('[data-next]')?.addEventListener('click', renderAgreements);
  };

  const renderAgreements = () => {
    root.innerHTML = `
      <h1>Условия работы с Book</h1>
      <p>Это соглашения между Book и вами. Документы ваших клиентов будут сформированы отдельно после настройки профиля в DEMO.</p>
      <div class="invite-documents">${agreementRows(documents, facts)}</div>
      <p class="invite-error" data-error></p>
      <div class="invite-actions">
        <button class="invite-button invite-button--secondary" type="button" data-back>Назад</button>
        <button class="invite-button" type="button" data-next>Продолжить</button>
      </div>`;
    root.querySelector('[data-back]')?.addEventListener('click', () => {
      collectFacts(root, facts);
      renderWelcome();
    });
    root.querySelector('[data-next]')?.addEventListener('click', () => {
      collectFacts(root, facts);
      if (!requiredAccepted(root)) {
        root.querySelector('[data-error]').textContent = 'Подтвердите обязательные условия Book.';
        return;
      }
      renderRegistration();
    });
  };

  const renderRegistration = () => {
    const initialEmail = String(initial.email || '').trim();
    root.innerHTML = `
      <h1>Регистрация</h1>
      <p>Укажите базовые данные для аккаунта. После входа они уже будут в профиле, а профессию, рабочее место и остальные настройки вы дозаполните внутри DEMO.</p>
      <form class="invite-form" data-form>
        <label class="invite-field"><span>Имя</span><input name="name" autocomplete="given-name" value="${escapeHtml(initial.name || '')}" required></label>
        <label class="invite-field"><span>Фамилия</span><input name="surname" autocomplete="family-name" value="${escapeHtml(initial.surname || '')}" required></label>
        <label class="invite-field"><span>Телефон</span><input name="phone" type="tel" autocomplete="tel" value="${escapeHtml(initial.phone || '')}" required></label>
        <label class="invite-field">
          <span>Email</span>
          <input name="email" type="email" autocomplete="email" value="${escapeHtml(initialEmail)}" ${emailLocked ? 'readonly' : ''} required>
        </label>
        <label class="invite-field"><span>Пароль</span><input name="password" type="password" minlength="10" autocomplete="new-password" required></label>
        <label class="invite-field"><span>Повторите пароль</span><input name="passwordConfirm" type="password" minlength="10" autocomplete="new-password" required></label>
        <label class="invite-inline"><input name="showPassword" type="checkbox"> <span>Показать пароль</span></label>
        <p class="invite-error" data-error></p>
        <div class="invite-actions">
          <button class="invite-button invite-button--secondary" type="button" data-back>Назад</button>
          <button class="invite-button" type="submit">Создать Book</button>
        </div>
      </form>`;

    const form = root.querySelector('[data-form]');
    const password = form.querySelector('[name="password"]');
    const confirm = form.querySelector('[name="passwordConfirm"]');
    form.querySelector('[name="showPassword"]')?.addEventListener('change', (event) => {
      const type = event.target.checked ? 'text' : 'password';
      password.type = type;
      confirm.type = type;
    });
    form.querySelector('[data-back]')?.addEventListener('click', renderAgreements);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = form.querySelector('[data-error]');
      error.textContent = '';
      const data = new FormData(form);
      const identity = {
        name: String(data.get('name') || '').trim(),
        surname: String(data.get('surname') || '').trim(),
        phone: String(data.get('phone') || '').trim(),
        email: String(data.get('email') || '').trim().toLowerCase(),
      };
      const email = identity.email;
      const passwordValue = String(data.get('password') || '');
      if (!identity.name || !identity.surname || !identity.phone) {
        error.textContent = 'Заполните имя, фамилию и телефон.';
        return;
      }
      if (!email || !email.includes('@')) {
        error.textContent = 'Укажите корректный email.';
        return;
      }
      if (passwordValue.length < 10) {
        error.textContent = 'Пароль должен содержать минимум 10 символов.';
        return;
      }
      if (passwordValue !== String(data.get('passwordConfirm') || '')) {
        error.textContent = 'Пароли не совпадают.';
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Создаём Book…';
      try {
        await onSubmit({
          identity,
          password: passwordValue,
          facts: { ...facts },
        });
      } catch (submitError) {
        error.textContent = submitError instanceof Error ? submitError.message : 'Не удалось создать Book';
        submit.disabled = false;
        submit.textContent = 'Создать Book';
      }
    });
  };

  renderWelcome();
}

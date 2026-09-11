import {
  clearBookingAccount,
  createBookingRequest,
  getBookingAccount,
  getBookingRequests,
  getBookingContext,
  getRememberedBookingEmail,
  loginBookingAccount,
  prepareBookingAccount,
  registerBookingAccount,
  updateBookingAccount,
} from '../core/booking-account/index.js';
import { formatPhone } from '../core/phone/index.js';
import {
  actionBlock,
  agreementBlock,
  button,
  details,
  durationText,
  emptyState,
  entityCard,
  escapeHtml,
  field,
  initCalendar,
  initMultiSelect,
  list,
  modal,
  mountModal,
  page,
  pageHeader,
  phoneField,
  timeSlots,
} from '../ui/ui.js';
import {
  bookingDuration,
  bookingProcedureCost,
  bookingSelection,
  getBookingProcedures,
  getBookingSlots,
  getBookingWorkingDates,
  getBookingWorkplace,
  hasRequiredBookingConsents,
  requiredBookingDocuments,
} from './model.js';

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function money(value) {
  if (value === '' || value == null) return '';
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? `${number.toLocaleString('ru-RU').replaceAll('\u00a0', ' ')} ₽` : `${value} ₽`;
}

function selectedTotal(context, workplaceKey, ids) {
  return bookingSelection(context, workplaceKey, ids).reduce((sum, procedure) => {
    const value = Number(String(bookingProcedureCost(procedure, workplaceKey)).replace(',', '.'));
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function accountName(account = {}) {
  return [account.name, account.surname].filter(Boolean).join(' ') || 'Аккаунт';
}

function errorBlock(message = '') {
  return message ? `<div class="form-error" role="alert">${escapeHtml(message)}</div>` : '';
}

function currentConsentFacts(state) {
  return requiredBookingDocuments(state.context).map((document) => ({
    documentId: String(document.id || ''),
    documentVersion: Math.max(1, Number(document.version || 1)),
    accepted: Boolean(state.consents[String(document.id || '')]),
    acceptedAt: new Date().toISOString(),
  }));
}

function seedConsents(state, facts = []) {
  state.consents = {};
  for (const fact of Array.isArray(facts) ? facts : []) {
    if (!fact?.accepted) continue;
    state.consents[String(fact.documentId || '')] = true;
  }
}

function resetBookingChoice(state) {
  if (!state.lockedWorkplaceKey) state.workplaceKey = '';
  else state.workplaceKey = state.lockedWorkplaceKey;
  state.procedureIds = [];
  state.date = '';
  state.from = '';
  state.to = '';
  state.error = '';
}

function renderPage(root, blocks = []) {
  root.innerHTML = page(blocks);
}

function nextAfterAgreements(root, state) {
  state.error = '';
  if (state.lockedWorkplaceKey) {
    state.workplaceKey = state.lockedWorkplaceKey;
    renderProcedures(root, state);
  } else {
    renderWorkplaces(root, state);
  }
}

function openDocument(state, documentId) {
  const document = requiredBookingDocuments(state.context).find((item) => String(item.id) === String(documentId));
  if (!document) return;
  mountModal(document.body, modal(`${pageHeader(document.title || 'Документ', `Версия ${document.version || 1}`)}${details([{ label: 'Текст', value: document.text || 'Текст документа не заполнен.' }])}`, { variant: 'large' }));
}

function renderWelcome(root, state) {
  const profile = state.context.profile || {};
  const owner = [profile.name, profile.surname].filter(Boolean).join(' ');
  renderPage(root, [
    pageHeader('Добро пожаловать', owner ? `Онлайн-запись · ${owner}` : 'Онлайн-запись'),
    actionBlock(`${button('Далее', { data: 'data-booking-welcome-next' })}${button('Войти', { variant: 'secondary', data: 'data-booking-login-open' })}`),
  ]);
  root.querySelector('[data-booking-welcome-next]')?.addEventListener('click', () => renderAgreements(root, state));
  root.querySelector('[data-booking-login-open]')?.addEventListener('click', () => renderLogin(root, state));
}

function renderLogin(root, state) {
  const email = state.loginEmail || getRememberedBookingEmail(state.tenantId) || '';
  renderPage(root, [
    pageHeader('Вход', 'Войдите в свой аккаунт'),
    `<form data-booking-login-form>${field({ label: 'Email', name: 'email', value: email, type: 'email', required: true, autocomplete: 'username' })}${field({ label: 'Пароль', name: 'password', type: 'password', required: true, autocomplete: 'current-password' })}${errorBlock(state.error)}${actionBlock(`${button('Войти', { type: 'submit' })}${button('Показать пароль', { variant: 'secondary', data: 'data-booking-password-toggle' })}${button('Назад', { variant: 'secondary', data: 'data-booking-login-back' })}`)}</form>`,
  ]);
  const form = root.querySelector('[data-booking-login-form]');
  root.querySelector('[data-booking-password-toggle]')?.addEventListener('click', () => {
    const input = form?.querySelector('[name="password"]');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  root.querySelector('[data-booking-login-back]')?.addEventListener('click', () => {
    state.error = '';
    renderWelcome(root, state);
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const payload = await loginBookingAccount(state.tenantId, data.get('email'), data.get('password'));
      state.account = payload.account;
      state.loginEmail = payload.account?.email || '';
      state.error = '';
      seedConsents(state, state.account?.consents || []);
      await renderAccountHome(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось войти';
      renderLogin(root, state);
    }
  });
}

function renderAgreements(root, state) {
  const documents = requiredBookingDocuments(state.context);
  const canContinue = documents.filter((document) => document.required).every((document) => state.consents[String(document.id || '')]);
  const rows = agreementBlock(documents.map((document) => ({
    label: document.title || 'Документ',
    checked: Boolean(state.consents[String(document.id || '')]),
    openData: `data-booking-document="${escapeHtml(document.id)}"`,
    toggleData: `data-booking-consent="${escapeHtml(document.id)}"`,
    openAria: `Открыть документ ${document.title || ''}`,
    toggleAria: `${state.consents[String(document.id || '')] ? 'Снять' : 'Дать'} согласие: ${document.title || ''}`,
  })));
  const next = button('Далее', { data: `data-booking-agreements-next${canContinue ? '' : ' disabled'}` });
  renderPage(root, [
    pageHeader('Соглашения', 'Откройте документ, ознакомьтесь и отметьте согласие'),
    documents.length ? rows : emptyState('Документов нет', 'Для онлайн-записи не настроены документы согласия.'),
    errorBlock(state.error),
    actionBlock(next),
  ]);
  root.querySelectorAll('[data-booking-document]').forEach((node) => node.addEventListener('click', () => openDocument(state, node.dataset.bookingDocument)));
  root.querySelectorAll('[data-booking-consent]').forEach((node) => node.addEventListener('click', () => {
    const id = String(node.dataset.bookingConsent || '');
    state.consents[id] = !state.consents[id];
    renderAgreements(root, state);
  }));
  root.querySelector('[data-booking-agreements-next]')?.addEventListener('click', () => {
    if (!canContinue) return;
    nextAfterAgreements(root, state);
  });
}

function renderWorkplaces(root, state) {
  const workplaces = Array.isArray(state.context.workplaces) ? state.context.workplaces : [];
  const content = list({
    items: workplaces.map((workplace) => ({
      title: workplace.name || 'Рабочее пространство',
      secondary: [workplace.city || '', workplace.address || ''],
      indicatorColor: workplace.color || '',
      interactive: true,
      data: `data-booking-workplace="${escapeHtml(workplace.key)}"`,
      aria: `Выбрать рабочее пространство ${workplace.name || ''}`,
    })),
  });
  renderPage(root, [
    pageHeader('Рабочее пространство', 'Выберите, где хотите записаться'),
    content || emptyState('Нет доступных пространств', 'Рабочие пространства для онлайн-записи не найдены.'),
  ]);
  root.querySelectorAll('[data-booking-workplace]').forEach((node) => node.addEventListener('click', () => {
    state.workplaceKey = node.dataset.bookingWorkplace || '';
    state.procedureIds = [];
    state.date = '';
    state.from = '';
    renderProcedures(root, state);
  }));
}

function renderProcedures(root, state) {
  const procedures = getBookingProcedures(state.context, state.workplaceKey);
  const selected = new Set(state.procedureIds);
  const content = list({
    items: procedures.map((procedure) => {
      const cost = bookingProcedureCost(procedure, state.workplaceKey);
      return {
        title: procedure.name || '',
        secondary: [durationText(procedure.duration), cost !== '' ? money(cost) : ''],
        interactive: true,
        data: `data-booking-procedure="${escapeHtml(procedure.id)}"`,
        selected: selected.has(String(procedure.id)),
        aria: `Выбрать процедуру ${procedure.name || ''}`,
      };
    }),
  });
  const nextDisabled = state.procedureIds.length === 0;
  renderPage(root, [
    pageHeader('Процедуры', 'Можно выбрать несколько'),
    content || emptyState('Процедур нет', 'Для этого рабочего пространства процедуры не настроены.'),
    actionBlock(button('Далее', { data: `data-booking-procedures-next${nextDisabled ? ' disabled' : ''}` })),
  ]);
  const host = root.querySelector('[data-ui-list]');
  if (host) {
    initMultiSelect(host, {
      selectedValues: state.procedureIds,
      selector: '[data-booking-procedure]',
      valueAttribute: 'bookingProcedure',
      onChange: (values) => {
        state.procedureIds = values.map(String);
        renderProcedures(root, state);
      },
    });
  }
  root.querySelector('[data-booking-procedures-next]')?.addEventListener('click', () => {
    if (!state.procedureIds.length) return;
    state.date = '';
    state.from = '';
    renderDates(root, state);
  });
}

function renderDates(root, state) {
  const dates = getBookingWorkingDates(state.context, state.workplaceKey, { fromDate: localDateKey() });
  const first = dates[0] || localDateKey();
  const firstDate = new Date(`${first}T00:00:00`);
  renderPage(root, [
    pageHeader('Дата', 'Выберите доступный рабочий день'),
    dates.length ? '<div data-booking-calendar></div>' : emptyState('Свободных дат нет', 'В графике пока нет доступных дат.'),
  ]);
  const calendarRoot = root.querySelector('[data-booking-calendar]');
  if (!calendarRoot) return;
  initCalendar(calendarRoot, {
    month: new Date(firstDate.getFullYear(), firstDate.getMonth(), 1),
    workingDates: dates,
    onDateSelect: (date) => {
      if (!dates.includes(date)) return;
      state.date = date;
      state.from = '';
      renderTimes(root, state);
    },
  });
}

function renderTimes(root, state) {
  const slots = getBookingSlots(state.context, {
    workplaceKey: state.workplaceKey,
    date: state.date,
    procedureIds: state.procedureIds,
    step: 15,
  });
  renderPage(root, [
    pageHeader('Время', formatDate(state.date)),
    slots.length
      ? timeSlots({ values: slots.map((slot) => ({ value: slot.from, label: slot.from })), data: 'data-booking-time', ariaLabel: 'Выберите время записи' })
      : emptyState('Свободного времени нет', 'На эту дату нет интервала для выбранных процедур.'),
    errorBlock(state.error),
  ]);
  root.querySelectorAll('[data-booking-time]').forEach((node) => node.addEventListener('click', () => {
    const slot = slots.find((item) => item.from === node.dataset.bookingTime);
    if (!slot) return;
    state.from = slot.from;
    state.to = slot.to;
    state.error = '';
    if (state.account) renderConfirmation(root, state);
    else renderAccountDetails(root, state);
  }));
}

function renderAccountDetails(root, state) {
  const draft = state.accountDraft || {};
  renderPage(root, [
    pageHeader('Ваши данные'),
    `<form data-booking-account-form>${field({ label: 'Имя', name: 'name', value: draft.name || '', required: true, autocomplete: 'given-name' })}${field({ label: 'Фамилия', name: 'surname', value: draft.surname || '', autocomplete: 'family-name' })}${phoneField({ label: 'Телефон', name: 'phone', value: draft.phone || '', required: true })}${field({ label: 'Email', name: 'email', value: draft.email || '', type: 'email', required: true, autocomplete: 'email' })}${errorBlock(state.error)}${actionBlock(button('Далее', { type: 'submit' }))}</form>`,
  ]);
  const form = root.querySelector('[data-booking-account-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    state.accountDraft = {
      name: String(data.get('name') || '').trim(),
      surname: String(data.get('surname') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim().toLowerCase(),
      telegramId: state.telegramId || '',
    };
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const prepared = await prepareBookingAccount(state.tenantId, state.accountDraft.email);
      state.passwordMode = prepared.exists ? 'login' : 'register';
      state.error = '';
      renderPassword(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось проверить аккаунт';
      renderAccountDetails(root, state);
    }
  });
}

function renderPassword(root, state) {
  const register = state.passwordMode !== 'login';
  renderPage(root, [
    pageHeader(register ? 'Создайте пароль' : 'Введите пароль', state.accountDraft.email || ''),
    `<form data-booking-password-form>${field({ label: 'Пароль', name: 'password', type: 'password', required: true, autocomplete: register ? 'new-password' : 'current-password' })}${errorBlock(state.error)}${actionBlock(`${button(register ? 'Создать аккаунт' : 'Войти', { type: 'submit' })}${button('Показать пароль', { variant: 'secondary', data: 'data-booking-password-toggle' })}`)}</form>`,
  ]);
  const form = root.querySelector('[data-booking-password-form]');
  root.querySelector('[data-booking-password-toggle]')?.addEventListener('click', () => {
    const input = form?.querySelector('[name="password"]');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = String(new FormData(form).get('password') || '');
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      let payload;
      if (register) {
        payload = await registerBookingAccount(state.tenantId, {
          ...state.accountDraft,
          password,
          consents: currentConsentFacts(state),
        });
      } else {
        payload = await loginBookingAccount(state.tenantId, state.accountDraft.email, password);
        payload.account = await updateBookingAccount(state.tenantId, {
          ...state.accountDraft,
          consents: currentConsentFacts(state),
        });
      }
      state.account = payload.account;
      state.error = '';
      seedConsents(state, state.account?.consents || currentConsentFacts(state));
      renderConfirmation(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось войти';
      renderPassword(root, state);
    }
  });
}

function renderConfirmation(root, state) {
  const workplace = getBookingWorkplace(state.context, state.workplaceKey) || {};
  const procedures = bookingSelection(state.context, state.workplaceKey, state.procedureIds);
  const duration = bookingDuration(state.context, state.workplaceKey, state.procedureIds);
  const total = selectedTotal(state.context, state.workplaceKey, state.procedureIds);
  const card = entityCard({
    title: accountName(state.account),
    subtitle: formatPhone(state.account?.phone || state.accountDraft?.phone || ''),
    topMeta: [{ value: workplace.name || 'Рабочее пространство', row: 1 }],
    topRightMeta: [
      { value: formatDate(state.date), row: 2 },
      { value: `${state.from} - ${state.to}`, row: 3 },
    ],
    detailRows: [
      { left: durationText(duration), right: money(total), weight: 'strong' },
      ...procedures.map((procedure) => ({
        left: procedure.name || '',
        right: money(bookingProcedureCost(procedure, state.workplaceKey)),
      })),
    ],
    className: 'entity-card--hero entity-card--top-dark',
  });
  renderPage(root, [
    pageHeader('Подтверждение'),
    card,
    errorBlock(state.error),
    actionBlock(`${button('Подтвердить', { data: 'data-booking-confirm' })}${button('Выбрать другое время', { variant: 'secondary', data: 'data-booking-change-time' })}`),
  ]);
  root.querySelector('[data-booking-change-time]')?.addEventListener('click', () => {
    state.error = '';
    renderTimes(root, state);
  });
  root.querySelector('[data-booking-confirm]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      state.lastRequest = await createBookingRequest(state.tenantId, {
        workplaceKey: state.workplaceKey,
        date: state.date,
        from: state.from,
        procedureIds: state.procedureIds,
      });
      state.notice = 'Запись отправлена в журнал.';
      state.error = '';
      await refreshContext(state);
      await renderAccountHome(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось подтвердить запись';
      renderConfirmation(root, state);
    }
  });
}

function requestStatus(status) {
  if (status === 'IMPORTED') return 'Подтверждена';
  if (status === 'REJECTED') return 'Нужно выбрать другое время';
  if (status === 'CANCELLED') return 'Отменена';
  return 'Подтверждается';
}

async function renderAccountHome(root, state) {
  renderPage(root, [pageHeader('Ваш аккаунт'), emptyState('Загрузка', 'Получаем ваши записи.')]);
  let requests = [];
  try {
    requests = await getBookingRequests(state.tenantId);
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Не удалось загрузить записи';
  }
  const account = state.account || {};
  const card = entityCard({
    title: accountName(account),
    subtitle: formatPhone(account.phone || ''),
    topMeta: [{ value: account.email || '' }],
    className: 'entity-card--hero',
  });
  const requestList = list({
    items: (Array.isArray(requests) ? requests : []).map((request) => {
      const workplace = getBookingWorkplace(state.context, request.workplaceKey);
      const procedures = Array.isArray(request.procedures) ? request.procedures.map((item) => item.name).filter(Boolean).join(', ') : '';
      return {
        title: procedures || 'Запись',
        secondary: [`${formatDate(request.date)} · ${request.from}`, workplace?.name || ''],
        right: requestStatus(request.status),
        interactive: false,
      };
    }),
  });
  renderPage(root, [
    pageHeader('Ваш аккаунт'),
    card,
    state.notice ? `<div class="muted">${escapeHtml(state.notice)}</div>` : '',
    requestList || emptyState('Записей пока нет', 'Здесь появятся ваши онлайн-записи.'),
    errorBlock(state.error),
    actionBlock(`${button('Записаться', { data: 'data-booking-new' })}${button('Выйти', { variant: 'secondary', data: 'data-booking-logout' })}`),
  ]);
  state.notice = '';
  root.querySelector('[data-booking-new]')?.addEventListener('click', () => {
    resetBookingChoice(state);
    seedConsents(state, state.account?.consents || []);
    if (hasRequiredBookingConsents(state.context, state.account?.consents || [])) nextAfterAgreements(root, state);
    else renderAgreements(root, state);
  });
  root.querySelector('[data-booking-logout]')?.addEventListener('click', () => {
    clearBookingAccount(state.tenantId);
    state.account = null;
    state.error = '';
    renderLogin(root, state);
  });
}

async function refreshContext(state) {
  state.context = await getBookingContext(state.tenantId, state.lockedWorkplaceKey);
}

export async function renderOnlineBooking(root, { tenantId = '', workplaceKey = '', telegramId = '' } = {}) {
  const state = {
    tenantId: String(tenantId || ''),
    lockedWorkplaceKey: String(workplaceKey || ''),
    workplaceKey: String(workplaceKey || ''),
    telegramId: String(telegramId || ''),
    context: {},
    procedureIds: [],
    date: '',
    from: '',
    to: '',
    accountDraft: {},
    account: null,
    consents: {},
    passwordMode: 'register',
    loginEmail: '',
    error: '',
    notice: '',
    lastRequest: null,
  };

  renderPage(root, [pageHeader('Онлайн-запись'), emptyState('Загрузка', 'Получаем доступные данные.')]);
  if (!state.tenantId) {
    renderPage(root, [pageHeader('Онлайн-запись'), emptyState('Ссылка недействительна', 'В ссылке отсутствует идентификатор онлайн-записи.')]);
    return;
  }

  try {
    await refreshContext(state);
    const account = await getBookingAccount(state.tenantId);
    if (account) {
      state.account = account;
      seedConsents(state, account.consents || []);
      await renderAccountHome(root, state);
      return;
    }
    const remembered = getRememberedBookingEmail(state.tenantId);
    if (remembered) {
      state.loginEmail = remembered;
      renderLogin(root, state);
      return;
    }
    renderWelcome(root, state);
  } catch (error) {
    renderPage(root, [
      pageHeader('Онлайн-запись'),
      emptyState('Запись недоступна', error instanceof Error ? error.message : 'Не удалось открыть онлайн-запись.'),
    ]);
  }
}

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
import { normalizeBookingSettings } from '../core/booking-settings/index.js';
import { formatPhone } from '../core/phone/index.js';
import {
  accordion,
  bookingAccountHeader,
  bookingAction,
  bookingActions,
  bookingAgreementCards,
  bookingChoiceCards,
  bookingDocument,
  bookingHeading,
  bookingHistoryCards,
  bookingPersonalDataButton,
  bookingScreen,
  bookingTimeGroups,
  emptyState,
  entityCard,
  escapeHtml,
  field,
  initAccordions,
  initCalendar,
  modal,
  mountModal,
  phoneField,
  select,
} from '../ui/ui.js';
import {
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
  if (value === '' || value == null) return '0 ₽';
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? `${number.toLocaleString('ru-RU').replaceAll('\u00a0', ' ')} ₽` : `${value} ₽`;
}

function numericCost(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function selectedSubtotal(context, workplaceKey, ids) {
  return bookingSelection(context, workplaceKey, ids).reduce((sum, procedure) => sum + numericCost(bookingProcedureCost(procedure, workplaceKey)), 0);
}

function accountName(account = {}) {
  return [account.name, account.surname].filter(Boolean).join(' ') || 'Аккаунт';
}

function accountDiscount(account = {}) {
  const value = Number(account?.discountPercent || 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function discountedTotal(subtotal, discountPercent) {
  return Math.max(0, Number(subtotal || 0) * (1 - Number(discountPercent || 0) / 100));
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
  state.workplaceKey = state.lockedWorkplaceKey || '';
  state.procedureIds = [];
  state.date = '';
  state.from = '';
  state.to = '';
  state.error = '';
}

function renderPage(root, state, blocks = [], { mode = 'center', className = '' } = {}) {
  root.innerHTML = bookingScreen(blocks, { settings: state.settings, mode, className });
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
  mountModal(document.body, modal(bookingDocument({
    title: document.title || 'Документ',
    version: document.version || 1,
    text: document.text || '',
  }), { variant: 'large' }));
}

function renderWelcome(root, state) {
  const profile = state.context.profile || {};
  const owner = [profile.name, profile.surname].filter(Boolean).join(' ');
  const subtitle = [state.settings.welcomeText, owner ? owner : ''].filter(Boolean).join('\n');
  renderPage(root, state, [
    bookingHeading(state.settings.welcomeTitle, subtitle),
    bookingActions(`${bookingAction('Далее', { data: 'data-booking-welcome-next' })}${bookingAction('Войти', { secondary: true, data: 'data-booking-login-open' })}`),
  ]);
  root.querySelector('[data-booking-welcome-next]')?.addEventListener('click', () => renderAgreements(root, state));
  root.querySelector('[data-booking-login-open]')?.addEventListener('click', () => renderLogin(root, state));
}

function renderLogin(root, state) {
  const email = state.loginEmail || getRememberedBookingEmail(state.tenantId) || '';
  renderPage(root, state, [
    bookingHeading('Вход', 'Войдите в свой аккаунт'),
    `<form data-booking-login-form>${field({ label: 'Email', name: 'email', value: email, type: 'email', required: true, autocomplete: 'username' })}${field({ label: 'Пароль', name: 'password', type: 'password', required: true, autocomplete: 'current-password' })}${errorBlock(state.error)}${bookingActions(`${bookingAction('Войти', { type: 'submit' })}${bookingAction('Показать пароль', { secondary: true, data: 'data-booking-password-toggle' })}${bookingAction('Назад', { secondary: true, data: 'data-booking-login-back' })}`)}</form>`,
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
  const cards = bookingAgreementCards(documents.map((document) => ({
    label: document.title || 'Документ',
    checked: Boolean(state.consents[String(document.id || '')]),
    openData: `data-booking-document="${escapeHtml(document.id)}"`,
    toggleData: `data-booking-consent="${escapeHtml(document.id)}"`,
    openAria: `Открыть документ ${document.title || ''}`,
    toggleAria: `${state.consents[String(document.id || '')] ? 'Снять' : 'Дать'} согласие: ${document.title || ''}`,
  })));
  renderPage(root, state, [
    bookingHeading('Соглашения', 'Откройте документ, ознакомьтесь и отметьте согласие'),
    documents.length ? cards : emptyState('Документов нет', 'Для онлайн-записи не настроены документы согласия.'),
    errorBlock(state.error),
    bookingActions(bookingAction('Далее', { data: 'data-booking-agreements-next', disabled: !canContinue })),
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
  const content = bookingChoiceCards(workplaces.map((workplace) => ({
    title: workplace.name || 'Рабочее пространство',
    secondary: [workplace.city || '', workplace.address || ''].filter(Boolean),
    image: workplace.photo || '',
    data: `data-booking-workplace="${escapeHtml(workplace.key)}"`,
    aria: `Выбрать рабочее пространство ${workplace.name || ''}`,
  })));
  renderPage(root, state, [
    bookingHeading('Рабочее пространство', 'Выберите, где хотите записаться'),
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
  const content = bookingChoiceCards(procedures.map((procedure) => {
    const cost = bookingProcedureCost(procedure, state.workplaceKey);
    return {
      title: procedure.name || '',
      secondary: [procedure.duration ? `${Number(procedure.duration)} мин` : '', procedure.description || ''].filter(Boolean),
      right: cost !== '' ? money(cost) : '',
      image: procedure.photo || '',
      selected: selected.has(String(procedure.id)),
      data: `data-booking-procedure="${escapeHtml(procedure.id)}"`,
      aria: `Выбрать процедуру ${procedure.name || ''}`,
    };
  }), { multiple: true });
  renderPage(root, state, [
    bookingHeading('Процедуры', 'Выберите всё, что хотите сделать'),
    content || emptyState('Процедур нет', 'Для этого рабочего пространства процедуры не настроены.'),
    bookingActions(bookingAction('Далее', { data: 'data-booking-procedures-next', disabled: state.procedureIds.length === 0 })),
  ]);
  root.querySelectorAll('[data-booking-procedure]').forEach((node) => node.addEventListener('click', () => {
    const id = String(node.dataset.bookingProcedure || '');
    const next = new Set(state.procedureIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    state.procedureIds = [...next];
    renderProcedures(root, state);
  }));
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
  renderPage(root, state, [
    bookingHeading('Дата', 'Выберите удобный день'),
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
    step: state.settings.slotStep,
  });
  renderPage(root, state, [
    bookingHeading('Время', formatDate(state.date)),
    slots.length
      ? bookingTimeGroups(slots, { data: 'data-booking-time' })
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
  renderPage(root, state, [
    bookingHeading('Ваши данные', 'Они сохранятся в вашем аккаунте'),
    `<form data-booking-account-form>${field({ label: 'Имя', name: 'name', value: draft.name || '', required: true, autocomplete: 'given-name' })}${field({ label: 'Фамилия', name: 'surname', value: draft.surname || '', autocomplete: 'family-name' })}${phoneField({ label: 'Телефон', name: 'phone', value: draft.phone || '', required: true })}${field({ label: 'Email', name: 'email', value: draft.email || '', type: 'email', required: true, autocomplete: 'email' })}${errorBlock(state.error)}${bookingActions(bookingAction('Далее', { type: 'submit' }))}</form>`,
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
  renderPage(root, state, [
    bookingHeading(register ? 'Создайте пароль' : 'Введите пароль', state.accountDraft.email || ''),
    `<form data-booking-password-form>${field({ label: 'Пароль', name: 'password', type: 'password', required: true, autocomplete: register ? 'new-password' : 'current-password' })}${errorBlock(state.error)}${bookingActions(`${bookingAction(register ? 'Создать аккаунт' : 'Войти', { type: 'submit' })}${bookingAction('Показать пароль', { secondary: true, data: 'data-booking-password-toggle' })}`)}</form>`,
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

function confirmationCard(state) {
  const workplace = getBookingWorkplace(state.context, state.workplaceKey) || {};
  const procedures = bookingSelection(state.context, state.workplaceKey, state.procedureIds);
  const subtotal = selectedSubtotal(state.context, state.workplaceKey, state.procedureIds);
  const discount = accountDiscount(state.account);
  const total = discountedTotal(subtotal, discount);
  return entityCard({
    title: accountName(state.account),
    subtitle: formatPhone(state.account?.phone || state.accountDraft?.phone || ''),
    topMeta: [{ value: workplace.name || 'Рабочее пространство', row: 1 }],
    topRightMeta: [
      { value: formatDate(state.date), row: 2 },
      { value: `${state.from} - ${state.to}`, row: 3 },
    ],
    meta: [
      { value: money(subtotal), label: 'Стоимость' },
      { value: `${discount} %`, label: 'Скидка' },
      { value: money(total), label: 'Итого' },
    ],
    detailRows: procedures.map((procedure) => ({
      left: procedure.name || '',
      right: money(bookingProcedureCost(procedure, state.workplaceKey)),
    })),
    className: 'entity-card--hero entity-card--top-dark',
  });
}

function renderConfirmation(root, state) {
  renderPage(root, state, [
    bookingHeading('Подтверждение'),
    confirmationCard(state),
    errorBlock(state.error),
    bookingActions(`${bookingAction('Подтвердить', { data: 'data-booking-confirm' })}${bookingAction('Выбрать другое время', { secondary: true, data: 'data-booking-change-time' })}`),
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

function requestProcedures(request = {}) {
  const snapshot = request.recordSnapshot && typeof request.recordSnapshot === 'object' ? request.recordSnapshot : {};
  return Array.isArray(snapshot.procedures) && snapshot.procedures.length
    ? snapshot.procedures
    : Array.isArray(request.procedures) ? request.procedures : [];
}

function requestPricing(request = {}) {
  const snapshot = request.recordSnapshot && typeof request.recordSnapshot === 'object' ? request.recordSnapshot : {};
  const pricing = snapshot.pricing && typeof snapshot.pricing === 'object' ? snapshot.pricing : {};
  const procedures = requestProcedures(request);
  const subtotal = Number.isFinite(Number(pricing.subtotal))
    ? Number(pricing.subtotal)
    : procedures.reduce((sum, item) => sum + numericCost(item.cost), 0);
  const discountPercent = Number(pricing.discountPercent || 0);
  const total = Number.isFinite(Number(pricing.total)) ? Number(pricing.total) : discountedTotal(subtotal, discountPercent);
  return { subtotal, discountPercent, total };
}

function requestPayment(request = {}) {
  const snapshot = request.recordSnapshot && typeof request.recordSnapshot === 'object' ? request.recordSnapshot : {};
  const payment = snapshot.payment && typeof snapshot.payment === 'object' ? snapshot.payment : {};
  const pricing = requestPricing(request);
  return {
    state: String(payment.state || 'unpaid'),
    paid: Math.max(0, Number(payment.paid || 0)),
    due: Math.max(0, Number.isFinite(Number(payment.due)) ? Number(payment.due) : pricing.total),
  };
}

function openRequestDetails(state, request) {
  const workplace = getBookingWorkplace(state.context, request.workplaceKey) || {};
  const procedures = requestProcedures(request);
  const pricing = requestPricing(request);
  const payment = requestPayment(request);
  const paymentText = payment.state === 'paid'
    ? 'Оплачено'
    : payment.state === 'partial'
      ? `К оплате ${money(payment.due)}`
      : `К оплате ${money(payment.due)}`;
  const card = entityCard({
    title: procedures.map((item) => item.name).filter(Boolean).join(', ') || 'Запись',
    topMeta: [{ value: workplace.name || 'Рабочее пространство', row: 1 }],
    topRightMeta: [
      { value: formatDate(request.date), row: 2 },
      { value: `${request.from} - ${request.to}`, row: 3 },
    ],
    meta: [
      { value: money(pricing.subtotal), label: 'Стоимость' },
      { value: `${pricing.discountPercent || 0} %`, label: 'Скидка' },
      { value: money(pricing.total), label: 'Итого' },
    ],
    detailRows: [
      ...procedures.map((item) => ({ left: item.name || '', right: money(item.cost) })),
      { left: paymentText, right: payment.state === 'paid' ? money(payment.paid || pricing.total) : '', weight: 'strong' },
    ],
    className: 'entity-card--hero entity-card--top-dark',
  });
  mountModal(document.body, modal(card, { variant: 'large' }));
}

function personalDataAccordion(account = {}) {
  const profileData = account.profileData || {};
  return accordion([
    {
      title: 'Личные данные',
      value: '',
      content: `<div class="form-grid">${field({ label: 'Имя', name: 'name', value: account.name || '', required: true })}${field({ label: 'Фамилия', name: 'surname', value: account.surname || '' })}${phoneField({ label: 'Телефон', name: 'phone', value: account.phone || '', required: true })}${field({ label: 'Email', name: 'email', value: account.email || '', type: 'email', readonly: true })}${select({ label: 'Пол', name: 'gender', value: profileData.gender || '', options: [{ value: '', label: 'Не указан' }, { value: 'male', label: 'Мужской' }, { value: 'female', label: 'Женский' }, { value: 'other', label: 'Другой' }] })}${field({ label: 'Дата рождения', name: 'birthDate', value: profileData.birthDate || '', type: 'date' })}</div>`,
    },
  ], { openFirst: true });
}

function openPersonalData(root, state) {
  const content = `<form data-booking-personal-form>${personalDataAccordion(state.account || {})}${errorBlock(state.personalError)}${bookingActions(bookingAction('Сохранить', { type: 'submit' }))}</form>`;
  const modalRoot = mountModal(document.body, modal(content, { variant: 'medium' }));
  if (!modalRoot) return;
  initAccordions(modalRoot);
  const form = modalRoot.querySelector('[data-booking-personal-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      state.account = await updateBookingAccount(state.tenantId, {
        name: data.get('name'),
        surname: data.get('surname'),
        phone: data.get('phone'),
        profileData: {
          gender: data.get('gender'),
          birthDate: data.get('birthDate'),
        },
      });
      state.personalError = '';
      modalRoot.remove();
      await renderAccountHome(root, state);
    } catch (error) {
      state.personalError = error instanceof Error ? error.message : 'Не удалось сохранить данные';
      const errorNode = modalRoot.querySelector('.form-error');
      if (errorNode) errorNode.textContent = state.personalError;
      else form?.insertAdjacentHTML('beforeend', errorBlock(state.personalError));
    }
  });
}

function accountPrograms(account = {}) {
  const programs = Array.isArray(account.programs) ? account.programs : [];
  return programs.map((program) => ({
    left: String(program?.name || program?.title || 'Программа'),
    right: String(program?.value || program?.balance || ''),
  }));
}

async function renderAccountHome(root, state) {
  renderPage(root, state, [bookingAccountHeader(), emptyState('Загрузка', 'Получаем ваши записи.')], { mode: 'account' });
  let requests = [];
  try {
    requests = await getBookingRequests(state.tenantId);
    const freshAccount = await getBookingAccount(state.tenantId);
    if (freshAccount) state.account = freshAccount;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Не удалось загрузить записи';
  }
  const account = state.account || {};
  const discount = accountDiscount(account);
  const card = entityCard({
    id: account.uei || '',
    title: accountName(account),
    subtitle: formatPhone(account.phone || ''),
    topMeta: [{ value: account.email || '', row: 1 }],
    topRightMeta: discount > 0 ? [{ value: `−${discount} %`, row: 1 }] : [],
    meta: [
      { value: String(Number(account.visits || 0)), label: 'Посещения' },
      { value: money(account.totalSpent || 0), label: 'Оплачено' },
      { value: account.lastVisit ? formatDate(account.lastVisit) : '—', label: 'Последний визит' },
    ],
    detailRows: accountPrograms(account),
    className: 'entity-card--hero entity-card--top-dark',
  });
  const historyItems = (Array.isArray(requests) ? requests : []).map((request) => {
    const procedures = requestProcedures(request).map((item) => item.name).filter(Boolean).join(', ');
    return {
      title: procedures || 'Запись',
      secondary: `${formatDate(request.date)} · ${request.from}`,
      status: requestStatus(request.status),
      data: `data-booking-history="${escapeHtml(request.id)}"`,
      aria: `Открыть запись ${procedures || ''} ${formatDate(request.date)}`,
    };
  });
  renderPage(root, state, [
    bookingAccountHeader(),
    card,
    bookingPersonalDataButton(),
    state.notice ? `<div class="muted">${escapeHtml(state.notice)}</div>` : '',
    historyItems.length ? bookingHistoryCards(historyItems) : emptyState('Записей пока нет', 'Здесь появятся ваши онлайн-записи.'),
    errorBlock(state.error),
  ], { mode: 'account' });
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
  root.querySelector('[data-booking-personal-data]')?.addEventListener('click', () => openPersonalData(root, state));
  root.querySelectorAll('[data-booking-history]').forEach((node) => node.addEventListener('click', () => {
    const request = requests.find((item) => String(item.id) === String(node.dataset.bookingHistory));
    if (request) openRequestDetails(state, request);
  }));
}

async function refreshContext(state) {
  state.context = await getBookingContext(state.tenantId, state.lockedWorkplaceKey);
  state.settings = normalizeBookingSettings(state.context.settings);
}

export async function renderOnlineBooking(root, { tenantId = '', workplaceKey = '', telegramId = '' } = {}) {
  const state = {
    tenantId: String(tenantId || ''),
    lockedWorkplaceKey: String(workplaceKey || ''),
    workplaceKey: String(workplaceKey || ''),
    telegramId: String(telegramId || ''),
    context: {},
    settings: normalizeBookingSettings(),
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
    personalError: '',
    notice: '',
    lastRequest: null,
  };

  renderPage(root, state, [bookingHeading('Онлайн-запись', 'Загрузка…')]);
  if (!state.tenantId) {
    renderPage(root, state, [bookingHeading('Онлайн-запись'), emptyState('Ссылка недействительна', 'В ссылке отсутствует идентификатор онлайн-записи.')]);
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
    renderPage(root, state, [
      bookingHeading('Онлайн-запись'),
      emptyState('Запись недоступна', error instanceof Error ? error.message : 'Не удалось открыть онлайн-запись.'),
    ]);
  }
}

import {
  clearBookingAccount,
  createBookingRequest,
  getBookingAccount,
  getBookingConsentState,
  getBookingContext,
  getRememberedBookingEmail,
  loginBookingAccount,
  prepareBookingAccount,
  registerBookingAccount,
  submitBookingConsents,
} from '../core/booking-account/index.js';
import { normalizeBookingSettings } from '../core/booking-settings/index.js';
import { formatPhone } from '../core/phone/index.js';
import {
  appHeader,
  appShell,
  bookingAction,
  bookingActions,
  bookingAgreementCards,
  bookingChoiceCards,
  bookingDocument,
  bookingThemeStyle,
  bookingTimeGroups,
  emptyState,
  entityCard,
  escapeHtml,
  field,
  initCalendar,
  modal,
  mountModal,
  phoneField,
} from '../ui/ui.js';
import {
  bookingProcedureCost,
  bookingSelection,
  getBookingProcedures,
  getBookingSlots,
  getBookingWorkingDates,
  getBookingWorkplace,
  requiredBookingDocuments,
} from './model.js';
import { renderClientAccount } from './account-shell.js';

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

async function refreshAccountConsentState(state) {
  const consentState = await getBookingConsentState(state.tenantId);
  seedConsents(state, consentState?.consents || []);
  return consentState || { allowed: false, consents: [] };
}

async function saveRegistrationConsents(state) {
  const consents = currentConsentFacts(state);
  const consentState = await submitBookingConsents(state.tenantId, consents);
  seedConsents(state, consentState?.consents || []);
  return consentState;
}

function resetBookingChoice(state) {
  state.workplaceKey = state.lockedWorkplaceKey || '';
  state.procedureIds = [];
  state.date = '';
  state.from = '';
  state.to = '';
  state.error = '';
  state.repeatSelection = null;
}

function flowThemeClasses(state) {
  const theme = state.settings?.theme && typeof state.settings.theme === 'object' ? state.settings.theme : {};
  const shape = ['soft', 'round', 'straight', 'cut'].includes(theme.shape) ? theme.shape : 'soft';
  const choiceStyle = ['cards', 'compact', 'list'].includes(theme.choiceStyle) ? theme.choiceStyle : 'cards';
  return `booking-client booking-client--account booking-shape--${shape} booking-choice-style--${choiceStyle}`;
}

function subtitleBlock(value = '') {
  const text = String(value || '').trim();
  return text ? `<div class="muted">${escapeHtml(text).replaceAll('\n', '<br>')}</div>` : '';
}

function renderFlowPage(root, state, {
  title = '',
  subtitle = '',
  body = '',
  back = null,
  action = null,
  center = false,
} = {}) {
  const shell = appShell({
    header: appHeader({ title, back, action }),
    body: `${subtitleBlock(subtitle)}${body}`,
    className: `app-view-shell--booking-flow${center ? ' app-view-shell--booking-flow-center' : ''}`,
  });
  root.innerHTML = `<section class="${flowThemeClasses(state)}" style="${bookingThemeStyle(state.settings)}">${shell}</section>`;
}

function requestProcedures(request = {}) {
  const snapshot = request.recordSnapshot && typeof request.recordSnapshot === 'object' ? request.recordSnapshot : {};
  return Array.isArray(snapshot.procedures) && snapshot.procedures.length
    ? snapshot.procedures
    : Array.isArray(request.procedures) ? request.procedures : [];
}

function continueRepeat(root, state) {
  const selection = state.repeatSelection;
  if (!selection) return false;
  state.repeatSelection = null;
  const requestWorkplace = String(selection.workplaceKey || '').trim();
  state.workplaceKey = state.lockedWorkplaceKey || requestWorkplace;
  state.procedureIds = [...new Set((Array.isArray(selection.procedureIds) ? selection.procedureIds : []).map(String).filter(Boolean))];
  state.date = '';
  state.from = '';
  state.to = '';
  if (!state.workplaceKey) {
    renderWorkplaces(root, state);
    return true;
  }
  if (!state.procedureIds.length) {
    renderProcedures(root, state);
    return true;
  }
  renderDates(root, state);
  return true;
}

function nextBookingStep(root, state) {
  state.error = '';
  if (continueRepeat(root, state)) return;
  if (state.lockedWorkplaceKey) {
    state.workplaceKey = state.lockedWorkplaceKey;
    renderProcedures(root, state);
  } else {
    renderWorkplaces(root, state);
  }
}

function backFromFirstBookingStep(root, state) {
  state.error = '';
  state.repeatSelection = null;
  void renderAccountHome(root, state);
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
  state.registrationMode = 'initial';
  const profile = state.context.profile || {};
  const owner = [profile.name, profile.surname].filter(Boolean).join(' ');
  const subtitle = [state.settings.welcomeText, owner].filter(Boolean).join('\n');
  renderFlowPage(root, state, {
    title: state.settings.welcomeTitle,
    subtitle,
    action: { label: 'Далее', data: 'data-booking-welcome-next' },
    center: true,
  });
  root.querySelector('[data-booking-welcome-next]')?.addEventListener('click', () => {
    resetBookingChoice(state);
    renderRegistrationAgreements(root, state);
  });
}

function renderRegistrationAgreements(root, state) {
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
  renderFlowPage(root, state, {
    title: 'Соглашения',
    subtitle: 'Согласия относятся к регистрации и аккаунту клиента',
    back: { data: 'data-booking-agreements-back', aria: 'Назад' },
    action: { label: 'Далее', data: 'data-booking-agreements-next', disabled: !canContinue },
    body: `${documents.length ? cards : emptyState('Документов нет', 'Для регистрации не настроены документы согласия.')}${errorBlock(state.error)}`,
  });
  root.querySelector('[data-booking-agreements-back]')?.addEventListener('click', () => {
    state.error = '';
    if (state.registrationMode === 'repair' && state.account) void renderAccountHome(root, state);
    else renderWelcome(root, state);
  });
  root.querySelectorAll('[data-booking-document]').forEach((node) => node.addEventListener('click', () => openDocument(state, node.dataset.bookingDocument)));
  root.querySelectorAll('[data-booking-consent]').forEach((node) => node.addEventListener('click', () => {
    const id = String(node.dataset.bookingConsent || '');
    state.consents[id] = !state.consents[id];
    renderRegistrationAgreements(root, state);
  }));
  root.querySelector('[data-booking-agreements-next]')?.addEventListener('click', async (event) => {
    if (!canContinue) return;
    if (state.registrationMode !== 'repair') {
      renderAccountEntry(root, state);
      return;
    }
    event.currentTarget.disabled = true;
    try {
      await saveRegistrationConsents(state);
      state.registrationMode = 'initial';
      await renderAccountHome(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось сохранить согласия';
      renderRegistrationAgreements(root, state);
    }
  });
}

function renderAccountEntry(root, state) {
  const rememberedEmail = state.accountDraft?.email || getRememberedBookingEmail(state.tenantId) || '';
  renderFlowPage(root, state, {
    title: 'Регистрация',
    subtitle: 'Введите email. Если аккаунт уже существует, откроется вход.',
    back: { data: 'data-booking-entry-back', aria: 'Назад' },
    action: { label: 'Далее', data: 'data-booking-entry-submit' },
    body: `<form data-booking-entry-form>${field({ label: 'Email', name: 'email', value: rememberedEmail, type: 'email', required: true, autocomplete: 'email' })}${errorBlock(state.error)}</form>`,
    center: true,
  });
  const form = root.querySelector('[data-booking-entry-form]');
  root.querySelector('[data-booking-entry-back]')?.addEventListener('click', () => {
    state.error = '';
    renderRegistrationAgreements(root, state);
  });
  root.querySelector('[data-booking-entry-submit]')?.addEventListener('click', () => form?.requestSubmit());
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = String(new FormData(form).get('email') || '').trim().toLowerCase();
    state.accountDraft = { ...(state.accountDraft || {}), email };
    const submit = root.querySelector('[data-booking-entry-submit]');
    if (submit) submit.disabled = true;
    try {
      const prepared = await prepareBookingAccount(state.tenantId, email);
      state.passwordMode = prepared.exists ? 'login' : 'register';
      state.error = '';
      if (prepared.exists) renderPassword(root, state);
      else renderAccountDetails(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось проверить аккаунт';
      renderAccountEntry(root, state);
    }
  });
}

function renderAccountDetails(root, state) {
  const draft = state.accountDraft || {};
  renderFlowPage(root, state, {
    title: 'Ваши данные',
    subtitle: draft.email || 'Они сохранятся в вашем аккаунте',
    back: { data: 'data-booking-account-back', aria: 'Назад' },
    action: { label: 'Далее', data: 'data-booking-account-submit' },
    body: `<form data-booking-account-form>${field({ label: 'Имя', name: 'name', value: draft.name || '', required: true, autocomplete: 'given-name' })}${field({ label: 'Фамилия', name: 'surname', value: draft.surname || '', autocomplete: 'family-name' })}${phoneField({ label: 'Телефон', name: 'phone', value: draft.phone || '', required: true })}${errorBlock(state.error)}</form>`,
  });
  const form = root.querySelector('[data-booking-account-form]');
  root.querySelector('[data-booking-account-back]')?.addEventListener('click', () => {
    state.error = '';
    renderAccountEntry(root, state);
  });
  root.querySelector('[data-booking-account-submit]')?.addEventListener('click', () => form?.requestSubmit());
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    state.accountDraft = {
      ...(state.accountDraft || {}),
      name: String(data.get('name') || '').trim(),
      surname: String(data.get('surname') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
    };
    state.passwordMode = 'register';
    state.error = '';
    renderPassword(root, state);
  });
}

function renderPassword(root, state) {
  const register = state.passwordMode !== 'login';
  renderFlowPage(root, state, {
    title: register ? 'Создайте пароль' : 'Введите пароль',
    subtitle: state.accountDraft.email || '',
    back: { data: 'data-booking-password-back', aria: 'Назад' },
    action: { label: register ? 'Создать' : 'Войти', data: 'data-booking-password-submit' },
    body: `<form data-booking-password-form>${field({ label: 'Пароль', name: 'password', type: 'password', required: true, autocomplete: register ? 'new-password' : 'current-password' })}${errorBlock(state.error)}${bookingActions(bookingAction('Показать пароль', { secondary: true, data: 'data-booking-password-toggle' }))}</form>`,
    center: true,
  });
  const form = root.querySelector('[data-booking-password-form]');
  root.querySelector('[data-booking-password-back]')?.addEventListener('click', () => {
    state.error = '';
    if (register) renderAccountDetails(root, state);
    else renderAccountEntry(root, state);
  });
  root.querySelector('[data-booking-password-submit]')?.addEventListener('click', () => form?.requestSubmit());
  root.querySelector('[data-booking-password-toggle]')?.addEventListener('click', () => {
    const input = form?.querySelector('[name="password"]');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = String(new FormData(form).get('password') || '');
    const submit = root.querySelector('[data-booking-password-submit]');
    if (submit) submit.disabled = true;
    try {
      if (register) {
        const payload = await registerBookingAccount(state.tenantId, {
          ...state.accountDraft,
          password,
          consents: currentConsentFacts(state),
        });
        state.account = payload.account;
        state.error = '';
        await refreshAccountConsentState(state);
        if (payload.clientCardExisted) {
          state.clientTab = 'profile';
          await renderAccountHome(root, state);
        } else {
          nextBookingStep(root, state);
        }
        return;
      }

      const payload = await loginBookingAccount(state.tenantId, state.accountDraft.email, password);
      state.account = payload.account;
      state.error = '';
      await saveRegistrationConsents(state);
      state.clientTab = 'profile';
      await renderAccountHome(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось войти';
      renderPassword(root, state);
    }
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
  renderFlowPage(root, state, {
    title: 'Рабочее пространство',
    subtitle: 'Выберите, где хотите записаться',
    back: { data: 'data-booking-workplaces-back', aria: 'Назад' },
    body: content || emptyState('Нет доступных пространств', 'Рабочие пространства для онлайн-записи не найдены.'),
  });
  root.querySelector('[data-booking-workplaces-back]')?.addEventListener('click', () => backFromFirstBookingStep(root, state));
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
  renderFlowPage(root, state, {
    title: 'Процедуры',
    subtitle: 'Выберите всё, что хотите сделать',
    back: { data: 'data-booking-procedures-back', aria: 'Назад' },
    action: { label: 'Далее', data: 'data-booking-procedures-next', disabled: state.procedureIds.length === 0 },
    body: content || emptyState('Процедур нет', 'Для этого рабочего пространства процедуры не настроены.'),
  });
  root.querySelector('[data-booking-procedures-back]')?.addEventListener('click', () => {
    if (state.lockedWorkplaceKey) backFromFirstBookingStep(root, state);
    else renderWorkplaces(root, state);
  });
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
  renderFlowPage(root, state, {
    title: 'Дата',
    subtitle: 'Выберите удобный день',
    back: { data: 'data-booking-dates-back', aria: 'Назад' },
    body: dates.length ? '<div data-booking-calendar></div>' : emptyState('Свободных дат нет', 'В графике пока нет доступных дат.'),
  });
  root.querySelector('[data-booking-dates-back]')?.addEventListener('click', () => renderProcedures(root, state));
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
  renderFlowPage(root, state, {
    title: 'Время',
    subtitle: formatDate(state.date),
    back: { data: 'data-booking-times-back', aria: 'Назад' },
    body: `${slots.length
      ? bookingTimeGroups(slots, { data: 'data-booking-time' })
      : emptyState('Свободного времени нет', 'На эту дату нет интервала для выбранных процедур.')}${errorBlock(state.error)}`,
  });
  root.querySelector('[data-booking-times-back]')?.addEventListener('click', () => renderDates(root, state));
  root.querySelectorAll('[data-booking-time]').forEach((node) => node.addEventListener('click', () => {
    const slot = slots.find((item) => item.from === node.dataset.bookingTime);
    if (!slot) return;
    state.from = slot.from;
    state.to = slot.to;
    state.error = '';
    renderConfirmation(root, state);
  }));
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
      { value: state.from, row: 3 },
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
  renderFlowPage(root, state, {
    title: 'Подтверждение',
    back: { data: 'data-booking-confirm-back', aria: 'Назад' },
    action: { label: 'Подтвердить', data: 'data-booking-confirm' },
    body: `${confirmationCard(state)}${errorBlock(state.error)}`,
    center: true,
  });
  root.querySelector('[data-booking-confirm-back]')?.addEventListener('click', () => {
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
      state.clientTab = 'profile';
      await renderAccountHome(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось подтвердить запись';
      renderConfirmation(root, state);
    }
  });
}

async function startBookingFromAccount(root, state) {
  resetBookingChoice(state);
  try {
    const consentState = await refreshAccountConsentState(state);
    if (consentState.allowed) {
      nextBookingStep(root, state);
      return;
    }
    state.registrationMode = 'repair';
    renderRegistrationAgreements(root, state);
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Не удалось проверить согласия';
    state.registrationMode = 'repair';
    renderRegistrationAgreements(root, state);
  }
}

async function repeatBooking(root, state, request) {
  const procedureIds = requestProcedures(request).map((item) => String(item?.id || '')).filter(Boolean);
  state.repeatSelection = {
    workplaceKey: String(request?.workplaceKey || ''),
    procedureIds,
  };
  state.date = '';
  state.from = '';
  state.to = '';
  try {
    const consentState = await refreshAccountConsentState(state);
    if (consentState.allowed) {
      continueRepeat(root, state);
      return;
    }
    state.repeatSelection = null;
    state.registrationMode = 'repair';
    renderRegistrationAgreements(root, state);
  } catch (error) {
    state.repeatSelection = null;
    state.error = error instanceof Error ? error.message : 'Не удалось проверить согласия';
    state.registrationMode = 'repair';
    renderRegistrationAgreements(root, state);
  }
}

async function renderAccountHome(root, state) {
  await renderClientAccount(root, state, {
    onStartBooking: () => void startBookingFromAccount(root, state),
    onRepeat: (request) => void repeatBooking(root, state, request),
    onLogout: () => {
      clearBookingAccount(state.tenantId);
      state.account = null;
      state.error = '';
      state.clientTab = 'profile';
      state.clientChatOpen = false;
      state.registrationMode = 'initial';
      seedConsents(state, []);
      renderWelcome(root, state);
    },
  });
}

async function refreshContext(state) {
  state.context = await getBookingContext(state.tenantId, state.lockedWorkplaceKey);
  state.settings = normalizeBookingSettings(state.context.settings);
}

export async function renderOnlineBooking(root, { tenantId = '', workplaceKey = '' } = {}) {
  const state = {
    tenantId: String(tenantId || ''),
    lockedWorkplaceKey: String(workplaceKey || ''),
    workplaceKey: String(workplaceKey || ''),
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
    error: '',
    notice: '',
    lastRequest: null,
    repeatSelection: null,
    registrationMode: 'initial',
    clientTab: 'profile',
    clientChatOpen: false,
    clientRequests: [],
  };

  renderFlowPage(root, state, { title: 'Онлайн-запись', subtitle: 'Загрузка…', center: true });
  if (!state.tenantId) {
    renderFlowPage(root, state, { title: 'Онлайн-запись', body: emptyState('Ссылка недействительна', 'В ссылке отсутствует идентификатор онлайн-записи.'), center: true });
    return;
  }

  try {
    await refreshContext(state);
    const account = await getBookingAccount(state.tenantId);
    if (account) {
      state.account = account;
      await refreshAccountConsentState(state);
      await renderAccountHome(root, state);
      return;
    }
    renderWelcome(root, state);
  } catch (error) {
    renderFlowPage(root, state, {
      title: 'Онлайн-запись',
      body: emptyState('Запись недоступна', error instanceof Error ? error.message : 'Не удалось открыть онлайн-запись.'),
      center: true,
    });
  }
}

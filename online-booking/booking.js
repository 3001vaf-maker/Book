import {
  acceptAccountTerms,
  clearAccount,
  createBookingRequest,
  getAccount,
  getAccountConsentState,
  getAccountPlatformState,
  getAccountTerms,
  getBookingContext,
  getRememberedAccountEmail,
  loginAccount,
  prepareAccount,
  registerAccount,
  submitAccountConsents,
} from '../core/account/index.js';
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
import { renderAccount } from './account-shell.js';

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

function currentTenantConsentFacts(state) {
  return requiredBookingDocuments(state.context).map((document) => ({
    documentId: String(document.id || ''),
    documentVersion: Math.max(1, Number(document.version || 1)),
    accepted: Boolean(state.consents[String(document.id || '')]),
    acceptedAt: new Date().toISOString(),
  }));
}

function seedTenantConsents(state, facts = []) {
  state.consents = {};
  for (const fact of Array.isArray(facts) ? facts : []) {
    if (!fact?.accepted) continue;
    state.consents[String(fact.documentId || '')] = true;
  }
}

async function refreshTenantConsentState(state) {
  const consentState = await getAccountConsentState(state.tenantId);
  seedTenantConsents(state, consentState?.consents || []);
  return consentState || { pdnActive: false, consents: [] };
}

async function saveTenantConsents(state) {
  const consents = currentTenantConsentFacts(state);
  const consentState = await submitAccountConsents(state.tenantId, consents);
  seedTenantConsents(state, consentState?.consents || consents);
}


function currentAccountTermsFact(state) {
  const document = state.accountTerms || {};
  return {
    key: String(document.key || ''),
    version: Math.max(1, Number(document.version || 1)),
    accepted: Boolean(state.accountTermsAccepted),
    acceptedAt: new Date().toISOString(),
  };
}

async function loadAccountTerms(state) {
  state.accountTerms = await getAccountTerms();
  state.accountTermsAccepted = false;
  return state.accountTerms;
}

function openAccountTermsDocument(state) {
  const legalDocument = state.accountTerms || {};
  if (!legalDocument.key) return;
  mountModal(globalThis.document.body, modal(bookingDocument({
    title: legalDocument.title || 'Условия использования учетной записи',
    version: legalDocument.version || 1,
    text: legalDocument.content || '',
  }), { variant: 'large' }));
}

function renderAccountTerms(root, state) {
  const document = state.accountTerms || {};
  const canContinue = Boolean(document.key && state.accountTermsAccepted);
  const cards = bookingAgreementCards([{
    label: document.title || 'Условия использования учетной записи',
    checked: Boolean(state.accountTermsAccepted),
    openData: 'data-account-terms-document',
    toggleData: 'data-account-terms-toggle',
    openAria: 'Открыть Условия использования учетной записи',
    toggleAria: state.accountTermsAccepted ? 'Снять подтверждение' : 'Принять Условия использования учетной записи',
  }]);

  renderFlowPage(root, state, {
    title: 'Условия использования учетной записи',
    back: { data: 'data-account-terms-back', aria: 'Назад' },
    action: { label: 'Далее', data: 'data-account-terms-next', disabled: !canContinue },
    body: `${cards}${errorBlock(state.error)}`,
  });

  root.querySelector('[data-account-terms-document]')?.addEventListener('click', () => openAccountTermsDocument(state));
  root.querySelector('[data-account-terms-toggle]')?.addEventListener('click', () => {
    state.accountTermsAccepted = !state.accountTermsAccepted;
    renderAccountTerms(root, state);
  });
  root.querySelector('[data-account-terms-back]')?.addEventListener('click', () => {
    state.error = '';
    if (!state.account) {
      renderAccountEntry(root, state);
      return;
    }
    if (state.identityDestination === 'booking' && state.from) renderTimes(root, state);
    else nextBookingStep(root, state);
  });
  root.querySelector('[data-account-terms-next]')?.addEventListener('click', async (event) => {
    if (!canContinue) return;
    if (!state.account) {
      renderAccountDetails(root, state);
      return;
    }
    event.currentTarget.disabled = true;
    try {
      const accepted = await acceptAccountTerms(state.tenantId, currentAccountTermsFact(state));
      state.accountTerms = accepted?.document || state.accountTerms;
      state.accountTermsAccepted = Boolean(accepted?.accepted);
      await continueAfterIdentity(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось сохранить Условия использования учетной записи';
      renderAccountTerms(root, state);
    }
  });
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
  return `booking-account booking-account--account booking-shape--${shape} booking-choice-style--${choiceStyle}`;
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
  return Array.isArray(request.procedures) ? request.procedures : [];
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
  state.identityDestination = 'profile';
  if (state.account) {
    void renderAccountHome(root, state);
    return;
  }
  renderAccountEntry(root, state);
}

function openTenantDocument(state, documentId) {
  const legalDocument = requiredBookingDocuments(state.context).find((item) => String(item.id) === String(documentId));
  if (!legalDocument) return;
  mountModal(globalThis.document.body, modal(bookingDocument({
    title: legalDocument.title || 'Документ',
    version: legalDocument.version || 1,
    text: legalDocument.text || '',
  }), { variant: 'large' }));
}

function renderWelcome(root, state) {
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
    state.identityDestination = 'booking';
    nextBookingStep(root, state);
  });
}

function renderTenantAgreements(root, state) {
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
    title: 'Согласия',
    back: { data: 'data-booking-agreements-back', aria: 'Назад' },
    action: { label: 'Далее', data: 'data-booking-agreements-next', disabled: !canContinue },
    body: `${documents.length ? cards : emptyState('Документов нет', 'Для этого действия не настроены документы.')}${errorBlock(state.error)}`,
  });
  root.querySelector('[data-booking-agreements-back]')?.addEventListener('click', () => {
    state.error = '';
    if (state.identityDestination === 'booking') renderTimes(root, state);
    else void renderAccountHome(root, state);
  });
  root.querySelectorAll('[data-booking-document]').forEach((node) => node.addEventListener('click', () => openTenantDocument(state, node.dataset.bookingDocument)));
  root.querySelectorAll('[data-booking-consent]').forEach((node) => node.addEventListener('click', () => {
    const id = String(node.dataset.bookingConsent || '');
    state.consents[id] = !state.consents[id];
    renderTenantAgreements(root, state);
  }));
  root.querySelector('[data-booking-agreements-next]')?.addEventListener('click', async (event) => {
    if (!canContinue) return;
    event.currentTarget.disabled = true;
    try {
      await saveTenantConsents(state);
      if (state.identityDestination === 'booking') renderConfirmation(root, state);
      else await renderAccountHome(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось сохранить согласия';
      renderTenantAgreements(root, state);
    }
  });
}

function renderAccountEntry(root, state) {
  const rememberedIdentifier = state.accountDraft?.identifier
    || state.accountDraft?.email
    || getRememberedAccountEmail(state.tenantId)
    || '';
  renderFlowPage(root, state, {
    title: 'Вход или регистрация',
    subtitle: 'Введите телефон или email',
    back: { data: 'data-booking-entry-back', aria: 'Назад' },
    action: { label: 'Далее', data: 'data-booking-entry-submit' },
    body: `<form data-booking-entry-form>${field({ label: 'Телефон или email', name: 'identifier', value: rememberedIdentifier, required: true, autocomplete: 'username' })}${errorBlock(state.error)}</form>`,
    center: true,
  });
  const form = root.querySelector('[data-booking-entry-form]');
  root.querySelector('[data-booking-entry-back]')?.addEventListener('click', () => {
    state.error = '';
    if (state.identityDestination === 'booking' && state.from) renderTimes(root, state);
    else nextBookingStep(root, state);
  });
  root.querySelector('[data-booking-entry-submit]')?.addEventListener('click', () => form?.requestSubmit());
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const identifier = String(new FormData(form).get('identifier') || '').trim();
    const submit = root.querySelector('[data-booking-entry-submit]');
    if (submit) submit.disabled = true;
    try {
      const prepared = await prepareAccount(state.tenantId, { identifier });
      state.accountDraft = {
        ...(state.accountDraft || {}),
        identifier,
        ...(prepared.identifierType === 'EMAIL' ? { email: identifier.toLowerCase() } : {}),
        ...(prepared.identifierType === 'PHONE' ? { phone: identifier } : {}),
      };
      state.contactErrors = {};
      state.passwordMode = prepared.exists ? 'login' : 'register';
      state.error = '';
      if (prepared.exists) {
        renderPassword(root, state);
      } else {
        await loadAccountTerms(state);
        renderAccountTerms(root, state);
      }
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось проверить аккаунт';
      renderAccountEntry(root, state);
    }
  });
}

function renderAccountDetails(root, state) {
  const draft = state.accountDraft || {};
  const contactErrors = state.contactErrors || {};
  renderFlowPage(root, state, {
    title: 'Ваши данные',
    subtitle: 'Они сохранятся в вашей учетной записи',
    back: { data: 'data-booking-account-back', aria: 'Назад' },
    action: { label: 'Далее', data: 'data-booking-account-submit' },
    body: `<form data-booking-account-form>${field({ label: 'Имя', name: 'name', value: draft.name || '', required: true, autocomplete: 'given-name' })}${field({ label: 'Фамилия', name: 'surname', value: draft.surname || '', autocomplete: 'family-name' })}${field({ label: 'Email', name: 'email', value: draft.email || '', type: 'email', required: true, autocomplete: 'email' })}${errorBlock(contactErrors.email || '')}${phoneField({ label: 'Телефон', name: 'phone', value: draft.phone || '', required: true })}${errorBlock(contactErrors.phone || '')}${errorBlock(state.error)}</form>`,
  });
  const form = root.querySelector('[data-booking-account-form]');
  root.querySelector('[data-booking-account-back]')?.addEventListener('click', () => {
    state.error = '';
    state.contactErrors = {};
    renderAccountTerms(root, state);
  });
  root.querySelector('[data-booking-account-submit]')?.addEventListener('click', () => form?.requestSubmit());
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const phone = String(data.get('phone') || '').trim();
    state.accountDraft = {
      ...(state.accountDraft || {}),
      name: String(data.get('name') || '').trim(),
      surname: String(data.get('surname') || '').trim(),
      email,
      phone,
    };
    const submit = root.querySelector('[data-booking-account-submit]');
    if (submit) submit.disabled = true;
    try {
      const prepared = await prepareAccount(state.tenantId, { email, phone });
      const contactMessage = 'Этот контакт уже зарегистрирован. Войдите в учетную запись или восстановите пароль.';
      state.contactErrors = {
        email: prepared?.conflicts?.email ? contactMessage : '',
        phone: prepared?.conflicts?.phone ? contactMessage : '',
      };
      if (state.contactErrors.email || state.contactErrors.phone) {
        state.error = '';
        renderAccountDetails(root, state);
        return;
      }
      state.contactErrors = {};
      state.passwordMode = 'register';
      state.error = '';
      renderPassword(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось проверить контакты';
      renderAccountDetails(root, state);
    }
  });
}

function renderPassword(root, state) {
  const register = state.passwordMode !== 'login';
  renderFlowPage(root, state, {
    title: register ? 'Создайте пароль' : 'Введите пароль',
    subtitle: register ? (state.accountDraft.email || state.accountDraft.phone || '') : (state.accountDraft.identifier || ''),
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
        const payload = await registerAccount(state.tenantId, {
          ...state.accountDraft,
          password,
          accountTerms: currentAccountTermsFact(state),
        });
        state.account = payload.account;
        state.error = '';
        await continueAfterIdentity(root, state);
        return;
      }

      const payload = await loginAccount(state.tenantId, state.accountDraft.identifier, password);
      state.account = payload.account;
      state.error = '';
      await continueAfterIdentity(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось войти';
      renderPassword(root, state);
    }
  });
}

async function continueAfterIdentity(root, state) {
  if (!state.account) {
    renderAccountEntry(root, state);
    return;
  }

  try {
    const platformState = await getAccountPlatformState(state.tenantId);
    state.accountTerms = platformState?.document || state.accountTerms;
    state.accountTermsAccepted = Boolean(platformState?.accepted);
    if (!platformState?.accepted) {
      renderAccountTerms(root, state);
      return;
    }

    if (state.identityDestination === 'profile') {
      state.accountTab = 'profile';
      await renderAccountHome(root, state);
      return;
    }

    const consentState = await refreshTenantConsentState(state);
    if (consentState.pdnActive) {
      renderConfirmation(root, state);
      return;
    }
    renderTenantAgreements(root, state);
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Не удалось проверить юридический статус';
    try {
      await loadAccountTerms(state);
      renderAccountTerms(root, state);
    } catch {
      renderFlowPage(root, state, {
        title: 'Проверка учетной записи',
        back: { data: 'data-account-status-back', aria: 'Назад' },
        body: errorBlock(state.error),
        center: true,
      });
      root.querySelector('[data-account-status-back]')?.addEventListener('click', () => {
        if (state.identityDestination === 'booking' && state.from) renderTimes(root, state);
        else nextBookingStep(root, state);
      });
    }
  }
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
  const dates = getBookingWorkingDates(state.context, state.workplaceKey);
  const first = dates[0] || '2000-01-01';
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
    state.identityDestination = 'booking';
    void continueAfterIdentity(root, state);
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
      state.accountTab = 'profile';
      await renderAccountHome(root, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось подтвердить запись';
      renderConfirmation(root, state);
    }
  });
}

async function startBookingFromAccount(root, state) {
  resetBookingChoice(state);
  state.identityDestination = 'booking';
  nextBookingStep(root, state);
}

async function repeatBooking(root, state, request) {
  const procedureIds = requestProcedures(request).map((item) => String(item?.id || '')).filter(Boolean);
  state.repeatSelection = {
    workplaceKey: String(request?.workplaceId || ''),
    procedureIds,
  };
  state.date = '';
  state.from = '';
  state.to = '';
  state.identityDestination = 'booking';
  continueRepeat(root, state);
}

async function renderAccountHome(root, state) {
  await renderAccount(root, state, {
    onStartBooking: () => void startBookingFromAccount(root, state),
    onRepeat: (request) => void repeatBooking(root, state, request),
    onLogout: () => {
      clearAccount(state.tenantId);
      state.account = null;
      state.error = '';
      state.accountTab = 'profile';
      state.accountChatOpen = false;
      seedTenantConsents(state, []);
      state.accountTerms = null;
      state.accountTermsAccepted = false;
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
    contactErrors: {},
    account: null,
    accountTerms: null,
    accountTermsAccepted: false,
    consents: {},
    passwordMode: 'register',
    error: '',
    notice: '',
    lastRequest: null,
    repeatSelection: null,
    identityDestination: 'booking',
    accountTab: 'profile',
    accountChatOpen: false,
    accountRequests: [],
  };

  renderFlowPage(root, state, { title: 'Онлайн-запись', subtitle: 'Загрузка…', center: true });
  if (!state.tenantId) {
    renderFlowPage(root, state, { title: 'Онлайн-запись', body: emptyState('Ссылка недействительна', 'В ссылке отсутствует идентификатор онлайн-записи.'), center: true });
    return;
  }

  try {
    await refreshContext(state);
    const account = await getAccount(state.tenantId);
    if (account) state.account = account;
    renderWelcome(root, state);
  } catch (error) {
    renderFlowPage(root, state, {
      title: 'Онлайн-запись',
      body: emptyState('Запись недоступна', error instanceof Error ? error.message : 'Не удалось открыть онлайн-запись.'),
      center: true,
    });
  }
}

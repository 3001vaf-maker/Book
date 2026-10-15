import {
  acceptAccountTerms,
  accountErrorMessage,
  createBookingRequest,
  getAccount,
  getAccountConsentState,
  getAccountPlatformState,
  getAccountTerms,
  getBookingContext,
  getRememberedAccountEmail,
  isAccountSystemError,
  loginAccount,
  prepareAccount,
  registerAccount,
  submitAccountConsents,
} from '../core/account/index.js';
import { normalizeBookingSettings } from '../core/booking-settings/index.js';
import {
  button,
  documentTile,
  documentTiles,
  emptyState,
  escapeHtml,
  field,
  formValidationMessage,
  initCalendar,
  initPasswordFields,
  initV2StickerSwipe,
  openDocumentViewer,
  openNotice,
  openRecordCreationOwner,
  passwordField,
  phoneField,
  recordConfirmationMiniCard,
  recordCreationTimeRows,
  recordProcedureList,
  recordWorkplaceCards,
  v2Sticker,
} from '../ui/ui.js';
import { formError, formView } from '../ui/forms/index.js';
import {
  bookingProcedureCost,
  bookingSelection,
  getBookingProcedures,
  getBookingSlots,
  getBookingTimeRows,
  getBookingWorkingDates,
  getBookingWorkplace,
  requiredBookingDocuments,
} from './model.js';
import { workplaceCardAppearance, workplaceCardFields } from '../core/profile/card-presentation.js';

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

function selectedSubtotal(state) {
  return bookingSelection(state.context, state.workplaceKey, state.procedureIds)
    .reduce((sum, procedure) => sum + numericCost(bookingProcedureCost(procedure, state.workplaceKey)), 0);
}

function accountDiscount(account = {}) {
  const value = Number(account?.discountPercent || 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function accountFlowError(error, fallbackMessage) {
  const message = accountErrorMessage(error, fallbackMessage);
  if (!isAccountSystemError(error)) return message;
  openNotice({ title: 'Не удалось выполнить действие', message, variant: 'technical' });
  return '';
}

function representativeName(state) {
  const profile = state.context?.profile || {};
  return [profile.name, profile.surname].filter(Boolean).join(' ').trim() || 'Запись';
}

function representativePhoto(state) {
  return String(state.context?.profile?.photo || '');
}

function exitBookingContext(state, target = {}) {
  if (typeof state.onExitToAccount !== 'function') return false;
  state.onExitToAccount(target);
  return true;
}

function openConsentDocument(document = {}) {
  return openDocumentViewer({
    title: document?.title || 'Документ',
    version: document?.version || 1,
    content: document?.content ?? document?.text ?? '',
  });
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
    if (fact?.accepted) state.consents[String(fact.documentId || '')] = true;
  }
}

async function refreshContext(state) {
  state.context = await getBookingContext(state.tenantId, state.lockedWorkplaceKey);
  state.settings = normalizeBookingSettings(state.context.settings);
}

async function loadLegalState(state) {
  const platform = await getAccountPlatformState(state.tenantId);
  state.accountTerms = platform?.document || state.accountTerms || await getAccountTerms();
  state.accountTermsAccepted = Boolean(platform?.accepted);
  const tenant = await getAccountConsentState(state.tenantId).catch(() => ({ pdnActive: false, consents: [] }));
  seedTenantConsents(state, tenant?.consents || []);
  return { platform, tenant };
}

function renderWelcome(root, state) {
  const profile = state.context?.profile || {};
  const owner = [profile.name, profile.surname].filter(Boolean).join(' ').trim();
  const continueFlow = () => {
    if (state.account) void continueAfterIdentity(root, state);
    else renderAccountEntry(root, state);
  };
  root.innerHTML = `<section class="booking-account booking-account--account booking-account--v2">${v2Sticker({
    eyebrow: owner ? `Приглашение от ${escapeHtml(owner)}` : '',
    title: state.settings.welcomeTitle || '',
    body: state.settings.welcomeText ? `<p>${escapeHtml(state.settings.welcomeText).replaceAll('\n', '<br>')}</p>` : '',
    action: button('Продолжить', { data: 'data-booking-x-welcome' }),
    className: 'v2-sticker-screen--welcome',
    closeData: 'data-booking-x-welcome-close',
  })}</section>`;
  root.querySelector('[data-booking-x-welcome]')?.addEventListener('click', continueFlow);
  root.querySelector('[data-booking-x-welcome-close]')?.addEventListener('click', continueFlow);
  initV2StickerSwipe(root, { onRight: continueFlow, onLeft: continueFlow });
}

function renderAccountEntry(root, state) {
  const remembered = state.accountDraft?.identifier || getRememberedAccountEmail(state.tenantId) || '';
  const form = formView(`
    ${field({ label: 'Телефон или email', name: 'identifier', value: remembered, required: true, autocomplete: 'username' })}
    ${passwordField({ label: 'Пароль', name: 'password', required: true, autocomplete: 'current-password' })}
    ${formError(state.error)}
    <button type="button" class="v2-sticker-link" data-booking-x-register>Зарегистрироваться</button>
  `, { data: 'id="booking-x-entry-form" data-booking-x-entry-form' });
  root.innerHTML = `<section class="booking-account booking-account--account booking-account--v2">${v2Sticker({
    title: 'Вход',
    body: form,
    action: '<button class="ui-button" type="submit" form="booking-x-entry-form">Войти</button>',
    className: 'v2-sticker-screen--auth',
    closeData: 'data-booking-x-auth-close',
  })}</section>`;
  initPasswordFields(root);
  const authForm = root.querySelector('[data-booking-x-entry-form]');
  root.querySelector('[data-booking-x-auth-close]')?.addEventListener('click', () => {
    if (state.entry === 'account-booking' && exitBookingContext(state, { tab: 'contact-detail', tenantId: state.tenantId })) return;
    renderWelcome(root, state);
  });
  root.querySelector('[data-booking-x-register]')?.addEventListener('click', async () => {
    const data = new FormData(authForm);
    const identifier = String(data.get('identifier') || '').trim();
    state.accountDraft = { identifier, ...(identifier.includes('@') ? { email: identifier.toLowerCase() } : {}) };
    state.error = '';
    state.accountTerms = await getAccountTerms().catch(() => null);
    renderAccountDetails(root, state);
  });
  authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validationError = formValidationMessage(authForm);
    if (validationError) {
      state.error = validationError;
      renderAccountEntry(root, state);
      return;
    }
    const data = new FormData(authForm);
    const identifier = String(data.get('identifier') || '').trim();
    const password = String(data.get('password') || '');
    try {
      const prepared = await prepareAccount(state.tenantId, { identifier });
      if (!prepared.exists) {
        state.accountDraft = { identifier, ...(prepared.identifierType === 'EMAIL' ? { email: identifier.toLowerCase() } : {}), ...(prepared.identifierType === 'PHONE' ? { phone: identifier } : {}) };
        state.error = 'Аккаунт не найден. Выберите «Зарегистрироваться».';
        renderAccountEntry(root, state);
        return;
      }
      const payload = await loginAccount(state.tenantId, identifier, password);
      state.account = payload.account;
      state.error = '';
      await continueAfterIdentity(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось войти');
      renderAccountEntry(root, state);
    }
  });
}

function renderAccountDetails(root, state) {
  const draft = state.accountDraft || {};
  const form = formView(`
    ${field({ label: 'Имя', name: 'name', value: draft.name || '', required: true, autocomplete: 'given-name' })}
    ${field({ label: 'Фамилия', name: 'surname', value: draft.surname || '', autocomplete: 'family-name' })}
    ${phoneField({ label: 'Телефон', name: 'phone', value: draft.phone || '', required: true })}
    ${field({ label: 'Email', name: 'email', value: draft.email || '', type: 'email', required: true, autocomplete: 'email' })}
    ${passwordField({ label: 'Пароль', name: 'password', required: true, autocomplete: 'new-password' })}
    ${passwordField({ label: 'Повтор пароля', name: 'repeatPassword', required: true, autocomplete: 'new-password' })}
    ${formError(state.error)}
  `, { data: 'id="booking-x-register-form" data-booking-x-register-form' });
  root.innerHTML = `<section class="booking-account booking-account--account booking-account--v2">${v2Sticker({
    title: 'Регистрация',
    body: form,
    action: '<button class="ui-button" type="submit" form="booking-x-register-form">Подтвердить</button>',
    closeData: 'data-booking-x-register-close',
  })}</section>`;
  initPasswordFields(root);
  root.querySelector('[data-booking-x-register-close]')?.addEventListener('click', () => renderAccountEntry(root, state));
  const registerForm = root.querySelector('[data-booking-x-register-form]');
  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validationError = formValidationMessage(registerForm);
    if (validationError) {
      state.error = validationError;
      renderAccountDetails(root, state);
      return;
    }
    const data = new FormData(registerForm);
    const password = String(data.get('password') || '');
    if (password !== String(data.get('repeatPassword') || '')) {
      state.error = 'Пароли не совпадают.';
      renderAccountDetails(root, state);
      return;
    }
    const email = String(data.get('email') || '').trim().toLowerCase();
    const phone = String(data.get('phone') || '').trim();
    state.accountDraft = {
      name: String(data.get('name') || '').trim(),
      surname: String(data.get('surname') || '').trim(),
      email,
      phone,
      password,
    };
    try {
      const prepared = await prepareAccount(state.tenantId, { email, phone });
      if (prepared?.conflicts?.email || prepared?.conflicts?.phone) {
        state.error = 'Этот контакт уже зарегистрирован. Войдите в учетную запись.';
        renderAccountDetails(root, state);
        return;
      }
      if (!state.accountTerms) state.accountTerms = await getAccountTerms();
      state.accountTermsAccepted = false;
      renderLegal(root, state, { registration: true });
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось проверить контакты');
      renderAccountDetails(root, state);
    }
  });
}

function renderLegal(root, state, { registration = false } = {}) {
  const tenantDocuments = requiredBookingDocuments(state.context);
  const platformDocument = state.accountTerms && !state.accountTermsAccepted
    ? { ...state.accountTerms, platform: true, required: true }
    : null;
  const documents = [...(platformDocument ? [platformDocument] : []), ...tenantDocuments];
  const canContinue = (!platformDocument || state.accountTermsAccepted)
    && tenantDocuments.filter((document) => document.required).every((document) => state.consents[String(document.id || '')]);
  const cards = documentTiles(documents.map((document) => documentTile({
    title: document.platform ? 'Условия использования' : document.required ? 'Согласие на обработку персональных данных' : 'Согласие на получение рекламы',
    version: document.version || 1,
    openData: document.platform ? 'data-booking-x-platform-document' : `data-booking-x-document="${escapeHtml(document.id)}"`,
    toggleData: document.platform ? 'data-booking-x-platform-toggle' : `data-booking-x-consent="${escapeHtml(document.id)}"`,
    toggleChecked: document.platform ? Boolean(state.accountTermsAccepted) : Boolean(state.consents[String(document.id || '')]),
  })), { layout: 'rail' });
  root.innerHTML = `<section class="booking-account booking-account--account booking-account--v2">${v2Sticker({
    title: 'Документы',
    body: `${cards}${button('Продолжить', { data: 'data-booking-x-legal-continue', disabled: !canContinue })}${formError(state.error)}`,
    closeData: 'data-booking-x-legal-close',
  })}</section>`;
  root.querySelector('[data-booking-x-legal-close]')?.addEventListener('click', () => registration ? renderAccountDetails(root, state) : renderAccountEntry(root, state));
  root.querySelector('[data-booking-x-platform-document]')?.addEventListener('click', () => openConsentDocument(state.accountTerms));
  root.querySelector('[data-booking-x-platform-toggle]')?.addEventListener('click', () => {
    state.accountTermsAccepted = !state.accountTermsAccepted;
    renderLegal(root, state, { registration });
  });
  root.querySelectorAll('[data-booking-x-document]').forEach((node) => node.addEventListener('click', () => {
    const document = tenantDocuments.find((item) => String(item.id) === String(node.dataset.bookingXDocument));
    if (document) openConsentDocument(document);
  }));
  root.querySelectorAll('[data-booking-x-consent]').forEach((node) => node.addEventListener('click', () => {
    const id = String(node.dataset.bookingXConsent || '');
    state.consents[id] = !state.consents[id];
    renderLegal(root, state, { registration });
  }));
  root.querySelector('[data-booking-x-legal-continue]')?.addEventListener('click', async () => {
    if (!canContinue) return;
    try {
      if (!state.account) {
        const payload = await registerAccount(state.tenantId, {
          ...state.accountDraft,
          accountTerms: currentAccountTermsFact(state),
        });
        state.account = payload.account;
      } else if (platformDocument) {
        const accepted = await acceptAccountTerms(state.tenantId, currentAccountTermsFact(state));
        state.accountTermsAccepted = Boolean(accepted?.accepted);
      }
      const consents = currentTenantConsentFacts(state);
      if (consents.length) {
        const saved = await submitAccountConsents(state.tenantId, consents);
        seedTenantConsents(state, saved?.consents || consents);
      }
      state.error = '';
      startBookingFlow(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось сохранить документы');
      renderLegal(root, state, { registration });
    }
  });
}

async function continueAfterIdentity(root, state) {
  if (!state.account) {
    renderAccountEntry(root, state);
    return;
  }
  try {
    const { platform, tenant } = await loadLegalState(state);
    if (!platform?.accepted || !tenant?.pdnActive) {
      renderLegal(root, state);
      return;
    }
    startBookingFlow(root, state);
  } catch (error) {
    state.error = accountFlowError(error, 'Не удалось проверить учетную запись');
    renderAccountEntry(root, state);
  }
}

function ensureBookingOwner(state) {
  if (state.flowOwner?.isOpen()) return state.flowOwner;
  state.flowOwner = openRecordCreationOwner({
    onCancel: () => {
      state.flowOwner = null;
      state.procedureIds = [];
      state.date = '';
      state.from = '';
      state.to = '';
      if (state.entry === 'account-booking') exitBookingContext(state, { tab: 'contact-detail', tenantId: state.tenantId });
    },
  });
  return state.flowOwner;
}

function workplaceItems(state) {
  const profile = state.context?.profile || {};
  return (Array.isArray(state.context.workplaces) ? state.context.workplaces : []).map((workplace) => ({
    ...workplace,
    appearance: workplaceCardAppearance(workplace),
    fields: workplaceCardFields(workplace, workplace.cardProfile || profile),
    image: workplace.photo || '',
    imagePosition: `${Number(workplace.photoCropX || 50)}% ${Number(workplace.photoCropY || 50)}%`,
  }));
}

function renderWorkplaces(state) {
  const owner = ensureBookingOwner(state);
  const workplaces = workplaceItems(state);
  const body = workplaces.length
    ? recordWorkplaceCards(workplaces, { data: 'data-booking-x-workplace' })
    : emptyState('Нет доступных пространств', 'Рабочие пространства для онлайн-записи не найдены.');
  const view = owner?.render({ step: 'workplace', body });
  view?.body?.querySelectorAll('[data-booking-x-workplace]').forEach((node) => node.addEventListener('click', () => {
    state.workplaceKey = String(node.dataset.bookingXWorkplace || '');
    state.procedureIds = [];
    state.date = '';
    state.from = '';
    state.to = '';
    renderProcedures(state);
  }));
}

function renderProcedures(state) {
  const owner = ensureBookingOwner(state);
  const procedures = getBookingProcedures(state.context, state.workplaceKey);
  const render = () => {
    const body = recordProcedureList(procedures.map((procedure) => ({
      id: String(procedure.id || ''),
      name: procedure.name || '',
      durationText: procedure.duration ? `${Number(procedure.duration)} мин` : '',
      costText: bookingProcedureCost(procedure, state.workplaceKey) !== '' ? money(bookingProcedureCost(procedure, state.workplaceKey)) : '',
    })), {
      selected: state.procedureIds,
      data: 'data-booking-x-procedure',
      empty: 'Для этого рабочего пространства процедуры не настроены.',
    });
    const view = owner?.render({
      step: 'procedures',
      body,
      action: { label: 'Далее', data: 'data-booking-x-procedures-next', disabled: state.procedureIds.length === 0 },
    });
    view?.body?.querySelectorAll('[data-booking-x-procedure]').forEach((node) => node.addEventListener('click', () => {
      const id = String(node.dataset.bookingXProcedure || '');
      const selected = new Set(state.procedureIds);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      state.procedureIds = [...selected];
      state.date = '';
      state.from = '';
      state.to = '';
      render();
    }));
    view?.action?.addEventListener('click', () => {
      if (!state.procedureIds.length) return;
      renderDates(state);
    });
  };
  render();
}

function renderDates(state) {
  const owner = ensureBookingOwner(state);
  const dates = getBookingWorkingDates(state.context, state.workplaceKey);
  const first = state.date || dates[0] || '2000-01-01';
  const firstDate = new Date(`${first}T00:00:00`);
  const view = owner?.render({
    step: 'date',
    body: dates.length ? '<div data-booking-x-calendar></div>' : emptyState('Свободных дат нет', 'В графике пока нет доступных дат.'),
  });
  const calendarRoot = view?.body?.querySelector('[data-booking-x-calendar]');
  if (!calendarRoot) return;
  initCalendar(calendarRoot, {
    month: new Date(firstDate.getFullYear(), firstDate.getMonth(), 1),
    selectedValue: state.date || '',
    workingDates: dates,
    onDateSelect: (date) => {
      if (!dates.includes(date)) return;
      state.date = date;
      state.from = '';
      state.to = '';
      renderTimes(state);
    },
  });
}

function renderTimes(state) {
  const owner = ensureBookingOwner(state);
  const freeSlots = getBookingSlots(state.context, {
    workplaceKey: state.workplaceKey,
    date: state.date,
    procedureIds: state.procedureIds,
    step: state.settings.slotStep,
  });
  const rows = getBookingTimeRows(state.context, {
    workplaceKey: state.workplaceKey,
    date: state.date,
    procedureIds: state.procedureIds,
    step: state.settings.slotStep,
  });
  const view = owner?.render({
    step: 'time',
    body: rows.length
      ? recordCreationTimeRows(rows, { data: 'data-booking-x-time', selected: state.from })
      : emptyState('Свободного времени нет', 'На эту дату нет интервала для выбранных процедур.'),
  });
  view?.body?.querySelectorAll('[data-booking-x-time]:not(:disabled)').forEach((node) => node.addEventListener('click', () => {
    const slot = freeSlots.find((item) => String(item.from) === String(node.dataset.bookingXTime));
    if (!slot) return;
    state.from = slot.from;
    state.to = slot.to;
    renderConfirmation(state);
  }));
}

function confirmationCard(state) {
  const workplace = getBookingWorkplace(state.context, state.workplaceKey) || {};
  const procedures = bookingSelection(state.context, state.workplaceKey, state.procedureIds);
  const discount = accountDiscount(state.account);
  const total = Math.max(0, selectedSubtotal(state) * (1 - discount / 100));
  const duration = procedures.reduce((sum, procedure) => sum + Math.max(0, Number(procedure.duration || 0)), 0);
  const accountName = [state.account?.name, state.account?.surname].filter(Boolean).join(' ').trim();
  const accountPhone = String(state.account?.phone || state.account?.phones?.[0] || '');
  const uei = String(state.account?.uei || state.account?.person?.uei || '');
  return recordConfirmationMiniCard({
    workplace: workplace.name || representativeName(state),
    date: formatDate(state.date),
    period: `${state.from || ''} - ${state.to || ''}`,
    uei,
    name: accountName || 'Запись',
    phone: accountPhone,
    duration: duration ? `${duration} мин` : '—',
    discount: `${discount}%`,
    total: money(total),
    procedures: procedures.map((procedure) => ({
      name: procedure.name || '',
      durationText: procedure.duration ? `${Number(procedure.duration)} мин` : '',
      right: money(bookingProcedureCost(procedure, state.workplaceKey)),
    })),
  });
}

function renderConfirmation(state) {
  const owner = ensureBookingOwner(state);
  const view = owner?.render({
    step: 'confirmation',
    body: `${confirmationCard(state)}${formError(state.error)}`,
    action: { label: 'Подтвердить', data: 'data-booking-x-confirm' },
  });
  view?.action?.addEventListener('click', () => { void finalizeBookingRequest(state); });
}

async function finalizeBookingRequest(state) {
  const stillAvailable = () => getBookingSlots(state.context, {
    workplaceKey: state.workplaceKey,
    date: state.date,
    procedureIds: state.procedureIds,
    step: state.settings.slotStep,
  }).some((slot) => String(slot.from || '') === String(state.from || ''));
  try {
    await refreshContext(state);
    if (!stillAvailable()) {
      state.error = 'Выбранное время уже недоступно. Выберите другое.';
      state.from = '';
      state.to = '';
      renderTimes(state);
      return;
    }
    await createBookingRequest(state.tenantId, {
      workplaceKey: state.workplaceKey,
      date: state.date,
      from: state.from,
      procedureIds: state.procedureIds,
    });
    state.flowOwner?.commit();
    state.flowOwner = null;
    if (!exitBookingContext(state, { tab: 'contact-detail', tenantId: state.tenantId })) {
      document.querySelector('#app')?.replaceChildren();
      openNotice({ title: 'Запись создана', message: 'Запись отправлена специалисту.' });
    }
  } catch (error) {
    await refreshContext(state).catch(() => {});
    if (state.from && !stillAvailable()) {
      state.error = 'Выбранное время уже занято или стало недоступно. Выберите другое.';
      state.from = '';
      state.to = '';
      renderTimes(state);
      return;
    }
    state.error = accountFlowError(error, 'Не удалось подтвердить запись');
    renderConfirmation(state);
  }
}

function startBookingFlow(root, state) {
  const workplaces = Array.isArray(state.context.workplaces) ? state.context.workplaces : [];
  if (!workplaces.length) {
    openNotice({ title: 'Запись недоступна', message: 'Рабочие пространства не настроены.' });
    return;
  }
  if (state.lockedWorkplaceKey) {
    state.workplaceKey = state.lockedWorkplaceKey;
  } else if (workplaces.length === 1) {
    state.workplaceKey = String(workplaces[0]?.key || '');
  }
  if (!state.workplaceKey) {
    renderWorkplaces(state);
    return;
  }
  if (state.repeatProcedureIds.length) {
    const allowed = new Set(getBookingProcedures(state.context, state.workplaceKey).map((procedure) => String(procedure.id || '')));
    state.procedureIds = state.repeatProcedureIds.filter((id) => allowed.has(String(id)));
  }
  if (state.procedureIds.length) renderDates(state);
  else renderProcedures(state);
}

export async function renderOnlineBookingX(root, {
  tenantId = '',
  workplaceKey = '',
  procedureIds = [],
  entry = '',
  onExitToAccount = null,
} = {}) {
  const state = {
    tenantId: String(tenantId || ''),
    lockedWorkplaceKey: String(workplaceKey || ''),
    workplaceKey: String(workplaceKey || ''),
    repeatProcedureIds: [...new Set((Array.isArray(procedureIds) ? procedureIds : []).map((value) => String(value || '').trim()).filter(Boolean))],
    procedureIds: [],
    date: '',
    from: '',
    to: '',
    context: {},
    settings: normalizeBookingSettings(),
    accountDraft: {},
    account: null,
    accountTerms: null,
    accountTermsAccepted: false,
    consents: {},
    error: '',
    entry: String(entry || ''),
    onExitToAccount,
    flowOwner: null,
  };

  if (!state.tenantId) {
    root.innerHTML = emptyState('Ссылка недействительна', 'В ссылке отсутствует идентификатор онлайн-записи.');
    return;
  }

  root.innerHTML = emptyState('Онлайн-запись', 'Загрузка…');
  try {
    await refreshContext(state);
    state.account = await getAccount(state.tenantId);
    if (state.entry === 'account-booking') {
      if (state.account) await continueAfterIdentity(root, state);
      else renderAccountEntry(root, state);
      return;
    }
    if (state.account) {
      await continueAfterIdentity(root, state);
      return;
    }
    renderWelcome(root, state);
  } catch (error) {
    root.innerHTML = emptyState('Запись недоступна', accountFlowError(error, 'Не удалось открыть онлайн-запись.'));
  }
}

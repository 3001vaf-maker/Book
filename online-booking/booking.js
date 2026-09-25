import {
  acceptAccountTerms,
  accountErrorMessage,
  isAccountSystemError,
  acceptGlobalAccountTerms,
  clearAccount,
  createBookingRequest,
  getAccount,
  getAccountConsentState,
  getGlobalAccount,
  getGlobalAccountPlatformState,
  getGlobalAccountRecords,
  getGlobalAccountRelationships,
  getAccountPlatformState,
  getAccountTerms,
  getBookingContext,
  getRememberedAccountEmail,
  loginAccount,
  loginGlobalAccount,
  prepareAccount,
  prepareGlobalAccount,
  registerAccount,
  registerGlobalAccount,
  submitAccountConsents,
} from '../core/account/index.js';
import { normalizeBookingSettings } from '../core/booking-settings/index.js';
import {
  bookingChoiceCards,
  bookingThemeStyle,
  bookingTimeGroups,
  button,
  emptyState,
  escapeHtml,
  field,
  formValidationMessage,
  initCalendar,
  initPasswordFields,
  initV2StickerSwipe,
  initV2Swipe,
  openNotice,
  passwordField,
  phoneField,
  v2Document,
  v2Header,
  v2LegalCards,
  v2ServiceStickers,
  v2Shell,
  v2Sticker,
} from '../ui/ui.js';
import { formError, formView } from '../ui/forms/index.js';
import {
  bookingProcedureCost,
  bookingSelection,
  getBookingProcedures,
  getBookingSlots,
  getBookingWorkingDates,
  getBookingWorkplace,
  requiredBookingDocuments,
} from './model.js';
import { renderAccount, renderGlobalAccount } from './account-shell.js';

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

function accountFlowError(error, fallbackMessage) {
  const message = accountErrorMessage(error, fallbackMessage);
  if (!isAccountSystemError(error)) return message;
  openNotice({
    title: 'Не удалось выполнить действие',
    message,
    action: 'Закрыть',
    variant: 'technical',
  });
  return '';
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

function renderExpandedDocument(root, state, document, onBack) {
  const content = v2Document({
    title: document?.title || 'Документ',
    version: document?.version || 1,
    content: document?.content ?? document?.text ?? '',
  });
  root.innerHTML = `<section class="${flowThemeClasses(state)}" style="${bookingThemeStyle(state.settings)}">${v2Sticker({ body: content, className: 'v2-sticker-screen--legal-document' })}</section>`;
  initV2StickerSwipe(root, { onRight: onBack });
}

function legalTitle(document = {}) {
  if (document.platform) return 'Условия использования';
  return document.required ? 'Согласие на обработку персональных данных' : 'Согласие на получение рекламы';
}

function renderLegalSticker(root, state) {
  const tenantDocuments = state.platformOnlyLegal ? [] : requiredBookingDocuments(state.context);
  const platformDocument = state.accountTerms && !state.accountTermsAccepted
    ? { ...state.accountTerms, platform: true, required: true }
    : null;
  const documents = [...(platformDocument ? [platformDocument] : []), ...tenantDocuments];
  const platformReady = !platformDocument || state.accountTermsAccepted;
  const tenantReady = tenantDocuments.filter((document) => document.required).every((document) => state.consents[String(document.id || '')]);
  const canContinue = platformReady && tenantReady;

  const cards = v2LegalCards(documents.map((document) => ({
    title: legalTitle(document),
    required: Boolean(document.required),
    checked: document.platform ? Boolean(state.accountTermsAccepted) : Boolean(state.consents[String(document.id || '')]),
    openData: document.platform ? 'data-legal-platform-document' : `data-booking-document="${escapeHtml(document.id)}"`,
    toggleData: document.platform ? 'data-legal-platform-toggle' : `data-booking-consent="${escapeHtml(document.id)}"`,
    openAria: `Открыть ${legalTitle(document)}`,
    toggleAria: `Изменить согласие: ${legalTitle(document)}`,
  })));

  const action = button('Продолжить', { data: 'data-legal-continue', disabled: !canContinue });
  root.innerHTML = `<section class="${flowThemeClasses(state)}" style="${bookingThemeStyle(state.settings)}">${v2Sticker({
    title: 'Документы',
    body: `${cards}${formError(state.error)}`,
    action,
    className: 'v2-sticker-screen--legal',
  })}</section>`;

  initV2StickerSwipe(root, {
    onRight: () => {
      state.error = '';
      if (state.identityDestination === 'booking' && state.from) renderConfirmation(root, state);
      else if (state.account) void renderAccountHome(root, state);
      else renderAccountDetails(root, state);
    },
    onLeft: () => { exitBookingContext(state); },
  });

  root.querySelector('[data-legal-platform-document]')?.addEventListener('click', () => {
    renderExpandedDocument(root, state, {
      title: state.accountTerms?.title || 'Условия использования',
      version: state.accountTerms?.version || 1,
      content: state.accountTerms?.content || '',
    }, () => renderLegalSticker(root, state));
  });
  root.querySelector('[data-legal-platform-toggle]')?.addEventListener('click', () => {
    state.accountTermsAccepted = !state.accountTermsAccepted;
    renderLegalSticker(root, state);
  });
  root.querySelectorAll('[data-booking-document]').forEach((node) => node.addEventListener('click', () => {
    const document = tenantDocuments.find((item) => String(item.id) === String(node.dataset.bookingDocument));
    if (!document) return;
    renderExpandedDocument(root, state, {
      title: document.title || legalTitle(document),
      version: document.version || 1,
      content: document.text || '',
    }, () => renderLegalSticker(root, state));
  }));
  root.querySelectorAll('[data-booking-consent]').forEach((node) => node.addEventListener('click', () => {
    const id = String(node.dataset.bookingConsent || '');
    state.consents[id] = !state.consents[id];
    renderLegalSticker(root, state);
  }));

  root.querySelector('[data-legal-continue]')?.addEventListener('click', async (event) => {
    if (!canContinue) return;
    event.currentTarget.disabled = true;
    try {
      if (!state.account) {
        const payload = await registerAccount(state.tenantId, {
          ...state.accountDraft,
          password: state.accountDraft.password,
          accountTerms: currentAccountTermsFact(state),
        });
        state.account = payload.account;
      } else if (platformDocument) {
        const accepted = await acceptAccountTerms(state.tenantId, currentAccountTermsFact(state));
        state.accountTerms = accepted?.document || state.accountTerms;
        state.accountTermsAccepted = Boolean(accepted?.accepted);
      }
      if (tenantDocuments.length) await saveTenantConsents(state);
      state.platformOnlyLegal = false;
      state.error = '';
      if (state.identityDestination === 'booking') await finalizeBookingRequest(root, state);
      else await renderAccountHome(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось сохранить документы');
      renderLegalSticker(root, state);
    }
  });
}

function renderAccountTerms(root, state) {
  renderLegalSticker(root, state);
}

function renderTenantAgreements(root, state) {
  renderLegalSticker(root, state);
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
  return `booking-account booking-account--account booking-account--v2 booking-shape--${shape} booking-choice-style--${choiceStyle}`;
}

function representativeName(state) {
  const profile = state.context?.profile || {};
  return [profile.name, profile.surname].filter(Boolean).join(' ').trim() || 'Запись';
}

function representativePhoto(state) {
  return String(state.context?.profile?.photo || '');
}

function subtitleBlock(value = '') {
  const valueText = String(value || '').trim();
  return valueText ? `<div class="v2-flow-subtitle">${escapeHtml(valueText).replaceAll('\n', '<br>')}</div>` : '';
}

function renderFlowPage(root, state, {
  title = '',
  subtitle = '',
  body = '',
  action = null,
  center = false,
  step = '',
} = {}) {
  if (step) state.bookingStep = step;
  const header = v2Header({
    a: { kind: 'avatar', label: representativeName(state), image: representativePhoto(state), disabled: true },
    b: representativeName(state),
    c: action ? { kind: 'text', label: action.label || '', data: action.data || '', aria: action.aria || action.label || '', disabled: Boolean(action.disabled) } : null,
    d: state.account ? { kind: 'chat', data: 'data-booking-flow-chat', aria: 'Чат' } : null,
  });
  const localTitle = title ? `<h2 class="v2-flow-title">${escapeHtml(title)}</h2>` : '';
  const shell = v2Shell({
    header,
    body: `${localTitle}${subtitleBlock(subtitle)}${body}`,
    className: center ? 'v2-app--flow-center' : 'v2-app--booking-flow',
  });
  root.innerHTML = `<section class="${flowThemeClasses(state)}" style="${bookingThemeStyle(state.settings)}">${shell}</section>`;
  root.querySelector('[data-booking-flow-chat]')?.addEventListener('click', () => {
    state.accountTab = 'messages';
    state.accountChatOpen = true;
    state.accountChatReturn = 'booking';
    state.accountDeckOpen = false;
    void renderAccountHome(root, state);
  });
}

function resumeBookingStep(root, state) {
  if (state.bookingStep === 'workplaces') return renderWorkplaces(root, state);
  if (state.bookingStep === 'procedures') return renderProcedures(root, state);
  if (state.bookingStep === 'dates') return renderDates(root, state);
  if (state.bookingStep === 'times') return renderTimes(root, state);
  if (state.bookingStep === 'confirmation') return renderConfirmation(root, state);
  if (state.bookingStep === 'registration') return renderAccountDetails(root, state);
  if (state.bookingStep === 'auth') return renderAccountEntry(root, state);
  return renderAccountHome(root, state);
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
  if (state.bookingOrigin === 'profile' && state.account) {
    void renderAccountHome(root, state);
    return;
  }
  state.identityDestination = 'booking';
  renderWelcome(root, state);
}

function exitBookingContext(state) {
  if (!state.account || typeof state.onExitToAccount !== 'function') return false;
  state.onExitToAccount();
  return true;
}

function renderWelcome(root, state) {
  const profile = state.context.profile || {};
  const owner = [profile.name, profile.surname].filter(Boolean).join(' ').trim();
  const continueFlow = () => {
    resetBookingChoice(state);
    state.identityDestination = 'booking';
    state.bookingOrigin = 'welcome';
    nextBookingStep(root, state);
  };
  root.innerHTML = `<section class="${flowThemeClasses(state)}" style="${bookingThemeStyle(state.settings)}">${v2Sticker({
    eyebrow: owner ? `Приглашение от ${owner}` : '',
    title: state.settings.welcomeTitle || '',
    body: state.settings.welcomeText ? `<p>${escapeHtml(state.settings.welcomeText).replaceAll('\n', '<br>')}</p>` : '',
    className: 'v2-sticker-screen--welcome',
  })}</section>`;
  initV2StickerSwipe(root, {
    onRight: continueFlow,
    onLeft: () => {
      if (!exitBookingContext(state)) continueFlow();
    },
  });
}

function renderAccountEntry(root, state) {
  state.bookingStep = 'auth';
  const rememberedIdentifier = state.accountDraft?.identifier
    || state.accountDraft?.email
    || getRememberedAccountEmail(state.tenantId)
    || '';
  const form = formView(`
    ${field({ label: 'Телефон или email', name: 'identifier', value: rememberedIdentifier, required: true, autocomplete: 'username' })}
    ${passwordField({ label: 'Пароль', name: 'password', required: true, autocomplete: 'current-password' })}
    ${formError(state.error)}
    ${button('Войти', { type: 'submit' })}
    <button type="button" class="v2-sticker-link" data-booking-register>Зарегистрироваться</button>
    <button type="button" class="v2-sticker-link" data-booking-forgot>Забыли пароль?</button>
  `, { data: 'data-booking-entry-form' });
  root.innerHTML = `<section class="${flowThemeClasses(state)}" style="${bookingThemeStyle(state.settings)}">${v2Sticker({
    title: 'Вход',
    body: form,
    className: 'v2-sticker-screen--auth',
  })}</section>`;

  initV2StickerSwipe(root, {
    onRight: () => {
      state.error = '';
      if (state.identityDestination === 'booking' && state.from) renderConfirmation(root, state);
      else nextBookingStep(root, state);
    },
    onLeft: () => { exitBookingContext(state); },
  });

  initPasswordFields(root);
  const authForm = root.querySelector('[data-booking-entry-form]');
  root.querySelector('[data-booking-register]')?.addEventListener('click', async () => {
    const data = new FormData(authForm);
    const identifier = String(data.get('identifier') || '').trim();
    state.accountDraft = {
      ...(state.accountDraft || {}),
      identifier,
      ...(identifier.includes('@') ? { email: identifier.toLowerCase() } : {}),
    };
    state.error = '';
    try {
      await loadAccountTerms(state);
      renderAccountDetails(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось открыть регистрацию');
      renderAccountEntry(root, state);
    }
  });
  root.querySelector('[data-booking-forgot]')?.addEventListener('click', () => {
    openNotice({
      title: 'Восстановление пароля',
      message: 'Восстановление пароля пока недоступно.',
      action: 'Закрыть',
      variant: 'technical',
    });
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
    const submit = authForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const prepared = await prepareAccount(state.tenantId, { identifier });
      if (!prepared.exists) {
        state.accountDraft = {
          ...(state.accountDraft || {}),
          identifier,
          ...(prepared.identifierType === 'EMAIL' ? { email: identifier.toLowerCase() } : {}),
          ...(prepared.identifierType === 'PHONE' ? { phone: identifier } : {}),
        };
        state.error = 'Аккаунт не найден. Выберите «Зарегистрироваться».';
        renderAccountEntry(root, state);
        return;
      }
      const payload = await loginAccount(state.tenantId, identifier, password);
      state.accountDraft = { ...(state.accountDraft || {}), identifier };
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
  state.bookingStep = 'registration';
  const draft = state.accountDraft || {};
  const contactErrors = state.contactErrors || {};
  renderFlowPage(root, state, {
    title: 'Регистрация',
    action: { label: 'Подтвердить', data: 'data-booking-account-submit' },
    step: 'registration',
    body: formView(`
      ${field({ label: 'Имя', name: 'name', value: draft.name || '', required: true, autocomplete: 'given-name' })}
      ${field({ label: 'Фамилия', name: 'surname', value: draft.surname || '', autocomplete: 'family-name' })}
      ${phoneField({ label: 'Телефон', name: 'phone', value: draft.phone || '', required: true })}
      ${formError(contactErrors.phone || '')}
      ${field({ label: 'Email', name: 'email', value: draft.email || '', type: 'email', required: true, autocomplete: 'email' })}
      ${formError(contactErrors.email || '')}
      ${passwordField({ label: 'Пароль', name: 'password', required: true, autocomplete: 'new-password' })}
      ${passwordField({ label: 'Повтор пароля', name: 'repeatPassword', required: true, autocomplete: 'new-password' })}
      ${formError(state.error)}
    `, { data: 'data-booking-account-form' }),
  });
  initV2Swipe(root, {
    onRight: () => {
      state.error = '';
      state.contactErrors = {};
      renderAccountEntry(root, state);
    },
  });
  initPasswordFields(root);
  const form = root.querySelector('[data-booking-account-form]');
  root.querySelector('[data-booking-account-submit]')?.addEventListener('click', () => form?.requestSubmit());
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validationError = formValidationMessage(form);
    if (validationError) {
      state.error = validationError;
      renderAccountDetails(root, state);
      return;
    }
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const phone = String(data.get('phone') || '').trim();
    const password = String(data.get('password') || '');
    const repeatPassword = String(data.get('repeatPassword') || '');
    if (password !== repeatPassword) {
      state.error = 'Пароли не совпадают.';
      renderAccountDetails(root, state);
      return;
    }
    state.accountDraft = {
      ...(state.accountDraft || {}),
      name: String(data.get('name') || '').trim(),
      surname: String(data.get('surname') || '').trim(),
      email,
      phone,
      password,
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
      state.error = '';
      if (!state.accountTerms) await loadAccountTerms(state);
      renderLegalSticker(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось проверить контакты');
      renderAccountDetails(root, state);
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
      state.platformOnlyLegal = state.identityDestination === 'profile';
      renderLegalSticker(root, state);
      return;
    }

    if (state.identityDestination === 'profile') {
      state.platformOnlyLegal = false;
      state.accountTab = 'home';
      await renderAccountHome(root, state);
      return;
    }

    state.platformOnlyLegal = false;
    const consentState = await refreshTenantConsentState(state);
    if (!consentState.pdnActive) {
      renderLegalSticker(root, state);
      return;
    }

    await finalizeBookingRequest(root, state);
  } catch (error) {
    state.error = accountFlowError(error, 'Не удалось проверить юридический статус');
    try {
      if (!state.accountTerms) await loadAccountTerms(state);
      await refreshTenantConsentState(state).catch(() => ({ pdnActive: false }));
      renderLegalSticker(root, state);
    } catch {
      renderFlowPage(root, state, {
        title: 'Проверка учетной записи',
        body: formError(state.error),
        step: state.bookingStep || 'times',
      });
      initV2Swipe(root, {
        onRight: () => {
          if (state.identityDestination === 'booking' && state.from) renderConfirmation(root, state);
          else nextBookingStep(root, state);
        },
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
    selected: String(state.workplaceKey || '') === String(workplace.key || ''),
    data: `data-booking-workplace="${escapeHtml(workplace.key)}"`,
    aria: `Выбрать рабочее пространство ${workplace.name || ''}`,
  })), { multiple: false });
  renderFlowPage(root, state, {
    title: 'Рабочее пространство',
    subtitle: 'Выберите, где хотите записаться',
    body: content || emptyState('Нет доступных пространств', 'Рабочие пространства для онлайн-записи не найдены.'),
    step: 'workplaces',
  });
  initV2Swipe(root, {
    onRight: () => backFromFirstBookingStep(root, state),
    onLeft: () => { exitBookingContext(state); },
  });
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
  const content = v2ServiceStickers(procedures.map((procedure) => {
    const cost = bookingProcedureCost(procedure, state.workplaceKey);
    return {
      id: String(procedure.id || ''),
      title: procedure.name || '',
      secondary: [procedure.duration ? `${Number(procedure.duration)} мин` : '', procedure.description || ''].filter(Boolean).join(' · '),
      right: cost !== '' ? money(cost) : '',
    };
  }), { selected: state.procedureIds, data: 'data-booking-procedure' });
  renderFlowPage(root, state, {
    title: 'Услуги',
    subtitle: 'Выберите всё, что хотите сделать',
    action: { label: 'Далее', data: 'data-booking-procedures-next', disabled: state.procedureIds.length === 0 },
    body: content || emptyState('Услуг нет', 'Для этого рабочего пространства услуги не настроены.'),
    step: 'procedures',
  });
  initV2Swipe(root, {
    onRight: () => {
      if (state.lockedWorkplaceKey) backFromFirstBookingStep(root, state);
      else renderWorkplaces(root, state);
    },
    onLeft: () => { exitBookingContext(state); },
  });
  root.querySelectorAll('[data-booking-procedure]').forEach((node) => node.addEventListener('click', () => {
    const id = String(node.dataset.bookingProcedure || '');
    const next = new Set(state.procedureIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    state.procedureIds = [...next];
    state.date = '';
    state.from = '';
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
  const first = state.date || dates[0] || '2000-01-01';
  const firstDate = new Date(`${first}T00:00:00`);
  renderFlowPage(root, state, {
    title: 'Дата',
    subtitle: 'Выберите удобный день',
    body: dates.length ? '<div data-booking-calendar></div>' : emptyState('Свободных дат нет', 'В графике пока нет доступных дат.'),
    step: 'dates',
  });
  initV2Swipe(root, {
    onRight: () => renderProcedures(root, state),
    onLeft: () => { exitBookingContext(state); },
  });
  const calendarRoot = root.querySelector('[data-booking-calendar]');
  if (!calendarRoot) return;
  initCalendar(calendarRoot, {
    month: new Date(firstDate.getFullYear(), firstDate.getMonth(), 1),
    selectedValue: state.date || '',
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
    body: `${slots.length
      ? bookingTimeGroups(slots, { data: 'data-booking-time' })
      : emptyState('Свободного времени нет', 'На эту дату нет интервала для выбранных услуг.')}${formError(state.error)}`,
    step: 'times',
  });
  initV2Swipe(root, {
    onRight: () => renderDates(root, state),
    onLeft: () => { exitBookingContext(state); },
  });
  root.querySelectorAll('[data-booking-time]').forEach((node) => {
    if (String(node.dataset.bookingTime || '') === String(state.from || '')) node.classList.add('is-selected');
    node.addEventListener('click', () => {
      const slot = slots.find((item) => item.from === node.dataset.bookingTime);
      if (!slot) return;
      state.from = slot.from;
      state.to = slot.to;
      state.error = '';
      state.identityDestination = 'booking';
      renderConfirmation(root, state);
    });
  });
}

function confirmationCard(state) {
  const workplace = getBookingWorkplace(state.context, state.workplaceKey) || {};
  const procedures = bookingSelection(state.context, state.workplaceKey, state.procedureIds);
  const subtotal = selectedSubtotal(state.context, state.workplaceKey, state.procedureIds);
  const discount = accountDiscount(state.account);
  const total = discountedTotal(subtotal, discount);
  return `<section class="v2-confirmation">
    <div class="v2-confirmation__profile">${escapeHtml(workplace.name || representativeName(state))}</div>
    <div class="v2-confirmation__services">${procedures.map((procedure) => `<div class="v2-confirmation__service"><span>${escapeHtml(procedure.name || '')}</span><strong>${escapeHtml(money(bookingProcedureCost(procedure, state.workplaceKey)))}</strong></div>`).join('')}</div>
    <div class="v2-confirmation__moment"><strong>${escapeHtml(formatDate(state.date))}</strong><span>${escapeHtml(state.from || '')}</span></div>
    <div class="v2-confirmation__divider"></div>
    <div class="v2-confirmation__totals">
      <div class="v2-confirmation__row"><span>Стоимость</span><strong>${escapeHtml(money(subtotal))}</strong></div>
      ${discount > 0 ? `<div class="v2-confirmation__row"><span>Скидка</span><strong>${escapeHtml(`${discount} %`)}</strong></div>` : ''}
      <div class="v2-confirmation__row is-total"><span>Итого</span><strong>${escapeHtml(money(total))}</strong></div>
    </div>
  </section>`;
}

function renderConfirmation(root, state) {
  renderFlowPage(root, state, {
    title: 'Подтверждение',
    action: { label: 'Подтвердить', data: 'data-booking-confirm' },
    body: `${confirmationCard(state)}${formError(state.error)}`,
    step: 'confirmation',
  });
  initV2Swipe(root, {
    onRight: () => {
      state.error = '';
      renderTimes(root, state);
    },
    onLeft: () => { exitBookingContext(state); },
  });
  root.querySelector('[data-booking-confirm]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    state.identityDestination = 'booking';
    state.error = '';
    if (!state.account) {
      renderAccountEntry(root, state);
      return;
    }
    await continueAfterIdentity(root, state);
  });
}

async function finalizeBookingRequest(root, state) {
  const slotStillAvailable = () => getBookingSlots(state.context, {
    workplaceKey: state.workplaceKey,
    date: state.date,
    procedureIds: state.procedureIds,
    step: state.settings.slotStep,
  }).some((slot) => String(slot.from || '') === String(state.from || ''));

  try {
    await refreshContext(state);
    if (!slotStillAvailable()) {
      state.error = 'Выбранное время уже недоступно. Выберите другое.';
      state.from = '';
      state.to = '';
      renderTimes(root, state);
      return;
    }

    state.lastRequest = await createBookingRequest(state.tenantId, {
      workplaceKey: state.workplaceKey,
      date: state.date,
      from: state.from,
      procedureIds: state.procedureIds,
    });
    state.notice = 'Запись отправлена в журнал.';
    state.error = '';
    await refreshContext(state);
    state.accountTab = 'representative';
    state.accountChatOpen = false;
    state.accountChatReturn = '';
    state.accountDeckOpen = false;
    await renderAccountHome(root, state);
  } catch (error) {
    await refreshContext(state).catch(() => {});
    if (state.from && !slotStillAvailable()) {
      state.error = 'Выбранное время уже занято или стало недоступно. Выберите другое.';
      state.from = '';
      state.to = '';
      renderTimes(root, state);
      return;
    }
    state.error = accountFlowError(error, 'Не удалось подтвердить запись');
    renderConfirmation(root, state);
  }
}

async function startBookingFromAccount(root, state) {
  resetBookingChoice(state);
  state.identityDestination = 'booking';
  state.bookingOrigin = 'profile';
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
  state.bookingOrigin = 'profile';
  continueRepeat(root, state);
}

async function renderAccountHome(root, state) {
  await renderAccount(root, state, {
    onStartBooking: () => void startBookingFromAccount(root, state),
    onRepeat: (request) => void repeatBooking(root, state, request),
    onChatBack: () => resumeBookingStep(root, state),
    onLogout: () => {
      clearAccount(state.tenantId);
      state.account = null;
      state.error = '';
      state.accountTab = 'home';
      state.accountChatOpen = false;
      state.accountChatReturn = '';
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


function globalAccountState() {
  return {
    tenantId: '',
    context: {},
    settings: normalizeBookingSettings(),
    accountDraft: {},
    contactErrors: {},
    account: null,
    accountTerms: null,
    accountTermsAccepted: false,
    relationships: [],
    accountRecords: [],
    error: '',
    accountTab: 'home',
    accountDeckOpen: false,
    accountDeckActive: 'representatives',
  };
}

function globalTermsFact(state) {
  const document = state.accountTerms || {};
  return {
    key: String(document.key || ''),
    version: Math.max(1, Number(document.version || 1)),
    accepted: Boolean(state.accountTermsAccepted),
    acceptedAt: new Date().toISOString(),
  };
}

async function renderGlobalClientHome(root, state) {
  const [account, relationships, records] = await Promise.all([
    getGlobalAccount(),
    getGlobalAccountRelationships().catch(() => []),
    getGlobalAccountRecords().catch(() => []),
  ]);
  if (!account) {
    renderGlobalClientEntry(root, state);
    return;
  }
  state.account = account;
  state.relationships = Array.isArray(relationships) ? relationships : [];
  state.accountRecords = Array.isArray(records) ? records : [];
  await renderGlobalAccount(root, state, {
    onOpenRelationship: (tenantId) => {
      const params = new URLSearchParams();
      params.set('booking', tenantId);
      params.set('entry', 'account');
      location.assign(`${location.pathname}?${params.toString()}`);
    },
    onOpenRecord: (request) => {
      const tenantId = String(request?.tenantId || '');
      if (!tenantId) return;
      const params = new URLSearchParams();
      params.set('booking', tenantId);
      params.set('entry', 'account');
      location.assign(`${location.pathname}?${params.toString()}`);
    },
    onLogout: () => {
      clearAccount('');
      state.account = null;
      state.relationships = [];
      state.accountRecords = [];
      state.error = '';
      renderGlobalClientEntry(root, state);
    },
  });
}

async function continueGlobalIdentity(root, state) {
  const platformState = await getGlobalAccountPlatformState();
  state.accountTerms = platformState?.document || state.accountTerms;
  state.accountTermsAccepted = Boolean(platformState?.accepted);
  if (!platformState?.accepted) {
    renderGlobalClientLegal(root, state);
    return;
  }
  await renderGlobalClientHome(root, state);
}

function renderGlobalClientEntry(root, state) {
  const rememberedIdentifier = state.accountDraft?.identifier
    || state.accountDraft?.email
    || getRememberedAccountEmail('')
    || '';
  const form = formView(`
    ${field({ label: 'Телефон или email', name: 'identifier', value: rememberedIdentifier, required: true, autocomplete: 'username' })}
    ${passwordField({ label: 'Пароль', name: 'password', required: true, autocomplete: 'current-password' })}
    ${formError(state.error)}
    ${button('Войти', { type: 'submit' })}
    <button type="button" class="v2-sticker-link" data-global-account-register>Зарегистрироваться</button>
  `, { data: 'data-global-account-entry' });
  root.innerHTML = `<section class="${flowThemeClasses(state)}">${v2Sticker({
    title: 'Вход',
    body: form,
    className: 'v2-sticker-screen--auth',
  })}</section>`;
  initPasswordFields(root);
  const authForm = root.querySelector('[data-global-account-entry]');
  root.querySelector('[data-global-account-register]')?.addEventListener('click', async () => {
    const data = new FormData(authForm);
    const identifier = String(data.get('identifier') || '').trim();
    state.accountDraft = {
      ...(state.accountDraft || {}),
      identifier,
      ...(identifier.includes('@') ? { email: identifier.toLowerCase() } : {}),
    };
    state.error = '';
    try {
      state.accountTerms = await getAccountTerms();
      state.accountTermsAccepted = false;
      renderGlobalClientDetails(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось открыть регистрацию');
      renderGlobalClientEntry(root, state);
    }
  });
  authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validationError = formValidationMessage(authForm);
    if (validationError) {
      state.error = validationError;
      renderGlobalClientEntry(root, state);
      return;
    }
    const data = new FormData(authForm);
    const identifier = String(data.get('identifier') || '').trim();
    const password = String(data.get('password') || '');
    try {
      const prepared = await prepareGlobalAccount({ identifier });
      if (!prepared.exists) {
        state.accountDraft = {
          ...(state.accountDraft || {}),
          identifier,
          ...(prepared.identifierType === 'EMAIL' ? { email: identifier.toLowerCase() } : {}),
          ...(prepared.identifierType === 'PHONE' ? { phone: identifier } : {}),
        };
        state.error = 'Аккаунт не найден. Выберите «Зарегистрироваться».';
        renderGlobalClientEntry(root, state);
        return;
      }
      const payload = await loginGlobalAccount(identifier, password);
      state.account = payload.account;
      state.error = '';
      await continueGlobalIdentity(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось войти');
      renderGlobalClientEntry(root, state);
    }
  });
}

function renderGlobalClientDetails(root, state) {
  const draft = state.accountDraft || {};
  const contactErrors = state.contactErrors || {};
  renderFlowPage(root, state, {
    title: 'Регистрация',
    action: { label: 'Подтвердить', data: 'data-global-account-submit' },
    step: 'registration',
    body: formView(`
      ${field({ label: 'Имя', name: 'name', value: draft.name || '', required: true, autocomplete: 'given-name' })}
      ${field({ label: 'Фамилия', name: 'surname', value: draft.surname || '', autocomplete: 'family-name' })}
      ${phoneField({ label: 'Телефон', name: 'phone', value: draft.phone || '', required: true })}
      ${formError(contactErrors.phone || '')}
      ${field({ label: 'Email', name: 'email', value: draft.email || '', type: 'email', required: true, autocomplete: 'email' })}
      ${formError(contactErrors.email || '')}
      ${passwordField({ label: 'Пароль', name: 'password', required: true, autocomplete: 'new-password' })}
      ${passwordField({ label: 'Повтор пароля', name: 'repeatPassword', required: true, autocomplete: 'new-password' })}
      ${formError(state.error)}
    `, { data: 'data-global-account-form' }),
  });
  initPasswordFields(root);
  const form = root.querySelector('[data-global-account-form]');
  root.querySelector('[data-global-account-submit]')?.addEventListener('click', () => form?.requestSubmit());
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validationError = formValidationMessage(form);
    if (validationError) {
      state.error = validationError;
      renderGlobalClientDetails(root, state);
      return;
    }
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const phone = String(data.get('phone') || '').trim();
    const password = String(data.get('password') || '');
    const repeatPassword = String(data.get('repeatPassword') || '');
    if (password !== repeatPassword) {
      state.error = 'Пароли не совпадают.';
      renderGlobalClientDetails(root, state);
      return;
    }
    state.accountDraft = {
      ...(state.accountDraft || {}),
      name: String(data.get('name') || '').trim(),
      surname: String(data.get('surname') || '').trim(),
      email,
      phone,
      password,
    };
    try {
      const prepared = await prepareGlobalAccount({ email, phone });
      const conflict = 'Этот контакт уже зарегистрирован. Войдите в учетную запись.';
      state.contactErrors = {
        email: prepared?.conflicts?.email ? conflict : '',
        phone: prepared?.conflicts?.phone ? conflict : '',
      };
      if (state.contactErrors.email || state.contactErrors.phone) {
        state.error = '';
        renderGlobalClientDetails(root, state);
        return;
      }
      if (!state.accountTerms) state.accountTerms = await getAccountTerms();
      state.accountTermsAccepted = false;
      renderGlobalClientLegal(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось проверить контакты');
      renderGlobalClientDetails(root, state);
    }
  });
}

function renderGlobalClientLegal(root, state) {
  const document = state.accountTerms;
  if (!document) {
    void getAccountTerms().then((terms) => {
      state.accountTerms = terms;
      renderGlobalClientLegal(root, state);
    });
    return;
  }
  const cards = v2LegalCards([{
    title: document.title || 'Условия использования учетной записи',
    required: true,
    checked: Boolean(state.accountTermsAccepted),
    openData: 'data-global-platform-document',
    toggleData: 'data-global-platform-toggle',
    openAria: 'Открыть Условия использования учетной записи',
    toggleAria: 'Принять Условия использования учетной записи',
  }]);
  root.innerHTML = `<section class="${flowThemeClasses(state)}">${v2Sticker({
    title: 'Документы',
    body: `${cards}${button('Продолжить', { data: 'data-global-platform-continue', disabled: !state.accountTermsAccepted })}${formError(state.error)}`,
    className: 'v2-sticker-screen--legal',
  })}</section>`;
  root.querySelector('[data-global-platform-document]')?.addEventListener('click', () => {
    renderExpandedDocument(root, state, document, () => renderGlobalClientLegal(root, state));
  });
  root.querySelector('[data-global-platform-toggle]')?.addEventListener('click', () => {
    state.accountTermsAccepted = !state.accountTermsAccepted;
    renderGlobalClientLegal(root, state);
  });
  root.querySelector('[data-global-platform-continue]')?.addEventListener('click', async () => {
    if (!state.accountTermsAccepted) return;
    try {
      if (!state.account) {
        const payload = await registerGlobalAccount({
          ...state.accountDraft,
          password: state.accountDraft.password,
          accountTerms: globalTermsFact(state),
        });
        state.account = payload.account;
      } else {
        await acceptGlobalAccountTerms(globalTermsFact(state));
      }
      state.error = '';
      await renderGlobalClientHome(root, state);
    } catch (error) {
      state.error = accountFlowError(error, 'Не удалось сохранить документ');
      renderGlobalClientLegal(root, state);
    }
  });
}

export async function renderGlobalClient(root) {
  const state = globalAccountState();
  renderFlowPage(root, state, { title: 'Профиль', subtitle: 'Загрузка…', center: true });
  try {
    const account = await getGlobalAccount();
    if (!account) {
      renderGlobalClientEntry(root, state);
      return;
    }
    state.account = account;
    await continueGlobalIdentity(root, state);
  } catch (error) {
    state.error = accountFlowError(error, 'Не удалось открыть профиль');
    renderGlobalClientEntry(root, state);
  }
}

export async function renderOnlineBooking(root, { tenantId = '', workplaceKey = '', entry = '', onExitToAccount = null } = {}) {
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
    error: '',
    notice: '',
    lastRequest: null,
    repeatSelection: null,
    identityDestination: 'booking',
    bookingOrigin: entry === 'account' ? 'profile' : 'welcome',
    accountTab: 'home',
    accountDeckOpen: false,
    accountChatOpen: false,
    accountChatReturn: '',
    bookingStep: '',
    accountRequests: [],
    onExitToAccount,
    entry: String(entry || ''),
    platformOnlyLegal: false,
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
    if (state.entry === 'account') {
      state.identityDestination = 'profile';
      if (!state.account) {
        renderAccountEntry(root, state);
        return;
      }
      await continueAfterIdentity(root, state);
      return;
    }
    renderWelcome(root, state);
  } catch (error) {
    renderFlowPage(root, state, {
      title: 'Онлайн-запись',
      body: emptyState('Запись недоступна', accountFlowError(error, 'Не удалось открыть онлайн-запись.')),
      center: true,
    });
  }
}

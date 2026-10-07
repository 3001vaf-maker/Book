import {
  actionBlock,
  button,
  entityCardStack,
  entityVisualCard,
  escapeHtml,
  field,
  modal,
  mountModal,
  mountV2ZLayer,
  openEntityCardAppearanceQ,
  openNotice,
  openSharedProfileSettingsMenu,
  page,
  select,
  shortDateTime,
  textareaField,
  v2ListEntries,
  v2ListEntry,
  v2Section,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../ui/ui.js';
import { getPeople } from '../people/data.js';
import { getProfile } from '../profile/data.js';
import { getCardAppearanceTemplate, saveCardAppearanceTemplate } from '../card-appearance-templates.js';
import {
  createLoyaltyInstance,
  createLoyaltyProgram,
  createPersonalAccount,
  getBonusPolicy,
  getLoyaltyInstances,
  getLoyaltyProgram,
  getLoyaltyPrograms,
  getPersonalAccount,
  getPersonalAccountOperations,
  getPersonalAccounts,
  getProgramAssignments,
  recordPersonalAccountOperation,
  setBonusPolicy,
  setLoyaltyProgramStatus,
} from './data.js';
import {
  loyaltyCardAppearance,
  loyaltyCardFields,
  loyaltyCardPhoto,
  loyaltyCardPhotoPosition,
  loyaltyCardScope,
  loyaltyKindLabel,
} from './card-presentation.js';

const NAVIGATION = Object.freeze([
  { id: 'deposit', label: 'Депозит' },
  { id: 'personal-account', label: 'Личный счёт' },
  { id: 'certificate', label: 'Сертификат' },
  { id: 'subscription', label: 'Абонемент' },
  { id: 'referral', label: 'Реферальная программа' },
  { id: 'bonus', label: 'Бонусная программа' },
]);

const PROGRAM_SECTIONS = new Set(['deposit', 'certificate', 'subscription', 'referral', 'bonus']);
const PAID_INSTANCE_SECTIONS = new Set(['deposit', 'certificate', 'subscription']);
const STATUS_LABELS = Object.freeze({
  draft: 'Черновик',
  active: 'Активна',
  paused: 'Приостановлена',
  completed: 'Завершена',
  'pending-payment': 'Ожидает оплаты',
});

function crop(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 50;
}

function profileHeaderContext({ title = 'Лояльность', settings = true, c = null } = {}) {
  const profile = getProfile();
  const name = [profile.name, profile.surname].filter(Boolean).join(' ') || 'Профиль';
  return workspaceHeaderContext({
    title,
    a: {
      kind: 'avatar',
      image: String(profile.photo || ''),
      imagePosition: `${crop(profile.photoCropX)}% ${crop(profile.photoCropY)}%`,
      initials: name.slice(0, 1).toUpperCase() || '?',
      settingsTag: settings,
      data: settings ? 'data-loyalty-settings' : '',
      aria: 'Настройки Лояльности',
      disabled: !settings,
    },
    c,
  });
}

function notifyContext() {
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function statusLabel(value) {
  return STATUS_LABELS[String(value || '')] || String(value || '');
}

function personName(personKey) {
  const person = getPeople().find((item) => String(item.key || item.id || '') === String(personKey || ''));
  return [person?.name, person?.surname].filter(Boolean).join(' ') || 'Без имени';
}

function personOptions() {
  return getPeople().map((person) => ({
    value: String(person.key || person.id || ''),
    label: [person.name, person.surname].filter(Boolean).join(' ') || 'Без имени',
  })).filter((item) => item.value);
}

function money(value) {
  return `${new Intl.NumberFormat('ru-RU').format(Number(value || 0))} ₽`;
}

function programSubtitle(kind, program) {
  if (kind === 'referral' || kind === 'bonus') {
    return program.audienceMode === 'all' ? 'Всем контактам' : 'Выбранным контактам';
  }
  return loyaltyKindLabel(kind);
}

function programMetaRight(kind, program) {
  if (kind === 'deposit') return program.amount ? money(program.amount) : String(program.termRule || '');
  if (kind === 'certificate') return program.amount ? money(program.amount) : String(program.certificateType || '');
  if (kind === 'subscription') return program.price ? money(program.price) : String(program.validity || '');
  if (kind === 'referral') return String(program.rewardRule || '');
  if (kind === 'bonus') return String(program.rewardRule || '');
  return '';
}

function visualCard(kind, item, { data = '', aria = '', person = '' } = {}) {
  const account = kind === 'personal-account';
  const fields = account
    ? loyaltyCardFields({
        kind,
        title: person || personName(item.personKey),
        subtitle: 'Личный счёт',
        status: `${money(item.moneyBalance)} / ${new Intl.NumberFormat('ru-RU').format(Number(item.bonusBalance || 0))} бонусов`,
        metaLeft: 'Деньги',
        metaRight: 'Бонусы',
      })
    : loyaltyCardFields({
        kind,
        title: item.name,
        subtitle: programSubtitle(kind, item),
        status: statusLabel(item.status),
        metaLeft: item.description || loyaltyKindLabel(kind),
        metaRight: programMetaRight(kind, item),
      });
  return entityVisualCard({
    appearance: loyaltyCardAppearance(kind),
    fields,
    image: loyaltyCardPhoto(kind),
    imagePosition: loyaltyCardPhotoPosition(kind),
    interactive: true,
    data,
    aria,
  });
}

function emptyText(section) {
  if (section === 'personal-account') return 'Личных счетов пока нет.';
  return `${loyaltyKindLabel(section)}: пока ничего не создано.`;
}

function z1Content(section) {
  if (section === 'personal-account') {
    const accounts = getPersonalAccounts();
    if (!accounts.length) return v2Section('Личный счёт', `<p>${escapeHtml(emptyText(section))}</p>`);
    return entityCardStack(accounts.map((account) => visualCard(section, account, {
      data: `data-loyalty-account="${escapeHtml(account.id)}"`,
      aria: `Открыть личный счёт ${personName(account.personKey)}`,
    })));
  }
  const programs = getLoyaltyPrograms(section);
  if (!programs.length) return v2Section(loyaltyKindLabel(section), `<p>${escapeHtml(emptyText(section))}</p>`);
  return entityCardStack(programs.map((program) => visualCard(section, program, {
    data: `data-loyalty-program="${escapeHtml(program.id)}"`,
    aria: `Открыть ${program.name}`,
  })));
}

function creationFields(section) {
  if (section === 'personal-account') {
    return select({
      label: 'Контакт',
      name: 'personKey',
      value: '',
      options: [{ value: '', label: 'Выберите контакт' }, ...personOptions()],
      required: true,
    });
  }
  const common = `${field({ label: 'Название', name: 'name', required: true })}${textareaField({ label: 'Описание / условия', name: 'description' })}`;
  if (section === 'deposit') {
    return `${common}${field({ label: 'Сумма программы', name: 'amount', type: 'number', min: '0' })}${field({ label: 'Срок / правило срока', name: 'termRule' })}${field({ label: 'Выгода', name: 'benefit' })}`;
  }
  if (section === 'certificate') {
    return `${common}${select({ label: 'Тип', name: 'certificateType', value: 'amount', options: [{ value: 'amount', label: 'На сумму' }, { value: 'service', label: 'На позицию Сервиса' }, { value: 'bundle', label: 'На набор позиций' }] })}${field({ label: 'Номинал / цена', name: 'amount', type: 'number', min: '0' })}${field({ label: 'Срок действия', name: 'validity' })}`;
  }
  if (section === 'subscription') {
    return `${common}${field({ label: 'Цена', name: 'price', type: 'number', min: '0' })}${textareaField({ label: 'Состав из Сервиса', name: 'composition' })}${field({ label: 'Срок действия', name: 'validity' })}${select({ label: 'Начало срока', name: 'startRule', value: 'purchase', options: [{ value: 'purchase', label: 'С оформления / покупки' }, { value: 'first-use', label: 'С первого использования' }, { value: 'date', label: 'С конкретной даты' }] })}`;
  }
  if (section === 'referral') {
    return `${common}${select({ label: 'Кому действует', name: 'audienceMode', value: 'selected', options: [{ value: 'all', label: 'Всем контактам' }, { value: 'selected', label: 'Выбранным контактам' }] })}${textareaField({ label: 'Результативное событие', name: 'condition' })}${field({ label: 'Количество уровней', name: 'levels', type: 'number', min: '1', value: '1' })}${textareaField({ label: 'Вознаграждение', name: 'rewardRule' })}${select({ label: 'Момент начисления', name: 'rewardMoment', value: 'paid', options: [{ value: 'completed', label: 'После завершения' }, { value: 'paid', label: 'После полной оплаты' }, { value: 'completed-paid', label: 'После завершения и полной оплаты' }] })}`;
  }
  return `${common}${select({ label: 'Кому действует', name: 'audienceMode', value: 'selected', options: [{ value: 'all', label: 'Всем контактам' }, { value: 'selected', label: 'Выбранным контактам' }] })}${textareaField({ label: 'Условие начисления', name: 'condition' })}${textareaField({ label: 'Размер начисления', name: 'rewardRule' })}${field({ label: 'Повторяемость', name: 'repeatRule' })}${select({ label: 'Момент начисления', name: 'rewardMoment', value: 'paid', options: [{ value: 'completed', label: 'Завершение' }, { value: 'paid', label: 'Оплата' }, { value: 'completed-paid', label: 'Завершение и оплата' }] })}`;
}

function formObject(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
}

function openCreateQ(root, section, rerender) {
  const title = section === 'personal-account' ? 'Открыть личный счёт' : `Создать: ${loyaltyKindLabel(section)}`;
  const layer = mountModal(root, modal(`${profileHeaderContext({ title, settings: false, c: { label: 'Сохранить', data: 'data-loyalty-create-save', aria: title } })}<form class="form-grid" data-loyalty-create-form>${creationFields(section)}<div class="form-error" data-loyalty-create-error></div></form>`, { variant: 'q', title }));
  const form = layer?.querySelector('[data-loyalty-create-form]');
  const save = layer?.querySelector('[data-loyalty-create-save]');
  const submit = () => {
    if (!form) return;
    const values = formObject(form);
    try {
      if (section === 'personal-account') createPersonalAccount(values.personKey);
      else createLoyaltyProgram(section, values);
      layer.v2Close?.();
      rerender();
    } catch (error) {
      const target = layer.querySelector('[data-loyalty-create-error]');
      if (target) target.textContent = error instanceof Error ? error.message : 'Не удалось сохранить';
    }
  };
  save?.addEventListener('click', submit);
  form?.addEventListener('submit', (event) => { event.preventDefault(); submit(); });
  notifyContext();
  return layer;
}

function appearanceTypes() {
  return NAVIGATION.map((item) => ({ value: item.id, label: item.label }));
}

function sampleForKind(kind) {
  if (kind === 'personal-account') {
    const account = getPersonalAccounts()[0] || { id: 'sample', personKey: '', moneyBalance: 5000, bonusBalance: 20000 };
    return {
      appearance: loyaltyCardAppearance(kind),
      fields: loyaltyCardFields({ kind, title: personName(account.personKey) || 'Иван Петров', subtitle: 'Личный счёт', status: `${money(account.moneyBalance)} / ${Number(account.bonusBalance || 0)} бонусов`, metaLeft: 'Деньги', metaRight: 'Бонусы' }),
      photo: loyaltyCardPhoto(kind),
      photoPosition: loyaltyCardPhotoPosition(kind),
    };
  }
  const program = getLoyaltyPrograms(kind)[0] || { name: loyaltyKindLabel(kind), status: 'draft', description: 'Описание', audienceMode: 'selected' };
  return {
    appearance: loyaltyCardAppearance(kind),
    fields: loyaltyCardFields({ kind, title: program.name, subtitle: programSubtitle(kind, program), status: statusLabel(program.status), metaLeft: program.description || loyaltyKindLabel(kind), metaRight: programMetaRight(kind, program) }),
    photo: loyaltyCardPhoto(kind),
    photoPosition: loyaltyCardPhotoPosition(kind),
  };
}

function openAppearance(root, section, rerender) {
  return openEntityCardAppearanceQ(root, {
    title: 'Вид',
    typeLabel: 'Тип карты',
    typeOptions: appearanceTypes(),
    initialType: section,
    targetOptions: () => [],
    resolve: (type) => sampleForKind(type),
    save: async ({ type, appearance, photo, editor }) => {
      saveCardAppearanceTemplate(loyaltyCardScope(type), { appearance, photo, photoPosition: editor?.photoPosition || '50% 50%' });
    },
    onSaved: rerender,
  });
}

function openBonusPolicy(root, rerender) {
  const current = getBonusPolicy();
  const layer = mountModal(root, modal(`${profileHeaderContext({ title: 'Срок жизни бонусов', settings: false, c: { label: 'Сохранить', data: 'data-bonus-policy-save', aria: 'Сохранить срок жизни бонусов' } })}<form class="form-grid" data-bonus-policy-form>${select({ label: 'Политика новых начислений', name: 'mode', value: current.mode, options: [{ value: 'permanent', label: 'Бессрочно' }, { value: 'duration', label: 'Ограниченный срок' }] })}${field({ label: 'Количество', name: 'durationValue', type: 'number', min: '1', value: current.durationValue || '' })}${select({ label: 'Единица', name: 'durationUnit', value: current.durationUnit, options: [{ value: 'days', label: 'Дни' }, { value: 'months', label: 'Месяцы' }] })}<div class="form-error" data-bonus-policy-error></div></form>`, { variant: 'q', title: 'Срок жизни бонусов' }));
  const form = layer?.querySelector('[data-bonus-policy-form]');
  layer?.querySelector('[data-bonus-policy-save]')?.addEventListener('click', () => {
    try {
      setBonusPolicy(formObject(form));
      layer.v2Close?.();
      rerender();
    } catch (error) {
      const target = layer.querySelector('[data-bonus-policy-error]');
      if (target) target.textContent = error instanceof Error ? error.message : 'Не удалось сохранить';
    }
  });
  notifyContext();
  return layer;
}

function openRootSettings(root, section, rerender) {
  const actions = [{ id: 'appearance', label: 'Вид', onSelect: () => openAppearance(root, section, rerender) }];
  if (section === 'personal-account') actions.push({ id: 'bonus-policy', label: 'Срок жизни бонусов', onSelect: () => openBonusPolicy(root, rerender) });
  return openSharedProfileSettingsMenu({ title: 'Лояльность', actions });
}

function infoRows(program) {
  const rows = [
    ['Статус', statusLabel(program.status)],
    ['Создана', shortDateTime(program.createdAt, '—')],
  ];
  if (program.description) rows.push(['Условия', program.description]);
  if (program.termRule) rows.push(['Срок', program.termRule]);
  if (program.validity) rows.push(['Срок действия', program.validity]);
  if (program.benefit) rows.push(['Выгода', program.benefit]);
  if (program.condition) rows.push(['Условие', program.condition]);
  if (program.rewardRule) rows.push(['Начисление', program.rewardRule]);
  if (program.composition) rows.push(['Состав', program.composition]);
  return v2ListEntries(rows.map(([title, value]) => v2ListEntry({ title, subtitle: String(value || '—'), interactive: false })));
}

function statusActions(kind, program, closeAndRefresh) {
  const actions = [{ id: 'appearance', label: 'Вид карты', onSelect: () => closeAndRefresh('appearance') }];
  if (program.status === 'draft') actions.push({ id: 'activate', label: 'Запустить', onSelect: () => { setLoyaltyProgramStatus(kind, program.id, 'active'); closeAndRefresh(); } });
  if (program.status === 'active') actions.push({ id: 'pause', label: 'Приостановить', onSelect: () => { setLoyaltyProgramStatus(kind, program.id, 'paused'); closeAndRefresh(); } });
  if (program.status === 'paused') actions.push({ id: 'resume', label: 'Возобновить', onSelect: () => { setLoyaltyProgramStatus(kind, program.id, 'active'); closeAndRefresh(); } });
  if (program.status !== 'completed') actions.push({ id: 'complete', label: 'Завершить', variant: 'danger', onSelect: () => { setLoyaltyProgramStatus(kind, program.id, 'completed'); closeAndRefresh(); } });
  return actions;
}

function instanceList(kind, programId) {
  const instances = getLoyaltyInstances(kind, programId);
  if (!instances.length) return v2Section('Оформленные', '<p>Пока нет оформленных экземпляров.</p>');
  return v2Section('Оформленные', v2ListEntries(instances.map((item) => v2ListEntry({
    title: personName(item.personKey),
    subtitle: statusLabel(item.status),
    rightTop: item.amount ? money(item.remaining) : '',
    rightBottom: shortDateTime(item.createdAt, ''),
    data: `data-loyalty-instance="${escapeHtml(item.id)}"`,
    aria: `Открыть экземпляр ${personName(item.personKey)}`,
  }))));
}

function assignmentList(kind, programId) {
  const values = getProgramAssignments(kind, programId);
  if (!values.length) return v2Section('Назначения', '<p>Персональные назначения и исключения выполняются из Контактов.</p>');
  return v2Section('Назначения', v2ListEntries(values.map((item) => v2ListEntry({
    title: personName(item.personKey),
    subtitle: item.state === 'excluded' ? 'Отключено персонально' : 'Назначено',
    interactive: false,
  }))));
}

function openInstanceQ(root, kind, program, rerender) {
  const label = kind === 'subscription' ? 'Оформить абонемент' : kind === 'certificate' ? 'Оформить сертификат' : 'Оформить депозит';
  const layer = mountModal(root, modal(`${profileHeaderContext({ title: label, settings: false, c: { label: 'Оформить', data: 'data-loyalty-instance-save', aria: label } })}<form class="form-grid" data-loyalty-instance-form>${select({ label: 'Контакт', name: 'personKey', value: '', options: [{ value: '', label: 'Выберите контакт' }, ...personOptions()] })}${kind === 'certificate' ? select({ label: 'Покупатель', name: 'buyerPersonKey', value: '', options: [{ value: '', label: 'Совпадает с владельцем / не указан' }, ...personOptions()] }) : ''}${field({ label: 'Сумма', name: 'amount', type: 'number', min: '0', value: program.amount || program.price || '' })}<div class="form-error" data-loyalty-instance-error></div></form>`, { variant: 'q', title: label }));
  const form = layer?.querySelector('[data-loyalty-instance-form]');
  layer?.querySelector('[data-loyalty-instance-save]')?.addEventListener('click', () => {
    try {
      createLoyaltyInstance(kind, { ...formObject(form), programId: program.id });
      layer.v2Close?.();
      openNotice({ title: 'Оформлено', message: 'Экземпляр создан. Если требуется денежная оплата, он остаётся в состоянии ожидания оплаты до связанного движения Финансов.' });
      rerender();
    } catch (error) {
      const target = layer.querySelector('[data-loyalty-instance-error]');
      if (target) target.textContent = error instanceof Error ? error.message : 'Не удалось оформить';
    }
  });
  notifyContext();
  return layer;
}

function openInstanceLayer(root, kind, instanceId) {
  const instance = getLoyaltyInstances(kind).find((item) => item.id === instanceId);
  if (!instance) return null;
  const program = getLoyaltyProgram(kind, instance.programId);
  return mountV2ZLayer(root, v2ZLayer(page([
    profileHeaderContext({ title: program?.name || loyaltyKindLabel(kind), settings: false }),
    visualCard(kind, program || { name: loyaltyKindLabel(kind), status: instance.status, description: '' }, { data: '', aria: '' }).replace('type="button"', 'type="button" disabled'),
    v2Section('Экземпляр', v2ListEntries([
      v2ListEntry({ title: 'Владелец', subtitle: personName(instance.personKey), interactive: false }),
      ...(instance.buyerPersonKey ? [v2ListEntry({ title: 'Покупатель', subtitle: personName(instance.buyerPersonKey), interactive: false })] : []),
      v2ListEntry({ title: 'Состояние', subtitle: statusLabel(instance.status), interactive: false }),
      v2ListEntry({ title: 'Остаток', subtitle: money(instance.remaining), interactive: false }),
      v2ListEntry({ title: 'Оформлено', subtitle: shortDateTime(instance.createdAt, '—'), interactive: false }),
    ])),
  ]), { className: 'loyalty-instance-z' }));
}

function openProgramLayer(root, section, programId, rerenderRoot) {
  const program = getLoyaltyProgram(section, programId);
  if (!program) return null;
  let layer = null;
  const reopenRoot = () => {
    layer?.v2Close?.();
    rerenderRoot();
  };
  const c = PAID_INSTANCE_SECTIONS.has(section) && program.status !== 'completed'
    ? { label: 'Оформить', data: 'data-loyalty-program-issue', aria: 'Оформить' }
    : null;
  layer = mountV2ZLayer(root, v2ZLayer(page([
    profileHeaderContext({ title: program.name, settings: true, c }),
    visualCard(section, program, { data: '', aria: '' }).replace('type="button"', 'type="button" disabled'),
    v2Section('Условия', infoRows(program)),
    PAID_INSTANCE_SECTIONS.has(section) ? instanceList(section, program.id) : assignmentList(section, program.id),
  ]), { className: 'loyalty-program-z' }));
  if (!layer) return null;
  layer.querySelector('[data-loyalty-settings]')?.addEventListener('click', () => {
    openSharedProfileSettingsMenu({
      title: program.name,
      actions: statusActions(section, program, (action = '') => {
        if (action === 'appearance') openAppearance(root, section, reopenRoot);
        else reopenRoot();
      }),
    });
  });
  layer.querySelector('[data-loyalty-program-issue]')?.addEventListener('click', () => openInstanceQ(root, section, program, reopenRoot));
  layer.querySelectorAll('[data-loyalty-instance]').forEach((node) => node.addEventListener('click', () => openInstanceLayer(root, section, node.dataset.loyaltyInstance)));
  notifyContext();
  return layer;
}

function openBonusOperationQ(root, account, rerenderRoot) {
  const layer = mountModal(root, modal(`${profileHeaderContext({ title: 'Операция по бонусам', settings: false, c: { label: 'Сохранить', data: 'data-loyalty-operation-save', aria: 'Сохранить операцию' } })}<form class="form-grid" data-loyalty-operation-form>${select({ label: 'Действие', name: 'direction', value: 'credit', options: [{ value: 'credit', label: 'Начислить' }, { value: 'debit', label: 'Списать' }] })}${field({ label: 'Бонусы', name: 'amount', type: 'number', min: '1', required: true })}${textareaField({ label: 'Комментарий', name: 'comment' })}<div class="form-error" data-loyalty-operation-error></div></form>`, { variant: 'q', title: 'Операция по бонусам' }));
  const form = layer?.querySelector('[data-loyalty-operation-form]');
  layer?.querySelector('[data-loyalty-operation-save]')?.addEventListener('click', () => {
    try {
      const values = formObject(form);
      recordPersonalAccountOperation({ accountId: account.id, nominal: 'bonus', direction: values.direction, amount: values.amount, comment: values.comment, sourceType: 'manual' });
      layer.v2Close?.();
      rerenderRoot();
    } catch (error) {
      const target = layer.querySelector('[data-loyalty-operation-error]');
      if (target) target.textContent = error instanceof Error ? error.message : 'Не удалось выполнить операцию';
    }
  });
  notifyContext();
  return layer;
}

function openAccountLayer(root, accountId, rerenderRoot) {
  const account = getPersonalAccount(accountId);
  if (!account) return null;
  const operations = getPersonalAccountOperations(account.id).sort((a, b) => Date.parse(b.auditAt || 0) - Date.parse(a.auditAt || 0));
  let layer = null;
  const closeRefresh = () => { layer?.v2Close?.(); rerenderRoot(); };
  layer = mountV2ZLayer(root, v2ZLayer(page([
    profileHeaderContext({ title: personName(account.personKey), settings: true, c: { label: 'Операция', data: 'data-loyalty-account-operation', aria: 'Операция по личному счёту' } }),
    visualCard('personal-account', account, { data: '', aria: '' }).replace('type="button"', 'type="button" disabled'),
    v2Section('Движения', operations.length ? v2ListEntries(operations.map((item) => v2ListEntry({
      title: item.nominal === 'bonus' ? 'Бонусы' : 'Деньги',
      subtitle: `${item.direction === 'credit' ? '+' : '−'}${new Intl.NumberFormat('ru-RU').format(Number(item.amount || 0))}${item.nominal === 'bonus' ? ' бонусов' : ' ₽'}`,
      rightTop: item.sourceType || '',
      rightBottom: shortDateTime(item.workingAt, ''),
      interactive: false,
    }))) : '<p>Операций пока нет.</p>'),
  ]), { className: 'loyalty-account-z' }));
  if (!layer) return null;
  layer.querySelector('[data-loyalty-account-operation]')?.addEventListener('click', () => openBonusOperationQ(root, account, closeRefresh));
  layer.querySelector('[data-loyalty-settings]')?.addEventListener('click', () => openSharedProfileSettingsMenu({
    title: 'Личный счёт',
    actions: [
      { id: 'appearance', label: 'Вид карты', onSelect: () => openAppearance(root, 'personal-account', closeRefresh) },
      { id: 'bonus-policy', label: 'Срок жизни бонусов', onSelect: () => openBonusPolicy(root, closeRefresh) },
    ],
  }));
  notifyContext();
  return layer;
}

export function loyaltyNavigationItems() {
  return NAVIGATION.map((item) => ({ ...item }));
}

export function renderLoyaltySection(root, section = 'deposit') {
  let active = NAVIGATION.some((item) => item.id === section) ? section : 'deposit';
  const renderCurrent = () => {
    root.innerHTML = page([
      profileHeaderContext({
        title: loyaltyKindLabel(active),
        settings: true,
        c: { label: '+', data: 'data-loyalty-add', aria: active === 'personal-account' ? 'Открыть личный счёт' : `Создать ${loyaltyKindLabel(active)}` },
      }),
      z1Content(active),
    ]);
    root.querySelector('[data-loyalty-settings]')?.addEventListener('click', () => openRootSettings(root, active, renderCurrent));
    root.querySelector('[data-loyalty-add]')?.addEventListener('click', () => openCreateQ(root, active, renderCurrent));
    root.querySelectorAll('[data-loyalty-program]').forEach((node) => node.addEventListener('click', () => openProgramLayer(root, active, node.dataset.loyaltyProgram, renderCurrent)));
    root.querySelectorAll('[data-loyalty-account]').forEach((node) => node.addEventListener('click', () => openAccountLayer(root, node.dataset.loyaltyAccount, renderCurrent)));
    notifyContext();
  };
  renderCurrent();
  return () => {};
}

export { renderLoyaltySection as render };

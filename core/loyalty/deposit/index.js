import {
  button,
  datePicker,
  details,
  emptyState,
  entityCardStack,
  entityVisualCard,
  escapeHtml,
  field,
  formValidationMessage,
  initDatePickers,
  miniCard,
  miniCardRail,
  modal,
  mountModal,
  mountV2ZLayer,
  openDocumentViewer,
  openEntityCardAppearanceQ,
  openNotice,
  openSharedProfileSettingsMenu,
  page,
  select,
  setV2ZHeaderRows,
  shortDateTime,
  smallActionButton,
  textareaField,
  v2ListEntries,
  v2ListEntry,
  v2Section,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../../ui/ui.js';
import { getWallets } from '../../finance/index.js';
import { getProfile } from '../../profile/data.js';
import { getAllPeople } from '../../people/data.js';
import { personDisplay } from '../../people/presentation.js';
import { getCardAppearanceTemplate, saveCardAppearanceTemplate } from '../../card-appearance-templates.js';
import { createUEI, detachUEI, getUEI, listUEIs, normalizeUEI } from '../../uei.js';
import {
  fundDeposit,
  getDepositPrograms,
  listAllDeposits,
  loadDepositPrograms,
  saveDepositPrograms,
  withdrawDeposit,
} from './data.js';
import {
  depositCardAppearance,
  depositCardFields,
  depositCardPhoto,
  depositCardPhotoPosition,
  depositCardScope,
} from './card-presentation.js';

const PROGRAM_UEI_TYPE = 'loyalty-deposit-program';
const DEPOSIT_UEI_TYPE = 'loyalty-deposit';

const money = (value) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value || 0)).replaceAll('\u00a0', ' ')} ₽`;
const uid = () => globalThis.crypto?.randomUUID?.() || `deposit-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function notifyContext() {
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function crop(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 50;
}

function depositHeaderContext({ title = 'Депозит', settingsData = '', settingsAria = 'Настройки депозита', c = null } = {}) {
  const profile = getProfile();
  const profileName = [profile?.name, profile?.surname].filter(Boolean).join(' ').trim() || 'Профиль';
  return workspaceHeaderContext({
    title,
    a: {
      kind: 'avatar',
      image: String(profile?.photo || ''),
      imagePosition: `${crop(profile?.photoCropX)}% ${crop(profile?.photoCropY)}%`,
      initials: profileName.slice(0, 1).toUpperCase() || '?',
      settingsTag: Boolean(settingsData),
      data: settingsData,
      aria: settingsAria,
      disabled: !settingsData,
    },
    c,
  });
}

function formObject(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
}

function programStatusLabel(status = '') {
  if (status === 'paused') return 'Приостановлена';
  if (status === 'closed') return 'Закрыта';
  return 'Активна';
}

function depositStatusLabel(status = '') {
  return status === 'closed' ? 'Закрыт' : 'Активен';
}

function contactLabel(person = {}) {
  const display = personDisplay(person);
  return display.name || 'Без имени';
}

function contactOption(person = {}) {
  const display = personDisplay(person);
  return {
    value: String(person?.key || person?.id || ''),
    label: [display.uei, display.name].filter(Boolean).join(' · ') || 'Без имени',
  };
}

function programUei(program = {}) {
  return getUEI(PROGRAM_UEI_TYPE, program.id) || '';
}

function depositUei(deposit = {}) {
  return getUEI(DEPOSIT_UEI_TYPE, deposit.depositId || deposit.id) || '';
}

function normalizeRequiredUei(value) {
  const normalized = normalizeUEI(value);
  if (!normalized || normalized === '0000') throw new Error('Сформируйте UEI');
  return normalized;
}

function ensureUeiAvailable(value) {
  const normalized = normalizeRequiredUei(value);
  if (listUEIs().some((item) => String(item?.uei || '') === normalized)) throw new Error('Этот UEI уже используется');
  return normalized;
}

function bindUeiInput(root, name = 'uei') {
  const input = root?.querySelector?.(`[name="${CSS.escape(name)}"]`);
  input?.addEventListener('input', () => {
    input.value = Array.from(String(input.value || ''))
      .filter((char) => /[A-Za-zА-Яа-яЁё0-9]/.test(char))
      .slice(0, 4)
      .join('')
      .toUpperCase();
  });
}

function ueiField({ name = 'uei', value = '', readonly = false } = {}) {
  return field({
    label: 'UEI',
    name,
    value,
    maxlength: 4,
    autocomplete: 'off',
    required: !readonly,
    readonly,
    data: 'data-deposit-uei-field',
  });
}

function programFields(program = {}) {
  const amount = Number(program?.amount || 0);
  return depositCardFields({
    uei: programUei(program),
    title: program?.name || 'Депозит',
    subtitle: program?.termRule || 'Бессрочно',
    status: programStatusLabel(program?.status),
    metaLeft: program?.benefit || 'Без дополнительной выгоды',
    metaRight: amount > 0 ? money(amount) : 'Свободная сумма',
  });
}

function card(fields, { data = '', aria = '', interactive = true } = {}) {
  return entityVisualCard({
    appearance: depositCardAppearance(),
    fields,
    image: depositCardPhoto(),
    imagePosition: depositCardPhotoPosition(),
    interactive,
    data,
    aria,
  });
}

function programConditions(program = {}, issuedCount = null) {
  const lines = [
    `UEI: ${programUei(program) || '—'}`,
    `Состояние: ${programStatusLabel(program?.status)}`,
    `Сумма: ${Number(program?.amount || 0) > 0 ? money(program.amount) : 'Свободная'}`,
    `Срок: ${program?.termRule || 'Бессрочно'}`,
    `Выгода: ${program?.benefit || 'Без дополнительной выгоды'}`,
  ];
  if (issuedCount != null) lines.push(`Оформлено: ${Math.max(0, Number(issuedCount) || 0)}`);
  lines.push(`Создано: ${shortDateTime(program?.createdAt, '—')}`, '', program?.description || 'Дополнительные условия не указаны.');
  return lines.join('\n');
}

function depositInfo(deposit = {}) {
  const terms = deposit?.terms && typeof deposit.terms === 'object' ? deposit.terms : {};
  return details([
    { label: 'UEI', value: depositUei(deposit) || '—' },
    { label: 'Контакт', value: contactLabel(deposit?.person || {}) },
    { label: 'Дата оформления', value: shortDateTime(deposit?.fundedAt, '—') },
    { label: 'Внесено', value: money(deposit?.fundedAmount) },
    { label: 'Остаток', value: money(deposit?.balance) },
    { label: 'Срок', value: terms?.termRule || 'Бессрочно' },
    { label: 'Выгода', value: terms?.benefit || 'Без дополнительной выгоды' },
    { label: 'Состояние', value: depositStatusLabel(deposit?.status) },
  ]);
}

function historyMarkup(deposit = {}) {
  const items = Array.isArray(deposit?.history) ? deposit.history : [];
  if (!items.length) return emptyState('Истории пока нет', 'Движения депозита появятся здесь.');
  const kindLabel = (kind) => {
    if (kind === 'deposit-funding') return 'Внесение';
    if (kind === 'deposit-withdrawal') return 'Возврат остатка';
    if (kind === 'refund') return 'Возврат оплаты';
    if (kind === 'payment') return 'Использование при оплате';
    return 'Операция';
  };
  return miniCardRail([...items].reverse().map((item) => miniCard({
    title: kindLabel(item?.kind),
    value: `${item?.direction === 'in' ? '+' : '−'}${money(item?.amount)}`,
    subtitle: shortDateTime(item?.occurredAt, '—'),
  })));
}

function issuedList(items = []) {
  if (!items.length) return emptyState('Депозитов пока нет', 'Оформленные депозиты этой программы появятся здесь.');
  return v2ListEntries(items.map((deposit) => v2ListEntry({
    title: contactLabel(deposit?.person || {}),
    subtitle: depositUei(deposit) || depositStatusLabel(deposit?.status),
    rightTop: money(deposit?.balance),
    rightBottom: depositStatusLabel(deposit?.status),
    interactive: true,
    initial: '',
    data: `data-deposit-instance="${escapeHtml(deposit.depositId)}"`,
    aria: `Открыть депозит ${contactLabel(deposit?.person || {})}`,
  })));
}

async function setProgramStatus(programId, status) {
  const now = new Date().toISOString();
  const next = getDepositPrograms().map((item) => String(item?.id) === String(programId)
    ? { ...item, status, updatedAt: now }
    : item);
  await saveDepositPrograms(next);
}

function openCodeX({ title = 'UEI', entityType, entityId, onCreated = () => {} } = {}) {
  const current = getUEI(entityType, entityId) || '';
  if (current) {
    return mountModal(document.body, modal(`<div class="form-grid">${ueiField({ value: current, readonly: true })}</div>`, {
      title,
      variant: 'x',
      surface: 'app',
    }));
  }
  const layer = mountModal(document.body, modal(`<form class="form-grid" data-deposit-code-form>
    ${ueiField()}
    ${button('Создать', { type: 'submit' })}
    <div class="form-error" data-deposit-code-error></div>
  </form>`, { title, variant: 'x', surface: 'app' }));
  if (!layer) return null;
  bindUeiInput(layer);
  const form = layer.querySelector('[data-deposit-code-form]');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const errorNode = layer.querySelector('[data-deposit-code-error]');
    try {
      const uei = ensureUeiAvailable(new FormData(form).get('uei'));
      createUEI({ entityType, entityId, value: uei });
      layer.v2Close?.();
      onCreated?.(uei);
    } catch (error) {
      if (errorNode) errorNode.textContent = error instanceof Error ? error.message : 'Не удалось создать UEI';
    }
  });
  return layer;
}

function openAppearanceQ(root, onSaved = () => {}) {
  const programs = getDepositPrograms();
  const sample = programs[0] || {
    id: '', name: 'Депозит', amount: 30000, termRule: '12 месяцев', benefit: 'Условия программы', status: 'active',
  };
  return openEntityCardAppearanceQ(root, {
    title: 'Вид',
    typeLabel: 'Карта',
    typeOptions: [{ value: depositCardScope(), label: 'Депозит' }],
    initialType: depositCardScope(),
    targetOptions: () => [],
    allowPhoto: true,
    resolve: () => ({
      appearance: depositCardAppearance(),
      fields: programFields(sample),
      photo: depositCardPhoto(),
      photoPosition: depositCardPhotoPosition(),
    }),
    save: async ({ appearance, photo }) => {
      const current = getCardAppearanceTemplate(depositCardScope());
      saveCardAppearanceTemplate(depositCardScope(), {
        appearance,
        photo,
        photoPosition: current?.photoPosition || depositCardPhotoPosition(),
      });
    },
    onSaved,
  });
}

function openProgramConditions(program, issuedCount) {
  return openDocumentViewer({
    title: program?.name || 'Условия депозита',
    content: programConditions(program, issuedCount),
  });
}

async function openCreateProgramQ(root, onSaved = () => {}) {
  const layer = mountModal(root, modal(`${depositHeaderContext({
    title: 'Новая депозитная программа',
    c: { label: 'Сохранить', data: 'data-deposit-program-save', aria: 'Сохранить депозитную программу' },
  })}
    <form class="form-grid" data-deposit-program-form>
      ${field({ label: 'Название', name: 'name', required: true })}
      ${ueiField({ name: 'programUei' })}
      ${field({ label: 'Сумма программы', name: 'amount', type: 'number', min: '0', step: '0.01', inputmode: 'decimal', placeholder: '0 — свободная сумма' })}
      ${field({ label: 'Срок / правило срока', name: 'termRule', placeholder: 'Например: 12 месяцев или бессрочно' })}
      ${field({ label: 'Выгода', name: 'benefit', placeholder: 'Например: скидка 10%' })}
      ${textareaField({ label: 'Условия', name: 'description' })}
      <div class="form-error" data-deposit-program-error></div>
    </form>`, { variant: 'q', surface: 'app', title: 'Новая депозитная программа' }));
  if (!layer) return null;
  bindUeiInput(layer, 'programUei');
  const form = layer.querySelector('[data-deposit-program-form]');
  layer.querySelector('[data-deposit-program-save]')?.addEventListener('click', async () => {
    const errorNode = layer.querySelector('[data-deposit-program-error]');
    const validationError = formValidationMessage(form);
    if (validationError) {
      if (errorNode) errorNode.textContent = validationError;
      return;
    }
    const values = formObject(form);
    const id = uid();
    let reserved = false;
    try {
      const code = ensureUeiAvailable(values.programUei);
      createUEI({ entityType: PROGRAM_UEI_TYPE, entityId: id, value: code });
      reserved = true;
      const now = new Date().toISOString();
      const program = {
        id,
        name: values.name,
        amount: Math.max(0, Number(String(values.amount || '0').replace(',', '.')) || 0),
        termRule: values.termRule || '',
        benefit: values.benefit || '',
        description: values.description || '',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      await saveDepositPrograms([...getDepositPrograms(), program]);
      layer.v2Close?.();
      await onSaved?.();
    } catch (error) {
      if (reserved) {
        try { detachUEI({ entityType: PROGRAM_UEI_TYPE, entityId: id, uei: getUEI(PROGRAM_UEI_TYPE, id), explicit: false }); } catch {}
      }
      if (errorNode) errorNode.textContent = error instanceof Error ? error.message : 'Не удалось сохранить программу';
    }
  });
  notifyContext();
  return layer;
}

async function openFundQ(root, program, { person = null, onSaved = () => {} } = {}) {
  const wallets = getWallets();
  const people = getAllPeople();
  const fixedPersonKey = String(person?.key || person?.id || '');
  const selectedPerson = fixedPersonKey ? person : null;
  const contactField = selectedPerson
    ? field({ label: 'Контакт', name: 'personName', value: contactLabel(selectedPerson), disabled: true })
    : select({
        label: 'Контакт',
        name: 'personKey',
        value: '',
        options: [{ value: '', label: 'Выберите контакт' }, ...people.map(contactOption).filter((item) => item.value)],
      });
  const layer = mountModal(root, modal(`${depositHeaderContext({
    title: 'Оформить депозит',
    c: { label: 'Оформить', data: 'data-deposit-fund-save', aria: 'Оформить депозит' },
  })}
    <form class="form-grid" data-deposit-fund-form>
      ${contactField}
      ${ueiField({ name: 'depositUei' })}
      ${field({ label: 'Сумма', name: 'amount', type: 'number', min: '0.01', step: '0.01', inputmode: 'decimal', value: Number(program?.amount || 0) > 0 ? program.amount : '' })}
      ${select({ label: 'Кошелёк приёма денег', name: 'walletId', value: '', options: [{ value: '', label: 'Выберите кошелёк' }, ...wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))] })}
      ${datePicker({ label: 'Дата внесения', name: 'occurredAt', value: new Date().toISOString().slice(0, 10), showYear: true, modalVariant: 'bottom', modalSurface: 'app', allowClear: false })}
      <div class="form-error" data-deposit-fund-error></div>
    </form>`, { variant: 'q', surface: 'app', title: 'Оформить депозит' }));
  if (!layer) return null;
  initDatePickers(layer);
  bindUeiInput(layer, 'depositUei');
  const form = layer.querySelector('[data-deposit-fund-form]');
  layer.querySelector('[data-deposit-fund-save]')?.addEventListener('click', async () => {
    const errorNode = layer.querySelector('[data-deposit-fund-error]');
    const validationError = formValidationMessage(form);
    if (validationError) {
      if (errorNode) errorNode.textContent = validationError;
      return;
    }
    const values = formObject(form);
    const owner = selectedPerson || people.find((item) => String(item?.key || item?.id || '') === String(values.personKey || ''));
    const wallet = wallets.find((item) => String(item?.id) === String(values.walletId));
    const amount = Math.max(0, Number(String(values.amount || '0').replace(',', '.')) || 0);
    if (!owner || !wallet || amount <= 0) {
      if (errorNode) errorNode.textContent = 'Укажите контакт, сумму и кошелёк';
      return;
    }
    try {
      const code = ensureUeiAvailable(values.depositUei);
      const display = personDisplay(owner);
      const deposit = await fundDeposit({
        programId: program.id,
        person: { key: owner.key || owner.id || '', uei: display.uei || '', name: display.name || '' },
        amount,
        walletId: wallet.id,
        walletName: wallet.name,
        occurredAt: new Date(`${values.occurredAt}T12:00:00`),
      });
      if (!deposit?.depositId) throw new Error('Депозит не создан');
      createUEI({
        entityType: DEPOSIT_UEI_TYPE,
        entityId: deposit.depositId,
        value: code,
        identifiers: [display.uei, programUei(program)].filter(Boolean),
      });
      layer.v2Close?.();
      openNotice({ title: 'Депозит оформлен', message: `Принято ${money(amount)}. UEI: ${code}` });
      await onSaved?.(deposit);
    } catch (error) {
      if (errorNode) errorNode.textContent = error instanceof Error ? error.message : 'Не удалось оформить депозит';
    }
  });
  notifyContext();
  return layer;
}

async function openWithdrawX(root, deposit, onSaved = () => {}) {
  const wallets = getWallets();
  const layer = mountModal(root, modal(`<form class="form-grid" data-deposit-withdraw-form>
    ${field({ label: 'Сумма возврата', name: 'amount', type: 'number', min: '0.01', max: deposit.balance, step: '0.01', inputmode: 'decimal', value: deposit.balance })}
    ${select({ label: 'Кошелёк возврата', name: 'walletId', value: '', options: [{ value: '', label: 'Выберите кошелёк' }, ...wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))] })}
    ${datePicker({ label: 'Дата возврата', name: 'occurredAt', value: new Date().toISOString().slice(0, 10), showYear: true, modalVariant: 'bottom', modalSurface: 'app', allowClear: false })}
    ${textareaField({ label: 'Комментарий', name: 'reason' })}
    ${button('Вернуть', { type: 'submit', variant: 'danger' })}
    <div class="form-error" data-deposit-withdraw-error></div>
  </form>`, { variant: 'x', surface: 'app', title: 'Возврат депозита' }));
  if (!layer) return null;
  initDatePickers(layer);
  const form = layer.querySelector('[data-deposit-withdraw-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = formObject(form);
    const errorNode = layer.querySelector('[data-deposit-withdraw-error]');
    const wallet = wallets.find((item) => String(item?.id) === String(values.walletId));
    const amount = Math.max(0, Number(String(values.amount || '0').replace(',', '.')) || 0);
    if (!wallet || !amount || amount > Number(deposit?.balance || 0) + 0.009) {
      if (errorNode) errorNode.textContent = 'Проверьте сумму и кошелёк';
      return;
    }
    try {
      await withdrawDeposit({
        depositId: deposit.depositId,
        amount,
        walletId: wallet.id,
        walletName: wallet.name,
        reason: values.reason || '',
        occurredAt: new Date(`${values.occurredAt}T12:00:00`),
      });
      layer.v2Close?.();
      await onSaved?.();
    } catch (error) {
      if (errorNode) errorNode.textContent = error instanceof Error ? error.message : 'Не удалось вернуть депозит';
    }
  });
  return layer;
}

function openRootSettings(root, rerender) {
  return openSharedProfileSettingsMenu({
    title: 'Депозит',
    actions: [
      { id: 'appearance', label: 'Вид', onSelect: () => openAppearanceQ(root, rerender) },
    ],
  });
}

function openProgramSettings(root, program, rerender) {
  const actions = [
    {
      id: 'code',
      label: 'Код',
      onSelect: () => openCodeX({ title: 'UEI программы', entityType: PROGRAM_UEI_TYPE, entityId: program.id, onCreated: rerender }),
    },
  ];
  if (program.status === 'active') actions.push({ id: 'pause', label: 'Приостановить', onSelect: async () => { await setProgramStatus(program.id, 'paused'); await rerender(); } });
  if (program.status === 'paused') actions.push({ id: 'resume', label: 'Возобновить', onSelect: async () => { await setProgramStatus(program.id, 'active'); await rerender(); } });
  if (program.status !== 'closed') actions.push({ id: 'close', label: 'Закрыть программу', variant: 'danger', onSelect: async () => { await setProgramStatus(program.id, 'closed'); await rerender(); } });
  return openSharedProfileSettingsMenu({ title: program.name || 'Депозит', actions });
}

async function openDepositLayer(root, depositId, onChanged = () => {}) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-deposit-instance-z' }), { stack: true });
  if (!layer) return null;
  const render = async () => {
    const deposits = await listAllDeposits();
    const deposit = deposits.find((item) => String(item?.depositId) === String(depositId));
    if (!deposit) {
      layer.v2Close?.();
      return;
    }
    layer.innerHTML = page([
      depositHeaderContext({
        title: deposit.programName || 'Депозит',
        settingsData: 'data-deposit-instance-settings',
        settingsAria: 'Настройки депозита',
        c: Number(deposit.balance || 0) > 0.009 ? { label: 'Возврат', data: 'data-deposit-withdraw', aria: 'Вернуть остаток депозита' } : null,
      }),
      depositInfo(deposit),
      v2Section('История', historyMarkup(deposit)),
    ]);
    layer.querySelector('[data-deposit-instance-settings]')?.addEventListener('click', () => {
      openSharedProfileSettingsMenu({
        title: deposit.programName || 'Депозит',
        actions: [{
          id: 'code',
          label: 'Код',
          onSelect: () => openCodeX({ title: 'UEI депозита', entityType: DEPOSIT_UEI_TYPE, entityId: deposit.depositId, onCreated: render }),
        }],
      });
    });
    layer.querySelector('[data-deposit-withdraw]')?.addEventListener('click', () => openWithdrawX(root, deposit, async () => {
      await render();
      await onChanged?.();
    }));
    notifyContext();
  };
  await render();
  return layer;
}

async function openProgramLayer(root, programId, { person = null, onChanged = () => {} } = {}) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-deposit-program-z' }), { stack: true });
  if (!layer) return null;
  const render = async () => {
    await loadDepositPrograms();
    const program = getDepositPrograms().find((item) => String(item?.id) === String(programId));
    if (!program) {
      layer.v2Close?.();
      return;
    }
    const allDeposits = await listAllDeposits();
    const issued = allDeposits.filter((item) => String(item?.programId) === String(program.id));
    layer.innerHTML = page([
      depositHeaderContext({
        title: program.name || 'Депозит',
        settingsData: 'data-deposit-program-settings',
        settingsAria: 'Настройки депозитной программы',
        c: program.status === 'active' ? { label: 'Оформить', data: 'data-deposit-program-fund', aria: 'Оформить депозит' } : null,
      }),
      v2Section('Оформленные депозиты', issuedList(issued)),
    ]);
    setV2ZHeaderRows(layer, [smallActionButton({ icon: 'info', data: 'data-deposit-info', aria: 'Условия депозитной программы' })]);
    layer.querySelector('[data-deposit-info]')?.addEventListener('click', () => openProgramConditions(program, issued.length));
    layer.querySelector('[data-deposit-program-settings]')?.addEventListener('click', () => openProgramSettings(root, program, async () => {
      await render();
      await onChanged?.();
    }));
    layer.querySelector('[data-deposit-program-fund]')?.addEventListener('click', () => openFundQ(root, program, {
      person,
      onSaved: async () => {
        await render();
        await onChanged?.();
      },
    }));
    layer.querySelectorAll('[data-deposit-instance]').forEach((node) => {
      node.addEventListener('click', () => openDepositLayer(root, node.dataset.depositInstance, async () => {
        await render();
        await onChanged?.();
      }));
    });
    notifyContext();
  };
  await render();
  return layer;
}

export async function openDepositForPerson(root, person = null) {
  await loadDepositPrograms();
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-deposit-z' }), { stack: true });
  if (!layer) return null;
  const render = async () => {
    await loadDepositPrograms();
    const programs = getDepositPrograms().filter((item) => !item?.archivedAt);
    const cards = programs.length
      ? entityCardStack(programs.map((program) => card(programFields(program), {
          data: `data-deposit-program="${escapeHtml(program.id)}"`,
          aria: `Открыть депозитную программу ${program.name || ''}`,
        })))
      : emptyState('Депозитных программ пока нет', 'Создайте первую программу кнопкой «+».');
    layer.innerHTML = page([
      depositHeaderContext({
        title: 'Депозит',
        settingsData: 'data-deposit-settings',
        settingsAria: 'Настройки депозита',
        c: { label: '+', data: 'data-deposit-program-add', aria: 'Создать депозитную программу' },
      }),
      cards,
    ]);
    layer.querySelector('[data-deposit-settings]')?.addEventListener('click', () => openRootSettings(root, render));
    layer.querySelector('[data-deposit-program-add]')?.addEventListener('click', () => openCreateProgramQ(root, render));
    layer.querySelectorAll('[data-deposit-program]').forEach((node) => {
      node.addEventListener('click', () => openProgramLayer(root, node.dataset.depositProgram, { person, onChanged: render }));
    });
    notifyContext();
  };
  await render();
  return layer;
}

export async function renderDeposit(root) {
  await loadDepositPrograms();
  const programs = getDepositPrograms().filter((item) => !item?.archivedAt);
  root.innerHTML = page([
    depositHeaderContext({
      title: 'Депозит',
      settingsData: 'data-deposit-settings',
      settingsAria: 'Настройки депозита',
      c: { label: '+', data: 'data-deposit-program-add', aria: 'Создать депозитную программу' },
    }),
    programs.length ? entityCardStack(programs.map((program) => card(programFields(program), {
      data: `data-deposit-program="${escapeHtml(program.id)}"`,
      aria: `Открыть депозитную программу ${program.name || ''}`,
    }))) : emptyState('Депозитных программ пока нет', 'Создайте первую программу кнопкой «+».')
  ]);
  const rerender = () => renderDeposit(root);
  root.querySelector('[data-deposit-settings]')?.addEventListener('click', () => openRootSettings(root, rerender));
  root.querySelector('[data-deposit-program-add]')?.addEventListener('click', () => openCreateProgramQ(root, rerender));
  root.querySelectorAll('[data-deposit-program]').forEach((node) => node.addEventListener('click', () => openProgramLayer(root, node.dataset.depositProgram, { onChanged: rerender })));
  notifyContext();
}

export { renderDeposit as render };

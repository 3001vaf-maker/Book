import {
  button,
  emptyState,
  field,
  modal,
  mountModal,
  openNotice,
  select,
  v2ListEntries,
  v2ListEntry,
  workspaceHeaderContext,
} from '../../ui/ui.js';
import { canUseBookCapability } from '../access.js';
import { queueOperationalDataset } from '../business-persistence.js';
import { getAllPeople } from '../people/data.js';
import { personDisplay } from '../people/presentation.js';

const LOYALTY_NAVIGATION = [
  { id: 'subscriptions', label: 'Абонементы', capability: 'loyalty.subscriptions.access' },
  { id: 'personal-account', label: 'Личный счёт', capability: 'loyalty.personal_account.access' },
  { id: 'deposit', label: 'Депозит', capability: 'loyalty.deposit.access' },
];

const EMPTY_STATE = {
  subscriptions: { programs: [], issued: [] },
  personalAccounts: { balances: {}, ledger: [] },
  deposits: { balances: {}, ledger: [] },
};

let state = structuredClone(EMPTY_STATE);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value.map((item) => clone(objectValue(item))) : [];
}

function normalizeState(value = {}) {
  const source = objectValue(value);
  const subscriptions = objectValue(source.subscriptions);
  const personalAccounts = objectValue(source.personalAccounts);
  const deposits = objectValue(source.deposits);
  return {
    subscriptions: {
      programs: arrayValue(subscriptions.programs),
      issued: arrayValue(subscriptions.issued),
    },
    personalAccounts: {
      balances: clone(objectValue(personalAccounts.balances)),
      ledger: arrayValue(personalAccounts.ledger),
    },
    deposits: {
      balances: clone(objectValue(deposits.balances)),
      ledger: arrayValue(deposits.ledger),
    },
  };
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value) {
  return `${numberValue(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 }).replaceAll('\u00a0', ' ')} ₽`;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function personKey(person = {}) {
  return String(person?.key || person?.id || '').trim();
}

function personLabel(person = {}) {
  const display = personDisplay(person);
  return display.name || display.uei || personKey(person) || 'Контакт';
}

function personOptions() {
  return getAllPeople()
    .map((person) => ({ value: personKey(person), label: personLabel(person), meta: personDisplay(person).uei || '' }))
    .filter((item) => item.value);
}

function personName(key) {
  const person = getAllPeople().find((item) => personKey(item) === String(key || ''));
  return person ? personLabel(person) : 'Контакт';
}

function persist() {
  return queueOperationalDataset('loyalty', clone(state));
}

function notifyContext() {
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function closeModal(host) {
  const root = host?.closest?.('[data-modal]') || host;
  root?.v2Close?.();
}

export function hydrateLoyaltyFromServer(value) {
  state = normalizeState(value);
  return getLoyaltyState();
}

export function getLoyaltyState() {
  return clone(state);
}

export function loyaltyNavigationItems() {
  return LOYALTY_NAVIGATION
    .filter((item) => canUseBookCapability(item.capability))
    .map(({ id, label }) => ({ id, label }));
}

function openSubscriptionProgramModal(onSaved) {
  const content = `<form data-loyalty-subscription-form class="form-grid">
    ${field({ label: 'Название', name: 'name', required: true, maxlength: 80 })}
    ${field({ label: 'Количество посещений', name: 'visits', type: 'number', min: 1, step: 1, value: 1, required: true })}
    ${field({ label: 'Срок действия, дней', name: 'validDays', type: 'number', min: 1, step: 1, value: 30, required: true })}
    ${field({ label: 'Стоимость', name: 'price', type: 'number', min: 0, step: 0.01, value: 0, required: true })}
    ${button('Сохранить', { type: 'submit' })}
  </form>`;
  const modalRoot = mountModal(document.body, modal(content, { variant: 'x', title: 'Новый абонемент' }));
  const form = modalRoot?.querySelector('[data-loyalty-subscription-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const visits = Math.max(1, Math.round(numberValue(data.get('visits'), 1)));
    const validDays = Math.max(1, Math.round(numberValue(data.get('validDays'), 30)));
    const price = Math.max(0, numberValue(data.get('price')));
    if (!name) return;
    state.subscriptions.programs.push({ id: uid('subscription-program'), name, visits, validDays, price, active: true, createdAt: new Date().toISOString() });
    await persist();
    closeModal(modalRoot);
    onSaved?.();
  });
}

function openIssueSubscriptionModal(program, onSaved) {
  const options = personOptions();
  if (!options.length) {
    openNotice({ message: 'Сначала добавьте контакт.' });
    return;
  }
  const content = `<form data-loyalty-issue-form class="form-grid">
    ${select({ label: 'Контакт', name: 'personKey', value: options[0]?.value || '', options, searchable: true })}
    ${field({ label: 'Оплачено', name: 'paid', type: 'number', min: 0, step: 0.01, value: program.price || 0 })}
    ${button('Выдать', { type: 'submit' })}
  </form>`;
  const modalRoot = mountModal(document.body, modal(content, { variant: 'x', title: program.name || 'Абонемент' }));
  const form = modalRoot?.querySelector('[data-loyalty-issue-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const key = String(data.get('personKey') || '').trim();
    if (!key) return;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + Math.max(1, Number(program.validDays || 1)) * 86400000);
    state.subscriptions.issued.push({
      id: uid('subscription'),
      programId: program.id,
      personKey: key,
      total: Math.max(1, Number(program.visits || 1)),
      remaining: Math.max(1, Number(program.visits || 1)),
      paid: Math.max(0, numberValue(data.get('paid'))),
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'active',
    });
    await persist();
    closeModal(modalRoot);
    onSaved?.();
  });
}

function openIssuedSubscriptionModal(item, onSaved) {
  const program = state.subscriptions.programs.find((candidate) => candidate.id === item.programId) || {};
  const content = `<div class="form-grid">
    ${field({ label: 'Контакт', value: personName(item.personKey), readonly: true })}
    ${field({ label: 'Абонемент', value: program.name || 'Абонемент', readonly: true })}
    ${field({ label: 'Осталось посещений', value: item.remaining, readonly: true })}
    ${item.remaining > 0 ? button('Списать посещение', { data: 'data-loyalty-consume' }) : ''}
  </div>`;
  const modalRoot = mountModal(document.body, modal(content, { variant: 'x', title: 'Абонемент' }));
  modalRoot?.querySelector('[data-loyalty-consume]')?.addEventListener('click', async () => {
    item.remaining = Math.max(0, Number(item.remaining || 0) - 1);
    if (item.remaining <= 0) item.status = 'used';
    await persist();
    closeModal(modalRoot);
    onSaved?.();
  });
}

function renderSubscriptions(root, rerender) {
  const rows = [];
  state.subscriptions.programs.forEach((program) => {
    rows.push(v2ListEntry({
      overline: 'Программа',
      title: program.name,
      subtitle: `${program.visits} посещ. · ${program.validDays} дн.`,
      rightTop: money(program.price),
      data: `data-loyalty-program="${program.id}"`,
      aria: `Абонемент ${program.name}`,
    }));
  });
  state.subscriptions.issued.forEach((item) => {
    const program = state.subscriptions.programs.find((candidate) => candidate.id === item.programId) || {};
    rows.push(v2ListEntry({
      overline: 'Выдан',
      title: personName(item.personKey),
      subtitle: program.name || 'Абонемент',
      rightTop: `${Number(item.remaining || 0)} / ${Number(item.total || 0)}`,
      rightBottom: 'посещений',
      data: `data-loyalty-issued="${item.id}"`,
      aria: `Абонемент ${personName(item.personKey)}`,
    }));
  });
  root.innerHTML = `${workspaceHeaderContext({ title: 'Абонементы', c: { label: '+', kind: 'text', data: 'data-loyalty-add-program', aria: 'Добавить абонемент' } })}${rows.length ? v2ListEntries(rows) : emptyState('Абонементов пока нет', 'Создайте первую программу.')}`;
  root.querySelector('[data-loyalty-add-program]')?.addEventListener('click', () => openSubscriptionProgramModal(rerender));
  root.querySelectorAll('[data-loyalty-program]').forEach((node) => node.addEventListener('click', () => {
    const program = state.subscriptions.programs.find((item) => item.id === node.dataset.loyaltyProgram);
    if (program) openIssueSubscriptionModal(program, rerender);
  }));
  root.querySelectorAll('[data-loyalty-issued]').forEach((node) => node.addEventListener('click', () => {
    const item = state.subscriptions.issued.find((candidate) => candidate.id === node.dataset.loyaltyIssued);
    if (item) openIssuedSubscriptionModal(item, rerender);
  }));
}

function ledgerTarget(section) {
  return section === 'deposit' ? state.deposits : state.personalAccounts;
}

function openBalanceOperationModal(section, onSaved) {
  const options = personOptions();
  if (!options.length) {
    openNotice({ message: 'Сначала добавьте контакт.' });
    return;
  }
  const title = section === 'deposit' ? 'Операция по депозиту' : 'Операция по личному счёту';
  const content = `<form data-loyalty-balance-form class="form-grid">
    ${select({ label: 'Контакт', name: 'personKey', value: options[0]?.value || '', options, searchable: true })}
    ${field({ label: 'Сумма', name: 'amount', type: 'number', step: 0.01, required: true })}
    ${field({ label: 'Комментарий', name: 'note', maxlength: 160 })}
    ${button('Провести', { type: 'submit' })}
  </form>`;
  const modalRoot = mountModal(document.body, modal(content, { variant: 'x', title }));
  const form = modalRoot?.querySelector('[data-loyalty-balance-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const key = String(data.get('personKey') || '').trim();
    const amount = numberValue(data.get('amount'));
    if (!key || !amount) return;
    const target = ledgerTarget(section);
    const current = numberValue(target.balances[key]);
    const next = current + amount;
    if (next < -0.009) {
      openNotice({ message: 'Недостаточно средств.' });
      return;
    }
    target.balances[key] = next;
    target.ledger.push({ id: uid(section), personKey: key, amount, note: String(data.get('note') || '').trim(), occurredAt: new Date().toISOString() });
    await persist();
    closeModal(modalRoot);
    onSaved?.();
  });
}

function renderBalances(root, section, rerender) {
  const target = ledgerTarget(section);
  const title = section === 'deposit' ? 'Депозит' : 'Личный счёт';
  const rows = Object.entries(target.balances)
    .filter(([, balance]) => Math.abs(numberValue(balance)) > 0.009)
    .map(([key, balance]) => v2ListEntry({
      title: personName(key),
      subtitle: title,
      rightTop: money(balance),
      interactive: false,
    }));
  root.innerHTML = `${workspaceHeaderContext({ title, c: { label: '+', kind: 'text', data: 'data-loyalty-balance-operation', aria: `Добавить операцию: ${title}` } })}${rows.length ? v2ListEntries(rows) : emptyState(`${title}: операций пока нет`, 'Добавьте первую операцию.')}`;
  root.querySelector('[data-loyalty-balance-operation]')?.addEventListener('click', () => openBalanceOperationModal(section, rerender));
}

export function renderLoyaltySection(root, section = 'subscriptions') {
  const allowed = loyaltyNavigationItems();
  const target = allowed.some((item) => item.id === section) ? section : (allowed[0]?.id || 'subscriptions');
  const rerender = () => {
    if (!root?.isConnected) return;
    if (target === 'subscriptions') renderSubscriptions(root, rerender);
    else renderBalances(root, target, rerender);
    notifyContext();
  };
  rerender();
  return () => {};
}

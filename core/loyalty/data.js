import { queueOperationalDataset } from '../business-persistence.js';

export const LOYALTY_PROGRAM_KINDS = Object.freeze(['deposit', 'certificate', 'subscription', 'referral', 'bonus']);

const PROGRAM_COLLECTION = Object.freeze({
  deposit: 'depositPrograms',
  certificate: 'certificatePrograms',
  subscription: 'subscriptionPrograms',
  referral: 'referralPrograms',
  bonus: 'bonusPrograms',
});

const INSTANCE_COLLECTION = Object.freeze({
  deposit: 'deposits',
  certificate: 'certificates',
  subscription: 'subscriptions',
});

const PROGRAM_STATUSES = new Set(['draft', 'active', 'paused', 'completed']);
const ASSIGNMENT_KINDS = new Set(['referral', 'bonus']);
const ASSIGNMENT_STATES = new Set(['assigned', 'excluded']);
const NOMINALS = new Set(['money', 'bonus']);
const DIRECTIONS = new Set(['credit', 'debit']);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function objectValue(value = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value) {
  return String(value ?? '').trim();
}

function numberValue(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function positive(value) {
  return Math.max(0, numberValue(value));
}

function uniqueId(prefix = 'loyalty') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function emptyState() {
  return {
    version: 1,
    bonusPolicy: {
      mode: 'permanent',
      durationValue: 0,
      durationUnit: 'days',
      updatedAt: '',
    },
    bonusPolicyHistory: [],
    depositPrograms: [],
    deposits: [],
    personalAccounts: [],
    accountOperations: [],
    certificatePrograms: [],
    certificates: [],
    subscriptionPrograms: [],
    subscriptions: [],
    referralPrograms: [],
    referralLinks: [],
    bonusPrograms: [],
    bonusEvents: [],
    assignments: [],
  };
}

function normalizeProgram(kind, value = {}) {
  const source = objectValue(value);
  const id = text(source.id);
  if (!id) return null;
  const status = PROGRAM_STATUSES.has(text(source.status)) ? text(source.status) : 'draft';
  return {
    ...clone(source),
    id,
    kind,
    name: text(source.name) || 'Без названия',
    description: text(source.description),
    status,
    audienceMode: ASSIGNMENT_KINDS.has(kind) && text(source.audienceMode) === 'all' ? 'all' : 'selected',
    createdAt: text(source.createdAt),
    startedAt: text(source.startedAt),
    pausedAt: text(source.pausedAt),
    completedAt: text(source.completedAt),
  };
}

function normalizeInstance(kind, value = {}) {
  const source = objectValue(value);
  const id = text(source.id);
  const programId = text(source.programId);
  const personKey = text(source.personKey);
  if (!id || !programId || !personKey) return null;
  return {
    ...clone(source),
    id,
    kind,
    programId,
    personKey,
    buyerPersonKey: text(source.buyerPersonKey),
    status: text(source.status) || 'pending-payment',
    amount: positive(source.amount),
    remaining: source.remaining == null ? positive(source.amount) : positive(source.remaining),
    createdAt: text(source.createdAt),
    financeOperationId: text(source.financeOperationId),
    programSnapshot: clone(objectValue(source.programSnapshot)),
  };
}

function normalizeAccount(value = {}) {
  const source = objectValue(value);
  const id = text(source.id);
  const personKey = text(source.personKey);
  if (!id || !personKey) return null;
  return {
    ...clone(source),
    id,
    personKey,
    moneyBalance: positive(source.moneyBalance),
    bonusBalance: positive(source.bonusBalance),
    createdAt: text(source.createdAt),
    updatedAt: text(source.updatedAt),
  };
}

function normalizeAccountOperation(value = {}) {
  const source = objectValue(value);
  const id = text(source.id);
  const accountId = text(source.accountId);
  const nominal = NOMINALS.has(text(source.nominal)) ? text(source.nominal) : '';
  const direction = DIRECTIONS.has(text(source.direction)) ? text(source.direction) : '';
  if (!id || !accountId || !nominal || !direction) return null;
  return {
    ...clone(source),
    id,
    accountId,
    nominal,
    direction,
    amount: positive(source.amount),
    sourceType: text(source.sourceType) || 'manual',
    sourceId: text(source.sourceId),
    financeOperationId: text(source.financeOperationId),
    workingAt: text(source.workingAt),
    auditAt: text(source.auditAt),
    expiresAt: text(source.expiresAt),
    balanceAfter: positive(source.balanceAfter),
  };
}

function normalizeAssignment(value = {}) {
  const source = objectValue(value);
  const id = text(source.id);
  const kind = text(source.kind);
  const programId = text(source.programId);
  const personKey = text(source.personKey);
  const state = ASSIGNMENT_STATES.has(text(source.state)) ? text(source.state) : '';
  if (!id || !ASSIGNMENT_KINDS.has(kind) || !programId || !personKey || !state) return null;
  return {
    ...clone(source),
    id,
    kind,
    programId,
    personKey,
    state,
    createdAt: text(source.createdAt),
    updatedAt: text(source.updatedAt),
  };
}

function normalizeRows(values, normalizer) {
  return (Array.isArray(values) ? values : []).map(normalizer).filter(Boolean);
}

function normalizeState(value = {}) {
  const source = objectValue(value);
  const state = emptyState();
  const policy = objectValue(source.bonusPolicy);
  state.version = Math.max(1, Math.round(numberValue(source.version) || 1));
  state.bonusPolicy = {
    mode: text(policy.mode) === 'duration' ? 'duration' : 'permanent',
    durationValue: Math.max(0, Math.round(numberValue(policy.durationValue))),
    durationUnit: text(policy.durationUnit) === 'months' ? 'months' : 'days',
    updatedAt: text(policy.updatedAt),
  };
  state.bonusPolicyHistory = Array.isArray(source.bonusPolicyHistory) ? clone(source.bonusPolicyHistory) : [];
  for (const kind of LOYALTY_PROGRAM_KINDS) {
    const collection = PROGRAM_COLLECTION[kind];
    state[collection] = normalizeRows(source[collection], (item) => normalizeProgram(kind, item));
  }
  state.deposits = normalizeRows(source.deposits, (item) => normalizeInstance('deposit', item));
  state.certificates = normalizeRows(source.certificates, (item) => normalizeInstance('certificate', item));
  state.subscriptions = normalizeRows(source.subscriptions, (item) => normalizeInstance('subscription', item));
  state.personalAccounts = normalizeRows(source.personalAccounts, normalizeAccount);
  state.accountOperations = normalizeRows(source.accountOperations, normalizeAccountOperation);
  state.assignments = normalizeRows(source.assignments, normalizeAssignment);
  state.referralLinks = Array.isArray(source.referralLinks) ? clone(source.referralLinks) : [];
  state.bonusEvents = Array.isArray(source.bonusEvents) ? clone(source.bonusEvents) : [];
  return state;
}

let loyaltyState = emptyState();

function persist() {
  void queueOperationalDataset('loyalty', loyaltyState);
  return getLoyaltyState();
}

function programCollection(kind) {
  const key = PROGRAM_COLLECTION[text(kind)];
  if (!key) throw new Error('Неизвестный тип программы Лояльности');
  return key;
}

function instanceCollection(kind) {
  const key = INSTANCE_COLLECTION[text(kind)];
  if (!key) throw new Error('Неизвестный тип экземпляра Лояльности');
  return key;
}

function activeProgram(kind, programId) {
  return loyaltyState[programCollection(kind)].find((item) => item.id === text(programId)) || null;
}

function programTransitionAllowed(from, to) {
  if (from === to) return true;
  if (from === 'draft') return to === 'active' || to === 'completed';
  if (from === 'active') return to === 'paused' || to === 'completed';
  if (from === 'paused') return to === 'active' || to === 'completed';
  return false;
}

function calculateBonusExpiry(at = new Date()) {
  const policy = loyaltyState.bonusPolicy;
  if (policy.mode !== 'duration' || policy.durationValue <= 0) return '';
  const date = at instanceof Date ? new Date(at) : new Date(at || Date.now());
  if (!Number.isFinite(date.getTime())) return '';
  if (policy.durationUnit === 'months') date.setMonth(date.getMonth() + policy.durationValue);
  else date.setDate(date.getDate() + policy.durationValue);
  return date.toISOString();
}

export function hydrateLoyaltyFromServer(value = {}) {
  loyaltyState = normalizeState(value);
  return getLoyaltyState();
}

export function getLoyaltyState() {
  return clone(loyaltyState);
}

export function getLoyaltyPrograms(kind) {
  return clone(loyaltyState[programCollection(kind)]);
}

export function getLoyaltyProgram(kind, programId) {
  const item = activeProgram(kind, programId);
  return item ? clone(item) : null;
}

export function createLoyaltyProgram(kind, payload = {}) {
  const type = text(kind);
  const key = programCollection(type);
  const source = objectValue(payload);
  const name = text(source.name);
  if (!name) throw new Error('Укажите название программы');
  const now = new Date().toISOString();
  const item = normalizeProgram(type, {
    ...clone(source),
    id: uniqueId(`loyalty-${type}`),
    kind: type,
    name,
    status: 'draft',
    createdAt: now,
  });
  loyaltyState[key].push(item);
  persist();
  return clone(item);
}

export function setLoyaltyProgramStatus(kind, programId, nextStatus) {
  const type = text(kind);
  const key = programCollection(type);
  const id = text(programId);
  const next = text(nextStatus);
  if (!PROGRAM_STATUSES.has(next)) throw new Error('Неизвестное состояние программы');
  const index = loyaltyState[key].findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Программа не найдена');
  const current = loyaltyState[key][index];
  if (!programTransitionAllowed(current.status, next)) throw new Error('Недопустимый переход состояния программы');
  const now = new Date().toISOString();
  const updated = {
    ...current,
    status: next,
    startedAt: next === 'active' && !current.startedAt ? now : current.startedAt,
    pausedAt: next === 'paused' ? now : current.pausedAt,
    completedAt: next === 'completed' ? now : current.completedAt,
  };
  loyaltyState[key][index] = normalizeProgram(type, updated);
  persist();
  return clone(loyaltyState[key][index]);
}

export function getLoyaltyInstances(kind, programId = '') {
  const key = instanceCollection(kind);
  const id = text(programId);
  const values = id ? loyaltyState[key].filter((item) => item.programId === id) : loyaltyState[key];
  return clone(values);
}

export function createLoyaltyInstance(kind, payload = {}) {
  const type = text(kind);
  const key = instanceCollection(type);
  const source = objectValue(payload);
  const program = activeProgram(type, source.programId);
  const personKey = text(source.personKey);
  if (!program) throw new Error('Программа не найдена');
  if (!personKey) throw new Error('Выберите человека');
  const amount = positive(source.amount ?? program.amount ?? program.price ?? 0);
  const financeOperationId = text(source.financeOperationId);
  const item = normalizeInstance(type, {
    ...clone(source),
    id: uniqueId(`loyalty-${type}-instance`),
    kind: type,
    programId: program.id,
    personKey,
    buyerPersonKey: text(source.buyerPersonKey),
    amount,
    remaining: amount,
    financeOperationId,
    status: amount > 0 && !financeOperationId ? 'pending-payment' : 'active',
    createdAt: new Date().toISOString(),
    programSnapshot: clone(program),
  });
  loyaltyState[key].push(item);
  persist();
  return clone(item);
}

export function getPersonalAccounts() {
  return clone(loyaltyState.personalAccounts);
}

export function getPersonalAccount(accountId) {
  const id = text(accountId);
  const item = loyaltyState.personalAccounts.find((value) => value.id === id);
  return item ? clone(item) : null;
}

export function getPersonalAccountByPerson(personKey) {
  const key = text(personKey);
  const item = loyaltyState.personalAccounts.find((value) => value.personKey === key);
  return item ? clone(item) : null;
}

export function createPersonalAccount(personKey) {
  const key = text(personKey);
  if (!key) throw new Error('Выберите человека');
  const existing = loyaltyState.personalAccounts.find((item) => item.personKey === key);
  if (existing) return clone(existing);
  const now = new Date().toISOString();
  const account = normalizeAccount({
    id: uniqueId('loyalty-account'),
    personKey: key,
    moneyBalance: 0,
    bonusBalance: 0,
    createdAt: now,
    updatedAt: now,
  });
  loyaltyState.personalAccounts.push(account);
  persist();
  return clone(account);
}

export function getPersonalAccountOperations(accountId) {
  const id = text(accountId);
  return clone(loyaltyState.accountOperations.filter((item) => item.accountId === id));
}

export function recordPersonalAccountOperation(payload = {}) {
  const source = objectValue(payload);
  const accountId = text(source.accountId);
  const nominal = text(source.nominal);
  const direction = text(source.direction);
  const amount = positive(source.amount);
  if (!NOMINALS.has(nominal) || !DIRECTIONS.has(direction) || amount <= 0) throw new Error('Некорректная операция Личного счёта');
  const accountIndex = loyaltyState.personalAccounts.findIndex((item) => item.id === accountId);
  if (accountIndex < 0) throw new Error('Личный счёт не найден');
  const financeOperationId = text(source.financeOperationId);
  if (nominal === 'money' && !financeOperationId) throw new Error('Денежная операция Личного счёта требует связанного движения Финансов');
  const account = loyaltyState.personalAccounts[accountIndex];
  const current = nominal === 'money' ? account.moneyBalance : account.bonusBalance;
  const next = direction === 'credit' ? current + amount : current - amount;
  if (next < -0.0001) throw new Error('Недостаточно средств на Личном счёте');
  const auditAt = new Date().toISOString();
  const workingAt = text(source.workingAt) || auditAt;
  const operation = normalizeAccountOperation({
    ...clone(source),
    id: uniqueId('loyalty-account-operation'),
    accountId,
    nominal,
    direction,
    amount,
    financeOperationId,
    workingAt,
    auditAt,
    expiresAt: nominal === 'bonus' && direction === 'credit' ? (text(source.expiresAt) || calculateBonusExpiry(workingAt)) : text(source.expiresAt),
    balanceAfter: Math.max(0, next),
  });
  loyaltyState.accountOperations.push(operation);
  loyaltyState.personalAccounts[accountIndex] = normalizeAccount({
    ...account,
    moneyBalance: nominal === 'money' ? Math.max(0, next) : account.moneyBalance,
    bonusBalance: nominal === 'bonus' ? Math.max(0, next) : account.bonusBalance,
    updatedAt: auditAt,
  });
  persist();
  return clone(operation);
}

export function getBonusPolicy() {
  return clone(loyaltyState.bonusPolicy);
}

export function setBonusPolicy({ mode = 'permanent', durationValue = 0, durationUnit = 'days' } = {}) {
  const previous = clone(loyaltyState.bonusPolicy);
  const next = {
    mode: text(mode) === 'duration' ? 'duration' : 'permanent',
    durationValue: Math.max(0, Math.round(numberValue(durationValue))),
    durationUnit: text(durationUnit) === 'months' ? 'months' : 'days',
    updatedAt: new Date().toISOString(),
  };
  if (next.mode === 'duration' && next.durationValue <= 0) throw new Error('Укажите срок жизни новых бонусов');
  if (previous.updatedAt) loyaltyState.bonusPolicyHistory.push(previous);
  loyaltyState.bonusPolicy = next;
  persist();
  return clone(next);
}

export function getProgramAssignments(kind, programId = '') {
  const type = text(kind);
  if (!ASSIGNMENT_KINDS.has(type)) return [];
  const id = text(programId);
  return clone(loyaltyState.assignments.filter((item) => item.kind === type && (!id || item.programId === id)));
}

export function setProgramAssignment(kind, programId, personKey, state = 'assigned') {
  const type = text(kind);
  const program = activeProgram(type, programId);
  const person = text(personKey);
  const nextState = text(state);
  if (!ASSIGNMENT_KINDS.has(type) || !program || !person || !ASSIGNMENT_STATES.has(nextState)) throw new Error('Некорректное назначение программы');
  const index = loyaltyState.assignments.findIndex((item) => item.kind === type && item.programId === program.id && item.personKey === person);
  const now = new Date().toISOString();
  const next = normalizeAssignment({
    id: index >= 0 ? loyaltyState.assignments[index].id : uniqueId('loyalty-assignment'),
    kind: type,
    programId: program.id,
    personKey: person,
    state: nextState,
    createdAt: index >= 0 ? loyaltyState.assignments[index].createdAt : now,
    updatedAt: now,
  });
  if (index >= 0) loyaltyState.assignments[index] = next;
  else loyaltyState.assignments.push(next);
  persist();
  return clone(next);
}

export function clearProgramAssignment(kind, programId, personKey) {
  const type = text(kind);
  const program = text(programId);
  const person = text(personKey);
  const before = loyaltyState.assignments.length;
  loyaltyState.assignments = loyaltyState.assignments.filter((item) => !(item.kind === type && item.programId === program && item.personKey === person));
  if (loyaltyState.assignments.length !== before) persist();
  return before !== loyaltyState.assignments.length;
}

export function isProgramAssignedToPerson(kind, programId, personKey) {
  const type = text(kind);
  const program = activeProgram(type, programId);
  const person = text(personKey);
  if (!program || !person || !ASSIGNMENT_KINDS.has(type)) return false;
  const explicit = loyaltyState.assignments.find((item) => item.kind === type && item.programId === program.id && item.personKey === person);
  if (explicit) return explicit.state === 'assigned';
  return program.audienceMode === 'all' && program.status === 'active';
}

export function getAssignedProgramsForPerson(personKey) {
  const person = text(personKey);
  if (!person) return [];
  const result = [];
  for (const kind of ['referral', 'bonus']) {
    for (const program of loyaltyState[programCollection(kind)]) {
      if (isProgramAssignedToPerson(kind, program.id, person)) result.push(clone(program));
    }
  }
  return result;
}

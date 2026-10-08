import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
type Db = PrismaService | Prisma.TransactionClient;

type BonusLot = {
  operation: JsonObject;
  remaining: number;
  expiresAt: string;
};

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function numberValue(value: unknown) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function positive(value: unknown) {
  return Math.max(0, numberValue(value));
}

function moment(value: unknown) {
  const date = new Date(value as any);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

function id(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function stateParts(value: unknown) {
  const state = clone(objectValue(value));
  state.personalAccounts = Array.isArray(state.personalAccounts) ? state.personalAccounts.map((item: unknown) => clone(objectValue(item))) : [];
  state.accountOperations = Array.isArray(state.accountOperations) ? state.accountOperations.map((item: unknown) => clone(objectValue(item))) : [];
  return state;
}

function ensureAccount(state: JsonObject, personKey: string) {
  const key = text(personKey);
  if (!key) throw new Error('Для бонусной операции отсутствует человек');
  let account = state.personalAccounts.find((item: JsonObject) => text(item.personKey) === key);
  if (account) return account;
  const now = new Date().toISOString();
  account = {
    id: id('loyalty-account'),
    personKey: key,
    moneyBalance: 0,
    bonusBalance: 0,
    createdAt: now,
    updatedAt: now,
  };
  state.personalAccounts.push(account);
  return account;
}

function operationTime(operation: JsonObject) {
  return moment(operation.workingAt || operation.auditAt);
}

function lotExpired(lot: BonusLot, atMs: number) {
  const expires = moment(lot.expiresAt);
  return Boolean(expires && expires <= atMs);
}

function sortedLots(lots: BonusLot[], atMs: number) {
  return lots
    .filter((lot) => lot.remaining > 0.000001 && !lotExpired(lot, atMs))
    .sort((left, right) => {
      const leftExpiry = moment(left.expiresAt);
      const rightExpiry = moment(right.expiresAt);
      if (leftExpiry && rightExpiry && leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;
      if (leftExpiry && !rightExpiry) return -1;
      if (!leftExpiry && rightExpiry) return 1;
      return operationTime(left.operation) - operationTime(right.operation);
    });
}

function allocateDebit(lots: BonusLot[], amount: number, atMs: number) {
  let left = positive(amount);
  const allocations: JsonObject[] = [];
  for (const lot of sortedLots(lots, atMs)) {
    if (left <= 0.000001) break;
    const used = Math.min(left, lot.remaining);
    if (used <= 0) continue;
    lot.remaining = Math.max(0, lot.remaining - used);
    left = Math.max(0, left - used);
    allocations.push({ creditOperationId: text(lot.operation.id), amount: used });
  }
  if (left > 0.000001) throw new Error('Недостаточно доступных бонусов');
  return allocations;
}

function applyExplicitAllocations(lots: BonusLot[], allocations: unknown[], atMs: number) {
  for (const value of Array.isArray(allocations) ? allocations : []) {
    const allocation = objectValue(value);
    const creditOperationId = text(allocation.creditOperationId);
    const amount = positive(allocation.amount);
    if (!creditOperationId || amount <= 0) continue;
    const lot = lots.find((candidate) => text(candidate.operation.id) === creditOperationId);
    if (!lot || lotExpired(lot, atMs) || lot.remaining + 0.000001 < amount) {
      throw new Error('История бонусов содержит некорректное списание');
    }
    lot.remaining = Math.max(0, lot.remaining - amount);
  }
}

function availableBalance(lots: BonusLot[], atMs: number) {
  return sortedLots(lots, atMs).reduce((sum, lot) => sum + lot.remaining, 0);
}

export function reconcileBonusLedger(value: unknown, at: Date = new Date()) {
  const state = stateParts(value);
  const nowMs = at.getTime();
  const accounts = new Map(state.personalAccounts.map((account: JsonObject) => [text(account.id), account]));
  const operations = state.accountOperations
    .filter((operation: JsonObject) => text(operation.nominal) === 'bonus' && text(operation.accountId))
    .sort((left: JsonObject, right: JsonObject) => {
      const working = operationTime(left) - operationTime(right);
      if (working) return working;
      return moment(left.auditAt) - moment(right.auditAt);
    });
  const lotsByAccount = new Map<string, BonusLot[]>();

  for (const operation of operations) {
    const accountId = text(operation.accountId);
    const account = accounts.get(accountId);
    if (!account) continue;
    const lots = lotsByAccount.get(accountId) || [];
    lotsByAccount.set(accountId, lots);
    const atMs = operationTime(operation) || nowMs;
    const direction = text(operation.direction);
    const amount = positive(operation.amount);
    if (direction === 'credit' && amount > 0) {
      lots.push({ operation, remaining: amount, expiresAt: text(operation.expiresAt) });
    } else if (direction === 'debit' && amount > 0) {
      if (Array.isArray(operation.allocations) && operation.allocations.length) {
        applyExplicitAllocations(lots, operation.allocations, atMs);
      } else {
        operation.allocations = allocateDebit(lots, amount, atMs);
      }
    }
    operation.balanceAfter = availableBalance(lots, atMs);
  }

  for (const account of state.personalAccounts) {
    const accountId = text(account.id);
    const lots = lotsByAccount.get(accountId) || [];
    const previous = positive(account.bonusBalance);
    const next = availableBalance(lots, nowMs);
    account.bonusBalance = next;
    if (Math.abs(previous - next) > 0.000001) account.updatedAt = new Date().toISOString();
    for (const lot of lots) lot.operation.remaining = Math.max(0, lot.remaining);
  }
  return state;
}

export async function readLoyaltyState(db: Db, tenantId: string) {
  const row = await db.businessAuxiliaryState.upsert({
    where: { tenantId },
    create: { tenantId, data: json({ loyalty: {} }) },
    update: {},
  });
  const auxiliary = clone(objectValue(row.data));
  const loyalty = reconcileBonusLedger(objectValue(auxiliary.loyalty));
  return { row, auxiliary, loyalty };
}

export async function writeLoyaltyState(db: Db, tenantId: string, auxiliary: JsonObject, loyalty: JsonObject) {
  const next = clone(objectValue(auxiliary));
  next.loyalty = reconcileBonusLedger(loyalty);
  await db.businessAuxiliaryState.update({
    where: { tenantId },
    data: { data: json(next) },
  });
  return clone(next.loyalty);
}

export async function loyaltyBonusBalance(db: Db, tenantId: string, personKey: string, at: Date = new Date()) {
  const { loyalty } = await readLoyaltyState(db, tenantId);
  const account = loyalty.personalAccounts.find((item: JsonObject) => text(item.personKey) === text(personKey));
  return positive(account?.bonusBalance);
}

export async function consumeLoyaltyBonus(db: Db, tenantId: string, {
  personKey,
  amount,
  financeOperationId,
  occurredAt,
}: {
  personKey: string;
  amount: number;
  financeOperationId: string;
  occurredAt: Date;
}) {
  const requested = positive(amount);
  if (requested <= 0) return { amount: 0, balanceAfter: 0, operationId: '', allocations: [] };
  const { auxiliary, loyalty: raw } = await readLoyaltyState(db, tenantId);
  const loyalty = reconcileBonusLedger(raw, occurredAt);
  const account = ensureAccount(loyalty, personKey);
  const lots: BonusLot[] = loyalty.accountOperations
    .filter((operation: JsonObject) => text(operation.accountId) === text(account.id)
      && text(operation.nominal) === 'bonus'
      && text(operation.direction) === 'credit')
    .map((operation: JsonObject) => ({
      operation,
      remaining: positive(operation.remaining == null ? operation.amount : operation.remaining),
      expiresAt: text(operation.expiresAt),
    }));
  const allocations = allocateDebit(lots, requested, occurredAt.getTime());
  const auditAt = new Date().toISOString();
  const operationId = id('loyalty-payment');
  loyalty.accountOperations.push({
    id: operationId,
    accountId: account.id,
    nominal: 'bonus',
    direction: 'debit',
    amount: requested,
    sourceType: 'payment',
    sourceId: financeOperationId,
    financeOperationId,
    workingAt: occurredAt.toISOString(),
    auditAt,
    expiresAt: '',
    allocations,
    balanceAfter: 0,
  });
  const next = reconcileBonusLedger(loyalty);
  const nextAccount = next.personalAccounts.find((item: JsonObject) => text(item.id) === text(account.id));
  await writeLoyaltyState(db, tenantId, auxiliary, next);
  return {
    amount: requested,
    balanceAfter: positive(nextAccount?.bonusBalance),
    operationId,
    allocations: clone(allocations),
  };
}

export async function restoreLoyaltyBonus(db: Db, tenantId: string, {
  originalFinanceOperationId,
  amount,
  sourceType,
  sourceId,
  occurredAt,
}: {
  originalFinanceOperationId: string;
  amount: number | null;
  sourceType: string;
  sourceId: string;
  occurredAt: Date;
}) {
  const originalId = text(originalFinanceOperationId);
  if (!originalId) return { amount: 0 };
  const { auxiliary, loyalty: raw } = await readLoyaltyState(db, tenantId);
  const loyalty = reconcileBonusLedger(raw);
  const debit = loyalty.accountOperations.find((operation: JsonObject) => text(operation.nominal) === 'bonus'
    && text(operation.direction) === 'debit'
    && text(operation.sourceType) === 'payment'
    && text(operation.sourceId) === originalId);
  if (!debit) return { amount: 0 };
  const priorRestores = loyalty.accountOperations
    .filter((operation: JsonObject) => text(operation.nominal) === 'bonus'
      && text(operation.direction) === 'credit'
      && text(operation.reversalOf) === text(debit.id))
    .reduce((sum: number, operation: JsonObject) => sum + positive(operation.amount), 0);
  const restorable = Math.max(0, positive(debit.amount) - priorRestores);
  const requested = amount == null ? restorable : Math.min(restorable, positive(amount));
  if (requested <= 0.000001) return { amount: 0 };

  const credits = new Map(loyalty.accountOperations
    .filter((operation: JsonObject) => text(operation.nominal) === 'bonus' && text(operation.direction) === 'credit')
    .map((operation: JsonObject) => [text(operation.id), operation]));
  let left = requested;
  const restored: JsonObject[] = [];
  for (const value of Array.isArray(debit.allocations) ? debit.allocations : []) {
    if (left <= 0.000001) break;
    const allocation = objectValue(value);
    const sourceCredit = credits.get(text(allocation.creditOperationId));
    if (!sourceCredit) continue;
    const alreadyForCredit = loyalty.accountOperations
      .filter((operation: JsonObject) => text(operation.reversalOf) === text(debit.id)
        && text(operation.restoredFrom) === text(sourceCredit.id))
      .reduce((sum: number, operation: JsonObject) => sum + positive(operation.amount), 0);
    const available = Math.max(0, positive(allocation.amount) - alreadyForCredit);
    const piece = Math.min(left, available);
    if (piece <= 0) continue;
    const operation = {
      id: id('loyalty-restore'),
      accountId: text(debit.accountId),
      nominal: 'bonus',
      direction: 'credit',
      amount: piece,
      sourceType: text(sourceType) || 'payment-reversal',
      sourceId: text(sourceId),
      financeOperationId: text(sourceId),
      workingAt: occurredAt.toISOString(),
      auditAt: new Date().toISOString(),
      expiresAt: text(sourceCredit.expiresAt),
      reversalOf: text(debit.id),
      restoredFrom: text(sourceCredit.id),
      balanceAfter: 0,
    };
    loyalty.accountOperations.push(operation);
    restored.push(operation);
    left = Math.max(0, left - piece);
  }
  if (left > 0.000001) {
    loyalty.accountOperations.push({
      id: id('loyalty-restore'),
      accountId: text(debit.accountId),
      nominal: 'bonus',
      direction: 'credit',
      amount: left,
      sourceType: text(sourceType) || 'payment-reversal',
      sourceId: text(sourceId),
      financeOperationId: text(sourceId),
      workingAt: occurredAt.toISOString(),
      auditAt: new Date().toISOString(),
      expiresAt: '',
      reversalOf: text(debit.id),
      restoredFrom: '',
      balanceAfter: 0,
    });
  }
  const next = reconcileBonusLedger(loyalty);
  await writeLoyaltyState(db, tenantId, auxiliary, next);
  return { amount: requested, operations: restored };
}

export async function removeLoyaltyFinanceOperations(db: Db, tenantId: string, financeOperationIds: string[]) {
  const ids = new Set((Array.isArray(financeOperationIds) ? financeOperationIds : []).map(text).filter(Boolean));
  if (!ids.size) return { removed: 0 };
  const { auxiliary, loyalty: raw } = await readLoyaltyState(db, tenantId);
  const loyalty = stateParts(raw);
  const before = loyalty.accountOperations.length;
  loyalty.accountOperations = loyalty.accountOperations.filter((operation: JsonObject) => {
    const financeId = text(operation.financeOperationId);
    const sourceId = text(operation.sourceId);
    return !ids.has(financeId) && !ids.has(sourceId);
  });
  const removed = before - loyalty.accountOperations.length;
  if (removed) await writeLoyaltyState(db, tenantId, auxiliary, loyalty);
  return { removed };
}

export async function loyaltyForPerson(db: Db, tenantId: string, personKeys: string[]) {
  const keys = new Set((Array.isArray(personKeys) ? personKeys : []).map(text).filter(Boolean));
  const { loyalty: raw } = await readLoyaltyState(db, tenantId);
  const loyalty = reconcileBonusLedger(raw);
  const accounts = loyalty.personalAccounts.filter((account: JsonObject) => keys.has(text(account.personKey)));
  const accountIds = new Set(accounts.map((account: JsonObject) => text(account.id)));
  const assignments = (Array.isArray(loyalty.assignments) ? loyalty.assignments : [])
    .filter((assignment: JsonObject) => keys.has(text(assignment.personKey)));
  const instances = ['deposits', 'certificates', 'subscriptions'].flatMap((collection) =>
    (Array.isArray(loyalty[collection]) ? loyalty[collection] : [])
      .filter((item: JsonObject) => keys.has(text(item.personKey))));
  const programs = ['referralPrograms', 'bonusPrograms'].flatMap((collection) => Array.isArray(loyalty[collection]) ? loyalty[collection] : []);
  const visiblePrograms = programs.filter((program: JsonObject) => {
    const kind = text(program.kind);
    return [...keys].some((personKey) => {
      const explicit = assignments.find((assignment: JsonObject) => text(assignment.kind) === kind
        && text(assignment.programId) === text(program.id)
        && text(assignment.personKey) === personKey);
      if (explicit) return text(explicit.state) === 'assigned';
      return text(program.audienceMode) === 'all' && text(program.status) === 'active';
    });
  });
  return {
    accounts: clone(accounts),
    operations: clone(loyalty.accountOperations.filter((operation: JsonObject) => accountIds.has(text(operation.accountId)))),
    assignments: clone(assignments),
    instances: clone(instances),
    programs: clone(visiblePrograms),
  };
}

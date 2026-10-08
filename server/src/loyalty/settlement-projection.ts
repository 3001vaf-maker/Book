import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import {
  consumeLoyaltyBonus,
  readLoyaltyState,
  reconcileBonusLedger,
  restoreLoyaltyBonus,
  writeLoyaltyState,
} from './bonus-ledger';

type JsonObject = Record<string, any>;
type Db = PrismaService | Prisma.TransactionClient;

export type SettlementMovement = {
  movementId: string;
  nominal: 'money' | 'bonus';
  sourceType: 'wallet' | 'deposit' | 'personal-account';
  sourceId: string;
  sourceName: string;
  amount: number;
  loyaltyOperationId?: string;
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
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function amountValue(value: unknown) {
  return Math.round(Math.max(0, numberValue(value)) * 100) / 100;
}

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

function uid(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function ensureArrays(loyalty: JsonObject) {
  loyalty.personalAccounts = Array.isArray(loyalty.personalAccounts) ? loyalty.personalAccounts : [];
  loyalty.accountOperations = Array.isArray(loyalty.accountOperations) ? loyalty.accountOperations : [];
  loyalty.deposits = Array.isArray(loyalty.deposits) ? loyalty.deposits : [];
  loyalty.depositOperations = Array.isArray(loyalty.depositOperations) ? loyalty.depositOperations : [];
  return loyalty;
}

function accountFor(loyalty: JsonObject, accountId: string, personKey: string) {
  return loyalty.personalAccounts.find((item: JsonObject) => text(item.id) === accountId
    && (!personKey || text(item.personKey) === personKey)) || null;
}

function depositFor(loyalty: JsonObject, depositId: string, personKey: string) {
  return loyalty.deposits.find((item: JsonObject) => text(item.id) === depositId
    && (!personKey || text(item.personKey) === personKey)) || null;
}

function moneyAccountBalance(loyalty: JsonObject, accountId: string) {
  return amountValue(loyalty.accountOperations
    .filter((operation: JsonObject) => text(operation.accountId) === accountId && text(operation.nominal) === 'money')
    .reduce((sum: number, operation: JsonObject) => {
      const amount = amountValue(operation.amount);
      return sum + (text(operation.direction) === 'debit' ? -amount : amount);
    }, 0));
}

function depositBalance(loyalty: JsonObject, deposit: JsonObject) {
  const depositId = text(deposit.id);
  const base = amountValue(deposit.amount);
  const delta = loyalty.depositOperations
    .filter((operation: JsonObject) => text(operation.depositId) === depositId)
    .reduce((sum: number, operation: JsonObject) => {
      const amount = amountValue(operation.amount);
      return sum + (text(operation.direction) === 'debit' ? -amount : amount);
    }, 0);
  return Math.max(0, amountValue(base + delta));
}

function reconcileMoneyAndDeposits(value: unknown) {
  const loyalty = ensureArrays(clone(objectValue(value)));
  for (const account of loyalty.personalAccounts) {
    const accountId = text(account.id);
    if (!accountId) continue;
    const hasMoneyHistory = loyalty.accountOperations.some((operation: JsonObject) => text(operation.accountId) === accountId
      && text(operation.nominal) === 'money');
    if (hasMoneyHistory) account.moneyBalance = moneyAccountBalance(loyalty, accountId);
  }
  for (const deposit of loyalty.deposits) {
    const depositId = text(deposit.id);
    if (!depositId) continue;
    const hasHistory = loyalty.depositOperations.some((operation: JsonObject) => text(operation.depositId) === depositId);
    if (hasHistory) deposit.remaining = depositBalance(loyalty, deposit);
  }
  return reconcileBonusLedger(loyalty);
}

function mergeById(requested: unknown[], current: unknown[], protectedPredicate: (value: JsonObject) => boolean) {
  const result = new Map<string, JsonObject>();
  for (const value of Array.isArray(requested) ? requested : []) {
    const item = clone(objectValue(value));
    const id = text(item.id);
    if (id) result.set(id, item);
  }
  for (const value of Array.isArray(current) ? current : []) {
    const item = clone(objectValue(value));
    const id = text(item.id);
    if (!id || !protectedPredicate(item)) continue;
    result.set(id, item);
  }
  return [...result.values()];
}

export function mergeClientLoyaltyState(currentValue: unknown, requestedValue: unknown) {
  const current = ensureArrays(clone(objectValue(currentValue)));
  const requested = ensureArrays(clone(objectValue(requestedValue)));

  requested.accountOperations = mergeById(
    requested.accountOperations,
    current.accountOperations,
    (operation) => Boolean(text(operation.financeOperationId)),
  );
  requested.depositOperations = mergeById(
    requested.depositOperations,
    current.depositOperations,
    (operation) => Boolean(text(operation.financeOperationId)),
  );

  const protectedAccountIds = new Set(requested.accountOperations
    .filter((operation: JsonObject) => text(operation.financeOperationId))
    .map((operation: JsonObject) => text(operation.accountId))
    .filter(Boolean));
  requested.personalAccounts = mergeById(
    requested.personalAccounts,
    current.personalAccounts,
    (account) => protectedAccountIds.has(text(account.id)),
  );

  const protectedDepositIds = new Set(requested.depositOperations
    .filter((operation: JsonObject) => text(operation.financeOperationId))
    .map((operation: JsonObject) => text(operation.depositId))
    .filter(Boolean));
  requested.deposits = mergeById(
    requested.deposits,
    current.deposits,
    (deposit) => protectedDepositIds.has(text(deposit.id)),
  );

  return reconcileMoneyAndDeposits(requested);
}

export async function settlementSourcesForPerson(db: Db, tenantId: string, personKeyValue: string) {
  const personKey = text(personKeyValue);
  if (!personKey) return { account: null, deposits: [] };
  const { loyalty: raw } = await readLoyaltyState(db, tenantId);
  const loyalty = reconcileMoneyAndDeposits(raw);
  const account = loyalty.personalAccounts.find((item: JsonObject) => text(item.personKey) === personKey) || null;
  const deposits = loyalty.deposits.filter((item: JsonObject) => text(item.personKey) === personKey
    && !['completed', 'cancelled', 'expired'].includes(text(item.status))
    && amountValue(item.remaining) > 0);
  return {
    account: account ? clone(account) : null,
    deposits: clone(deposits),
  };
}

async function consumePersonalAccountMoney(
  db: Db,
  tenantId: string,
  movement: SettlementMovement,
  personKey: string,
  financeOperationId: string,
  occurredAt: Date,
) {
  const { auxiliary, loyalty: raw } = await readLoyaltyState(db, tenantId);
  const loyalty = ensureArrays(reconcileMoneyAndDeposits(raw));
  const account = accountFor(loyalty, text(movement.sourceId), personKey);
  if (!account) throw new Error('Личный счёт не найден');
  const available = amountValue(account.moneyBalance);
  const requested = amountValue(movement.amount);
  if (requested <= 0 || requested > available + 0.009) throw new Error('Недостаточно денег на Личном счёте');
  const operationId = uid('loyalty-money-payment');
  const nextBalance = amountValue(available - requested);
  loyalty.accountOperations.push({
    id: operationId,
    accountId: text(account.id),
    nominal: 'money',
    direction: 'debit',
    amount: requested,
    sourceType: 'settlement',
    sourceId: financeOperationId,
    financeOperationId,
    workingAt: occurredAt.toISOString(),
    auditAt: new Date().toISOString(),
    expiresAt: '',
    balanceAfter: nextBalance,
  });
  account.moneyBalance = nextBalance;
  account.updatedAt = new Date().toISOString();
  await writeLoyaltyState(db, tenantId, auxiliary, loyalty);
  return { ...movement, amount: requested, sourceName: movement.sourceName || 'Личный счёт', loyaltyOperationId: operationId };
}

async function consumeDeposit(
  db: Db,
  tenantId: string,
  movement: SettlementMovement,
  personKey: string,
  financeOperationId: string,
  occurredAt: Date,
) {
  const { auxiliary, loyalty: raw } = await readLoyaltyState(db, tenantId);
  const loyalty = ensureArrays(reconcileMoneyAndDeposits(raw));
  const deposit = depositFor(loyalty, text(movement.sourceId), personKey);
  if (!deposit) throw new Error('Депозит не найден');
  const available = amountValue(deposit.remaining);
  const requested = amountValue(movement.amount);
  if (requested <= 0 || requested > available + 0.009) throw new Error('Недостаточно средств депозита');
  const operationId = uid('loyalty-deposit-payment');
  loyalty.depositOperations.push({
    id: operationId,
    depositId: text(deposit.id),
    nominal: 'money',
    direction: 'debit',
    amount: requested,
    sourceType: 'settlement',
    sourceId: financeOperationId,
    financeOperationId,
    workingAt: occurredAt.toISOString(),
    auditAt: new Date().toISOString(),
    balanceAfter: amountValue(available - requested),
  });
  deposit.remaining = amountValue(available - requested);
  await writeLoyaltyState(db, tenantId, auxiliary, loyalty);
  return { ...movement, amount: requested, sourceName: movement.sourceName || 'Депозит', loyaltyOperationId: operationId };
}

export async function applyLoyaltySettlementMovements(
  db: Db,
  tenantId: string,
  movements: SettlementMovement[],
  {
    personKey: personKeyValue,
    financeOperationId,
    occurredAt,
  }: { personKey: string; financeOperationId: string; occurredAt: Date },
) {
  const personKey = text(personKeyValue);
  const result: SettlementMovement[] = [];
  for (const input of Array.isArray(movements) ? movements : []) {
    const movement: SettlementMovement = {
      movementId: text(input.movementId) || uid('settlement-movement'),
      nominal: input.nominal === 'bonus' ? 'bonus' : 'money',
      sourceType: input.sourceType,
      sourceId: text(input.sourceId),
      sourceName: text(input.sourceName),
      amount: amountValue(input.amount),
    };
    if (movement.amount <= 0) continue;
    if (movement.sourceType === 'wallet') {
      result.push(movement);
      continue;
    }
    if (!personKey) throw new Error('Для использования Лояльности выберите человека');
    if (movement.sourceType === 'personal-account' && movement.nominal === 'bonus') {
      const sources = await settlementSourcesForPerson(db, tenantId, personKey);
      if (!sources.account || text(sources.account.id) !== movement.sourceId) throw new Error('Личный счёт не найден');
      const applied = await consumeLoyaltyBonus(db, tenantId, {
        personKey,
        amount: movement.amount,
        financeOperationId,
        occurredAt,
      });
      result.push({
        ...movement,
        sourceName: movement.sourceName || 'Личный счёт · Бонусы',
        amount: amountValue(applied.amount),
        loyaltyOperationId: text(applied.operationId),
      });
      continue;
    }
    if (movement.sourceType === 'personal-account' && movement.nominal === 'money') {
      result.push(await consumePersonalAccountMoney(db, tenantId, movement, personKey, financeOperationId, occurredAt));
      continue;
    }
    if (movement.sourceType === 'deposit' && movement.nominal === 'money') {
      result.push(await consumeDeposit(db, tenantId, movement, personKey, financeOperationId, occurredAt));
      continue;
    }
    throw new Error('Некорректный источник погашения');
  }
  return result;
}

async function restorePersonalAccountMoney(
  db: Db,
  tenantId: string,
  originalFinanceOperationId: string,
  movement: SettlementMovement,
  reversalFinanceOperationId: string,
  occurredAt: Date,
) {
  const { auxiliary, loyalty: raw } = await readLoyaltyState(db, tenantId);
  const loyalty = ensureArrays(reconcileMoneyAndDeposits(raw));
  const debit = loyalty.accountOperations.find((operation: JsonObject) => text(operation.financeOperationId) === originalFinanceOperationId
    && text(operation.accountId) === text(movement.sourceId)
    && text(operation.nominal) === 'money'
    && text(operation.direction) === 'debit');
  if (!debit) return null;
  const already = loyalty.accountOperations
    .filter((operation: JsonObject) => text(operation.reversalOf) === text(debit.id))
    .reduce((sum: number, operation: JsonObject) => sum + amountValue(operation.amount), 0);
  const available = Math.max(0, amountValue(debit.amount) - already);
  const restored = Math.min(available, amountValue(movement.amount));
  if (restored <= 0) return null;
  const account = accountFor(loyalty, text(debit.accountId), '');
  if (!account) throw new Error('Личный счёт не найден');
  const operationId = uid('loyalty-money-restore');
  account.moneyBalance = amountValue(amountValue(account.moneyBalance) + restored);
  account.updatedAt = new Date().toISOString();
  loyalty.accountOperations.push({
    id: operationId,
    accountId: text(account.id),
    nominal: 'money',
    direction: 'credit',
    amount: restored,
    sourceType: 'settlement-reversal',
    sourceId: reversalFinanceOperationId,
    financeOperationId: reversalFinanceOperationId,
    workingAt: occurredAt.toISOString(),
    auditAt: new Date().toISOString(),
    reversalOf: text(debit.id),
    balanceAfter: account.moneyBalance,
  });
  await writeLoyaltyState(db, tenantId, auxiliary, loyalty);
  return { ...movement, amount: restored, loyaltyOperationId: operationId };
}

async function restoreDeposit(
  db: Db,
  tenantId: string,
  originalFinanceOperationId: string,
  movement: SettlementMovement,
  reversalFinanceOperationId: string,
  occurredAt: Date,
) {
  const { auxiliary, loyalty: raw } = await readLoyaltyState(db, tenantId);
  const loyalty = ensureArrays(reconcileMoneyAndDeposits(raw));
  const debit = loyalty.depositOperations.find((operation: JsonObject) => text(operation.financeOperationId) === originalFinanceOperationId
    && text(operation.depositId) === text(movement.sourceId)
    && text(operation.direction) === 'debit');
  if (!debit) return null;
  const already = loyalty.depositOperations
    .filter((operation: JsonObject) => text(operation.reversalOf) === text(debit.id))
    .reduce((sum: number, operation: JsonObject) => sum + amountValue(operation.amount), 0);
  const available = Math.max(0, amountValue(debit.amount) - already);
  const restored = Math.min(available, amountValue(movement.amount));
  if (restored <= 0) return null;
  const deposit = depositFor(loyalty, text(debit.depositId), '');
  if (!deposit) throw new Error('Депозит не найден');
  const operationId = uid('loyalty-deposit-restore');
  deposit.remaining = amountValue(amountValue(deposit.remaining) + restored);
  loyalty.depositOperations.push({
    id: operationId,
    depositId: text(deposit.id),
    nominal: 'money',
    direction: 'credit',
    amount: restored,
    sourceType: 'settlement-reversal',
    sourceId: reversalFinanceOperationId,
    financeOperationId: reversalFinanceOperationId,
    workingAt: occurredAt.toISOString(),
    auditAt: new Date().toISOString(),
    reversalOf: text(debit.id),
    balanceAfter: deposit.remaining,
  });
  await writeLoyaltyState(db, tenantId, auxiliary, loyalty);
  return { ...movement, amount: restored, loyaltyOperationId: operationId };
}

export async function restoreLoyaltySettlementMovements(
  db: Db,
  tenantId: string,
  originalFinanceOperationId: string,
  movements: SettlementMovement[],
  {
    reversalFinanceOperationId,
    occurredAt,
  }: { reversalFinanceOperationId: string; occurredAt: Date },
) {
  const restored: SettlementMovement[] = [];
  for (const movement of Array.isArray(movements) ? movements : []) {
    if (movement.sourceType === 'wallet') continue;
    if (movement.sourceType === 'personal-account' && movement.nominal === 'bonus') {
      const result = await restoreLoyaltyBonus(db, tenantId, {
        originalFinanceOperationId,
        amount: amountValue(movement.amount),
        sourceType: 'settlement-reversal',
        sourceId: reversalFinanceOperationId,
        occurredAt,
      });
      if (amountValue(result.amount) > 0) restored.push({ ...movement, amount: amountValue(result.amount) });
      continue;
    }
    if (movement.sourceType === 'personal-account' && movement.nominal === 'money') {
      const result = await restorePersonalAccountMoney(db, tenantId, originalFinanceOperationId, movement, reversalFinanceOperationId, occurredAt);
      if (result) restored.push(result);
      continue;
    }
    if (movement.sourceType === 'deposit' && movement.nominal === 'money') {
      const result = await restoreDeposit(db, tenantId, originalFinanceOperationId, movement, reversalFinanceOperationId, occurredAt);
      if (result) restored.push(result);
    }
  }
  return restored;
}

export async function removeLoyaltySettlementEffects(db: Db, tenantId: string, financeOperationIds: string[]) {
  const ids = new Set((Array.isArray(financeOperationIds) ? financeOperationIds : []).map(text).filter(Boolean));
  if (!ids.size) return { removed: 0 };
  const { auxiliary, loyalty: raw } = await readLoyaltyState(db, tenantId);
  const loyalty = ensureArrays(clone(objectValue(raw)));
  const beforeAccounts = loyalty.accountOperations.length;
  const beforeDeposits = loyalty.depositOperations.length;
  loyalty.accountOperations = loyalty.accountOperations.filter((operation: JsonObject) => !ids.has(text(operation.financeOperationId)));
  loyalty.depositOperations = loyalty.depositOperations.filter((operation: JsonObject) => !ids.has(text(operation.financeOperationId)));
  const next = reconcileMoneyAndDeposits(loyalty);
  await writeLoyaltyState(db, tenantId, auxiliary, next);
  return { removed: (beforeAccounts - next.accountOperations.length) + (beforeDeposits - next.depositOperations.length) };
}

export function normalizeSettlementMovement(value: unknown): SettlementMovement | null {
  const source = objectValue(value);
  const nominal = text(source.nominal) === 'bonus' ? 'bonus' : 'money';
  const sourceType = text(source.sourceType);
  if (!['wallet', 'deposit', 'personal-account'].includes(sourceType)) return null;
  const sourceId = text(source.sourceId);
  const amount = amountValue(source.amount);
  if (!sourceId || amount <= 0) return null;
  return {
    movementId: text(source.movementId) || uid('settlement-movement'),
    nominal,
    sourceType: sourceType as SettlementMovement['sourceType'],
    sourceId,
    sourceName: text(source.sourceName),
    amount,
    loyaltyOperationId: text(source.loyaltyOperationId),
  };
}

export function normalizeSettlementMovements(value: unknown) {
  return (Array.isArray(value) ? value : []).map(normalizeSettlementMovement).filter(Boolean) as SettlementMovement[];
}

export function settlementMovementTotal(value: unknown) {
  return amountValue(normalizeSettlementMovements(value).reduce((sum, movement) => sum + movement.amount, 0));
}

export function loyaltyStateJson(value: unknown) {
  return json(reconcileMoneyAndDeposits(value));
}

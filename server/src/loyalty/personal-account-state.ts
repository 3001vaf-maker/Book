import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';

type Db = PrismaService | Prisma.TransactionClient;
type JsonObject = Record<string, any>;

type AccountRow = {
  id: string;
  tenantId: string;
  personKey: string;
  balance: unknown;
  spendLimitPercent: unknown;
  visibleToEndUser: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type MovementRow = {
  id: string;
  kind: string;
  direction: 'IN' | 'OUT';
  amount: unknown;
  sourceType: string;
  sourceId: string;
  occurredAt: Date;
  recordedAt: Date;
  balanceAfter: unknown;
  data: unknown;
};

type DebtRow = {
  id: string;
  tenantId: string;
  personKey: string;
  sourceType: string;
  sourceId: string;
  originalAmount: unknown;
  outstandingAmount: unknown;
  occurredAt: Date;
  closedAt: Date | null;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type PersonalAccountIdentity = {
  requestedKey: string;
  primaryKey: string;
  uei: string;
  memberKeys: string[];
  primaryPerson: JsonObject;
};

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function numberValue(value: unknown) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

export function personalAccountMoney(value: unknown) {
  return Math.round(Math.max(0, numberValue(value)) * 100) / 100;
}

function percent(value: unknown, fallback = 100) {
  const raw = value == null || value === '' ? fallback : numberValue(value);
  return Math.max(0, Math.min(100, Math.round(raw * 100) / 100));
}

export async function resolvePersonalAccountIdentity(db: Db, tenantId: string, personKeyValue: unknown): Promise<PersonalAccountIdentity> {
  const requestedKey = text(personKeyValue);
  if (!requestedKey) throw new BadRequestException('Человек не выбран');
  const [rows, identityRow] = await Promise.all([
    db.person.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    db.ueiState.findUnique({ where: { tenantId } }),
  ]);
  const people = rows.map((row) => ({ row, person: objectValue(row.data) }));
  const matched = people.find(({ row, person }) => text(person.key || row.key) === requestedKey);
  if (!matched) throw new BadRequestException('Человек не найден');

  const identity = objectValue(identityRow?.data);
  const relations = objectValue(identity.relations);
  const entities = objectValue(identity.entities);
  const uei = text(relations[`person:${requestedKey}`]);
  const entity = uei ? objectValue(entities[uei]) : {};
  const memberKeys = uei
    ? [...new Set(arrayValue(entity.members)
      .map((value) => text(value))
      .filter((value) => value.startsWith('person:'))
      .map((value) => value.slice(7))
      .filter(Boolean))]
    : [requestedKey];
  if (!memberKeys.includes(requestedKey)) memberKeys.push(requestedKey);

  const owner = objectValue(entity.owner);
  const ownerKey = text(owner.type) === 'person' ? text(owner.id) : '';
  const primary = people.find(({ row, person }) => text(person.key || row.key) === ownerKey)
    || people.find(({ row, person }) => memberKeys.includes(text(person.key || row.key)))
    || matched;
  const primaryKey = text(primary.person.key || primary.row.key) || requestedKey;
  if (!memberKeys.includes(primaryKey)) memberKeys.unshift(primaryKey);

  return {
    requestedKey,
    primaryKey,
    uei,
    memberKeys: [...new Set(memberKeys)],
    primaryPerson: clone(primary.person),
  };
}

async function accountRow(db: Db, tenantId: string, personKey: string, lock = false) {
  const rows = lock
    ? await db.$queryRaw<AccountRow[]>`SELECT * FROM "LoyaltyPersonalAccount" WHERE "tenantId" = ${tenantId} AND "personKey" = ${personKey} FOR UPDATE`
    : await db.$queryRaw<AccountRow[]>`SELECT * FROM "LoyaltyPersonalAccount" WHERE "tenantId" = ${tenantId} AND "personKey" = ${personKey}`;
  return rows[0] || null;
}

async function insertAccountIfMissing(db: Db, tenantId: string, personKey: string) {
  await db.$executeRaw`
    INSERT INTO "LoyaltyPersonalAccount" ("id", "tenantId", "personKey", "balance", "spendLimitPercent", "visibleToEndUser", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${tenantId}, ${personKey}, 0, 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("tenantId", "personKey") DO NOTHING
  `;
}

async function canonicalAccount(db: Db, tenantId: string, personKeyValue: unknown, lock = false) {
  const identity = await resolvePersonalAccountIdentity(db, tenantId, personKeyValue);
  await insertAccountIfMissing(db, tenantId, identity.primaryKey);
  let primary = await accountRow(db, tenantId, identity.primaryKey, true);
  if (!primary) throw new NotFoundException('Личный счёт не найден');

  for (const memberKey of identity.memberKeys) {
    if (!memberKey || memberKey === identity.primaryKey) continue;
    const secondary = await accountRow(db, tenantId, memberKey, true);
    if (!secondary) continue;
    const mergedBalance = personalAccountMoney(personalAccountMoney(primary.balance) + personalAccountMoney(secondary.balance));
    await db.$executeRaw`
      UPDATE "LoyaltyPersonalAccountMovement"
      SET "personKey" = ${identity.primaryKey}
      WHERE "tenantId" = ${tenantId} AND "personKey" = ${memberKey}
    `;
    await db.$executeRaw`
      UPDATE "LoyaltyPersonalAccountDebt"
      SET "personKey" = ${identity.primaryKey}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "tenantId" = ${tenantId} AND "personKey" = ${memberKey}
    `;
    await db.$executeRaw`
      UPDATE "LoyaltyPersonalAccount"
      SET "balance" = ${mergedBalance}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${primary.id}
    `;
    await db.$executeRaw`DELETE FROM "LoyaltyPersonalAccount" WHERE "id" = ${secondary.id}`;
    primary = { ...primary, balance: mergedBalance, updatedAt: new Date() };
  }

  return { identity, account: lock ? primary : (await accountRow(db, tenantId, identity.primaryKey)) || primary };
}

function accountDto(row: AccountRow) {
  return {
    personKey: row.personKey,
    balance: personalAccountMoney(row.balance),
    spendLimitPercent: percent(row.spendLimitPercent),
    visibleToEndUser: Boolean(row.visibleToEndUser),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function movementDto(row: MovementRow) {
  return {
    id: row.id,
    kind: row.kind,
    direction: row.direction,
    amount: personalAccountMoney(row.amount),
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    occurredAt: row.occurredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
    balanceAfter: personalAccountMoney(row.balanceAfter),
    data: objectValue(row.data),
  };
}

function debtDto(row: DebtRow) {
  const outstandingAmount = personalAccountMoney(row.outstandingAmount);
  return {
    id: row.id,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    originalAmount: personalAccountMoney(row.originalAmount),
    outstandingAmount,
    occurredAt: row.occurredAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : '',
    status: outstandingAmount <= 0.009 ? 'closed' : 'open',
    data: objectValue(row.data),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function personalAccountSnapshot(db: Db, tenantId: string, personKeyValue: unknown) {
  const { identity, account } = await canonicalAccount(db, tenantId, personKeyValue);
  const personKey = identity.primaryKey;
  const [movements, debts] = await Promise.all([
    db.$queryRaw<MovementRow[]>`
      SELECT "id", "kind", "direction", "amount", "sourceType", "sourceId", "occurredAt", "recordedAt", "balanceAfter", "data"
      FROM "LoyaltyPersonalAccountMovement"
      WHERE "tenantId" = ${tenantId} AND "personKey" = ${personKey}
      ORDER BY "occurredAt" DESC, "recordedAt" DESC
    `,
    db.$queryRaw<DebtRow[]>`
      SELECT * FROM "LoyaltyPersonalAccountDebt"
      WHERE "tenantId" = ${tenantId} AND "personKey" = ${personKey}
      ORDER BY "occurredAt" DESC, "createdAt" DESC
    `,
  ]);
  return {
    ...accountDto(account),
    uei: identity.uei,
    memberKeys: identity.memberKeys,
    debtTotal: personalAccountMoney(debts.reduce((sum, row) => sum + personalAccountMoney(row.outstandingAmount), 0)),
    hasActivity: movements.length > 0 || debts.length > 0,
    movements: movements.map(movementDto),
    debts: debts.map(debtDto),
  };
}

export async function listPersonalAccountsWithActivity(db: Db, tenantId: string) {
  const rows = await db.$queryRaw<AccountRow[]>`
    SELECT account.*
    FROM "LoyaltyPersonalAccount" account
    WHERE account."tenantId" = ${tenantId}
      AND (
        EXISTS (
          SELECT 1 FROM "LoyaltyPersonalAccountMovement" movement
          WHERE movement."tenantId" = account."tenantId" AND movement."personKey" = account."personKey"
        )
        OR EXISTS (
          SELECT 1 FROM "LoyaltyPersonalAccountDebt" debt
          WHERE debt."tenantId" = account."tenantId" AND debt."personKey" = account."personKey"
        )
      )
    ORDER BY account."updatedAt" DESC
  `;
  const seen = new Set<string>();
  const result = [];
  for (const row of rows) {
    try {
      const snapshot = await personalAccountSnapshot(db, tenantId, row.personKey);
      if (!snapshot.hasActivity || seen.has(snapshot.personKey)) continue;
      seen.add(snapshot.personKey);
      result.push(snapshot);
    } catch {
      // Historical money facts stay in Finance even if the profile card was removed.
    }
  }
  return result;
}

export async function updatePersonalAccountSettingsWith(db: Db, tenantId: string, personKeyValue: unknown, value: unknown) {
  const source = objectValue(value);
  const { identity, account } = await canonicalAccount(db, tenantId, personKeyValue, true);
  const spendLimitPercent = source.spendLimitPercent == null ? percent(account.spendLimitPercent) : percent(source.spendLimitPercent);
  const visibleToEndUser = source.visibleToEndUser == null ? Boolean(account.visibleToEndUser) : source.visibleToEndUser !== false;
  await db.$executeRaw`
    UPDATE "LoyaltyPersonalAccount"
    SET "spendLimitPercent" = ${spendLimitPercent}, "visibleToEndUser" = ${visibleToEndUser}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = ${tenantId} AND "personKey" = ${identity.primaryKey}
  `;
  return personalAccountSnapshot(db, tenantId, identity.primaryKey);
}

export async function applyPersonalAccountMovement(db: Db, input: {
  eventId: string;
  tenantId: string;
  personKey: string;
  kind: string;
  direction: 'IN' | 'OUT';
  amount: unknown;
  sourceType: string;
  sourceId: string;
  occurredAt: Date;
  data?: JsonObject;
  chargeTotal?: unknown;
  enforceSpendLimit?: boolean;
}) {
  const eventId = text(input.eventId);
  const tenantId = text(input.tenantId);
  const amount = personalAccountMoney(input.amount);
  if (!eventId || !tenantId || !text(input.personKey) || !text(input.kind) || !text(input.sourceType) || !text(input.sourceId)) {
    throw new BadRequestException('Некорректное движение Личного счёта');
  }
  if (amount <= 0) throw new BadRequestException('Сумма должна быть больше нуля');
  const duplicate = await db.$queryRaw<MovementRow[]>`SELECT * FROM "LoyaltyPersonalAccountMovement" WHERE "id" = ${eventId}`;
  if (duplicate[0]) return movementDto(duplicate[0]);

  const { identity, account } = await canonicalAccount(db, tenantId, input.personKey, true);
  const current = personalAccountMoney(account.balance);
  if (input.direction === 'OUT') {
    if (amount > current + 0.009) throw new BadRequestException('На Личном счёте недостаточно средств');
    if (input.enforceSpendLimit) {
      const allowed = personalAccountMoney(personalAccountMoney(input.chargeTotal) * percent(account.spendLimitPercent) / 100);
      if (amount > allowed + 0.009) throw new BadRequestException(`С Личного счёта можно оплатить не более ${percent(account.spendLimitPercent)}% этой операции`);
    }
  }
  const next = input.direction === 'IN' ? personalAccountMoney(current + amount) : personalAccountMoney(current - amount);
  const payload = JSON.stringify(input.data || {});
  await db.$executeRaw`
    UPDATE "LoyaltyPersonalAccount"
    SET "balance" = ${next}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = ${tenantId} AND "personKey" = ${identity.primaryKey}
  `;
  await db.$executeRaw`
    INSERT INTO "LoyaltyPersonalAccountMovement"
      ("id", "tenantId", "personKey", "kind", "direction", "amount", "sourceType", "sourceId", "occurredAt", "recordedAt", "balanceAfter", "data")
    VALUES
      (${eventId}, ${tenantId}, ${identity.primaryKey}, ${text(input.kind)}, ${input.direction}, ${amount}, ${text(input.sourceType)}, ${text(input.sourceId)}, ${input.occurredAt}, CURRENT_TIMESTAMP, ${next}, ${payload}::jsonb)
  `;
  return { ...movementDto({
    id: eventId,
    kind: text(input.kind),
    direction: input.direction,
    amount,
    sourceType: text(input.sourceType),
    sourceId: text(input.sourceId),
    occurredAt: input.occurredAt,
    recordedAt: new Date(),
    balanceAfter: next,
    data: input.data || {},
  }), personKey: identity.primaryKey };
}

export async function personalAccountSpendAvailability(db: Db, tenantId: string, personKey: unknown, chargeTotal: unknown) {
  const { identity, account } = await canonicalAccount(db, tenantId, personKey);
  const balance = personalAccountMoney(account.balance);
  const limitAmount = personalAccountMoney(personalAccountMoney(chargeTotal) * percent(account.spendLimitPercent) / 100);
  return {
    personKey: identity.primaryKey,
    balance,
    spendLimitPercent: percent(account.spendLimitPercent),
    maxSpend: Math.min(balance, limitAmount),
  };
}

export async function syncPersonalAccountDebt(db: Db, input: {
  tenantId: string;
  personKey: string;
  sourceType: string;
  sourceId: string;
  outstandingAmount: unknown;
  occurredAt: Date;
  data?: JsonObject;
}) {
  const tenantId = text(input.tenantId);
  const sourceType = text(input.sourceType);
  const sourceId = text(input.sourceId);
  const outstandingAmount = personalAccountMoney(input.outstandingAmount);
  if (!tenantId || !text(input.personKey) || !sourceType || !sourceId) throw new BadRequestException('Некорректная задолженность');
  const { identity } = await canonicalAccount(db, tenantId, input.personKey, true);
  const existing = await db.$queryRaw<DebtRow[]>`
    SELECT * FROM "LoyaltyPersonalAccountDebt"
    WHERE "tenantId" = ${tenantId} AND "sourceType" = ${sourceType} AND "sourceId" = ${sourceId}
    FOR UPDATE
  `;
  const current = existing[0] || null;
  const payload = JSON.stringify(input.data || {});
  if (!current) {
    if (outstandingAmount <= 0.009) return null;
    await db.$executeRaw`
      INSERT INTO "LoyaltyPersonalAccountDebt"
        ("id", "tenantId", "personKey", "sourceType", "sourceId", "originalAmount", "outstandingAmount", "occurredAt", "closedAt", "data", "createdAt", "updatedAt")
      VALUES
        (${randomUUID()}, ${tenantId}, ${identity.primaryKey}, ${sourceType}, ${sourceId}, ${outstandingAmount}, ${outstandingAmount}, ${input.occurredAt}, NULL, ${payload}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
  } else {
    const originalAmount = Math.max(personalAccountMoney(current.originalAmount), outstandingAmount);
    const closedAt = outstandingAmount <= 0.009 ? new Date() : null;
    await db.$executeRaw`
      UPDATE "LoyaltyPersonalAccountDebt"
      SET "personKey" = ${identity.primaryKey}, "originalAmount" = ${originalAmount}, "outstandingAmount" = ${outstandingAmount},
          "closedAt" = ${closedAt}, "data" = ${payload}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${current.id}
    `;
  }
  const rows = await db.$queryRaw<DebtRow[]>`
    SELECT * FROM "LoyaltyPersonalAccountDebt"
    WHERE "tenantId" = ${tenantId} AND "sourceType" = ${sourceType} AND "sourceId" = ${sourceId}
  `;
  return rows[0] ? debtDto(rows[0]) : null;
}

export async function personalAccountDebtById(db: Db, tenantIdValue: unknown, debtIdValue: unknown, lock = false) {
  const tenantId = text(tenantIdValue);
  const debtId = text(debtIdValue);
  const rows = lock
    ? await db.$queryRaw<DebtRow[]>`SELECT * FROM "LoyaltyPersonalAccountDebt" WHERE "tenantId" = ${tenantId} AND "id" = ${debtId} FOR UPDATE`
    : await db.$queryRaw<DebtRow[]>`SELECT * FROM "LoyaltyPersonalAccountDebt" WHERE "tenantId" = ${tenantId} AND "id" = ${debtId}`;
  return rows[0] || null;
}

export async function reducePersonalAccountDebt(db: Db, tenantIdValue: unknown, debtIdValue: unknown, paidValue: unknown, closedAt = new Date()) {
  const tenantId = text(tenantIdValue);
  const debtId = text(debtIdValue);
  const paid = personalAccountMoney(paidValue);
  if (paid <= 0) throw new BadRequestException('Сумма погашения должна быть больше нуля');
  const debt = await personalAccountDebtById(db, tenantId, debtId, true);
  if (!debt) throw new NotFoundException('Задолженность не найдена');
  const outstanding = personalAccountMoney(debt.outstandingAmount);
  if (outstanding <= 0.009) throw new BadRequestException('Задолженность уже закрыта');
  if (paid > outstanding + 0.009) throw new BadRequestException('Платёж превышает задолженность');
  const next = personalAccountMoney(outstanding - paid);
  const nextClosedAt = next <= 0.009 ? closedAt : null;
  await db.$executeRaw`
    UPDATE "LoyaltyPersonalAccountDebt"
    SET "outstandingAmount" = ${next}, "closedAt" = ${nextClosedAt}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${debt.id}
  `;
  const rows = await db.$queryRaw<DebtRow[]>`SELECT * FROM "LoyaltyPersonalAccountDebt" WHERE "id" = ${debt.id}`;
  return rows[0] ? debtDto(rows[0]) : null;
}

import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
type Db = PrismaService | Prisma.TransactionClient;

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

function personKeyFromData(value: unknown) {
  const data = objectValue(value);
  const person = objectValue(data.person);
  return text(data.personKey || person.key || person.personKey || person.id);
}

function accountDelta(kind: string, data: JsonObject) {
  if (kind === 'personal-account-funding') return personalAccountMoney(data.amount);
  if (kind === 'personal-account-withdrawal') return -personalAccountMoney(data.amount);
  if (kind === 'payment') return -personalAccountMoney(data.personalAccountAmount);
  if (kind === 'refund') return personalAccountMoney(data.personalAccountRestored);
  return 0;
}

export type PersonalAccountSettings = {
  visibleToEndUser: boolean;
  spendLimitPercent: number;
};

export type PersonalAccountIdentity = {
  requestedKey: string;
  primaryKey: string;
  uei: string;
  memberKeys: string[];
  primaryPerson: JsonObject;
};

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

  return {
    requestedKey,
    primaryKey,
    uei,
    memberKeys,
    primaryPerson: clone(primary.person),
  };
}

export function personalAccountSettingsFromPerson(person: unknown): PersonalAccountSettings {
  const data = objectValue(person);
  const settings = objectValue(data.personalAccount);
  return {
    visibleToEndUser: settings.visibleToEndUser !== false,
    spendLimitPercent: percent(settings.spendLimitPercent, 100),
  };
}

export async function readPersonalAccountSettings(db: Db, tenantId: string, personKey: unknown) {
  const identity = await resolvePersonalAccountIdentity(db, tenantId, personKey);
  return { identity, settings: personalAccountSettingsFromPerson(identity.primaryPerson) };
}

export async function updatePersonalAccountSettingsWith(
  db: Db,
  tenantId: string,
  personKey: unknown,
  value: unknown,
) {
  const identity = await resolvePersonalAccountIdentity(db, tenantId, personKey);
  const source = objectValue(value);
  const current = personalAccountSettingsFromPerson(identity.primaryPerson);
  const settings: PersonalAccountSettings = {
    visibleToEndUser: source.visibleToEndUser == null ? current.visibleToEndUser : source.visibleToEndUser !== false,
    spendLimitPercent: source.spendLimitPercent == null ? current.spendLimitPercent : percent(source.spendLimitPercent, current.spendLimitPercent),
  };
  const row = await db.person.findUnique({ where: { tenantId_key: { tenantId, key: identity.primaryKey } } });
  if (!row) throw new BadRequestException('Человек не найден');
  const person = objectValue(row.data);
  await db.person.update({
    where: { id: row.id },
    data: { data: clone({ ...person, personalAccount: settings }) as Prisma.InputJsonValue },
  });
  return { ...identity, primaryPerson: { ...identity.primaryPerson, personalAccount: settings }, settings };
}

export async function personalAccountOperations(db: Db, tenantId: string, personKey: unknown) {
  const identity = await resolvePersonalAccountIdentity(db, tenantId, personKey);
  const members = new Set(identity.memberKeys);
  const rows = await db.financeOperation.findMany({
    where: {
      tenantId,
      status: 'completed',
      kind: { in: ['personal-account-funding', 'personal-account-withdrawal', 'payment', 'refund'] },
    },
    orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
  });
  return {
    identity,
    operations: rows.filter((row) => members.has(personKeyFromData(row.data)) && Math.abs(accountDelta(row.kind, objectValue(row.data))) > 0.009),
  };
}

export async function personalAccountBalance(db: Db, tenantId: string, personKey: unknown) {
  const { identity, operations } = await personalAccountOperations(db, tenantId, personKey);
  const balance = personalAccountMoney(operations.reduce((sum, row) => sum + accountDelta(row.kind, objectValue(row.data)), 0));
  return { identity, balance, operations };
}

export async function validatePersonalAccountSpend(
  db: Db,
  tenantId: string,
  person: unknown,
  source: { type: string; id: string },
  amountValue: unknown,
  settlementTotalValue: unknown,
) {
  const personData = objectValue(person);
  const key = text(personData.key || personData.personKey || personData.id);
  const amount = personalAccountMoney(amountValue);
  if (amount <= 0) return { amount: 0, balance: 0, limit: 0, remainingLimit: 0, settings: personalAccountSettingsFromPerson({}) };
  const { identity, balance } = await personalAccountBalance(db, tenantId, key);
  if (amount > balance + 0.009) throw new BadRequestException('На Личном счёте недостаточно средств');

  const { settings } = await readPersonalAccountSettings(db, tenantId, identity.primaryKey);
  const settlementTotal = personalAccountMoney(settlementTotalValue);
  const limit = personalAccountMoney(settlementTotal * settings.spendLimitPercent / 100);
  const sourceRows = await db.financeOperation.findMany({
    where: {
      tenantId,
      sourceType: text(source.type),
      sourceId: text(source.id),
      status: 'completed',
      kind: { in: ['payment', 'refund'] },
    },
    select: { kind: true, data: true },
  });
  const used = personalAccountMoney(sourceRows.reduce((sum, row) => {
    const data = objectValue(row.data);
    return sum + (row.kind === 'payment'
      ? personalAccountMoney(data.personalAccountAmount)
      : -personalAccountMoney(data.personalAccountRestored));
  }, 0));
  const remainingLimit = Math.max(0, personalAccountMoney(limit - used));
  if (amount > remainingLimit + 0.009) {
    throw new BadRequestException(`По Личному счёту для этой операции доступно не более ${remainingLimit}`);
  }
  return { amount, balance, limit, remainingLimit, settings, identity };
}

export function personalAccountOperationDelta(kind: string, data: unknown) {
  return accountDelta(kind, objectValue(data));
}

export function personalAccountOperationPersonKey(data: unknown) {
  return personKeyFromData(data);
}

import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { describePriceConditionConflict, resolvePersonPriceCondition } from '../../../core/loyalty/price-condition.js';
import { activeDepositPriceSources, depositPersonKey } from './deposit-state';

type JsonObject = Record<string, any>;
type Db = PrismaService | Prisma.TransactionClient;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

export async function resolvePersonPricePercent(
  db: Db,
  tenantId: string,
  personValue: unknown,
  at = new Date(),
  extraSources: JsonObject[] = [],
) {
  const key = depositPersonKey(personValue);
  const stored = key
    ? await db.person.findUnique({ where: { tenantId_key: { tenantId, key } } })
    : null;
  const person = stored ? objectValue(stored.data) : objectValue(personValue);
  const programSources = key ? await activeDepositPriceSources(db, tenantId, key, at) : [];
  const condition = resolvePersonPriceCondition(person, [...programSources, ...extraSources]);
  if (condition.conflict) {
    throw new BadRequestException(`Процентная скидка задваивается: ${describePriceConditionConflict(condition)}. Оставьте один источник процентного условия.`);
  }
  return condition;
}

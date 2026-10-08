import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
type Db = PrismaService | Prisma.TransactionClient;

type ProgramPercentRow = {
  depositId: string;
  programName: string;
  percent: string | number | Prisma.Decimal;
};

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function percent(value: unknown) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

export async function resolvePersonPricePercent(db: Db, tenantId: string, personValue: unknown, at = new Date()) {
  const supplied = objectValue(personValue);
  const key = text(supplied.key ?? supplied.personKey ?? supplied.id);
  if (!key) return { percent: 0, source: null, sources: [] as JsonObject[] };

  const personRow = await db.person.findUnique({
    where: { tenantId_key: { tenantId, key } },
    select: { data: true },
  });
  const person = objectValue(personRow?.data ?? supplied);
  const personalPercent = percent(person.discountPercent ?? person.discount);

  const programRows = await db.$queryRaw<ProgramPercentRow[]>(Prisma.sql`
    SELECT
      d."depositId" AS "depositId",
      d."programName" AS "programName",
      loyalty_deposit_benefit_rate(COALESCE(d."terms", '{}'::jsonb)) AS "percent"
    FROM "LoyaltyDepositInstance" d
    WHERE d."tenantId" = ${tenantId}
      AND d."personKey" = ${key}
      AND d."status" = 'active'
      AND loyalty_deposit_benefit_mode(COALESCE(d."terms", '{}'::jsonb)) = 'discount'
      AND loyalty_deposit_benefit_rate(COALESCE(d."terms", '{}'::jsonb)) > 0
      AND loyalty_deposit_terms_active(COALESCE(d."terms", '{}'::jsonb), ${at}::timestamp)
    ORDER BY d."fundedAt" ASC
  `);

  const sources: JsonObject[] = [];
  if (personalPercent > 0) sources.push({ type: 'personal', name: 'Личные условия', percent: personalPercent });
  for (const row of programRows) {
    const value = percent(row.percent);
    if (value > 0) sources.push({
      type: 'deposit',
      depositId: text(row.depositId),
      name: text(row.programName) || 'Депозит',
      percent: value,
    });
  }

  if (sources.length > 1) {
    throw new BadRequestException('У контакта одновременно действуют несколько источников процентной скидки. Оставьте один источник и повторите действие.');
  }

  return {
    percent: sources.length ? percent(sources[0].percent) : 0,
    source: sources.length ? { ...sources[0] } : null,
    sources,
  };
}

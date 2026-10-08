import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { FinanceService } from '../finance/finance.service';

type JsonObject = Record<string, any>;

type DepositRow = {
  depositId: string;
  programId: string;
  programName: string;
  personKey: string;
  person: unknown;
  terms: unknown;
  initialAmount: Prisma.Decimal;
  balance: Prisma.Decimal;
  status: string;
  fundedAt: Date;
  fundingOperationId: string;
  createdAt: Date;
  updatedAt: Date;
};

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function money(value: unknown) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? Math.round(Math.max(0, number) * 100) / 100 : 0;
}

function depositAllocations(value: unknown) {
  return arrayValue(value)
    .map((entry) => {
      const row = objectValue(entry);
      return {
        depositId: text(row.depositId ?? row.sourceId ?? row.id),
        amount: money(row.amount),
      };
    })
    .filter((entry) => entry.depositId && entry.amount > 0);
}

function movementEffect(operation: any, depositId: string) {
  if (!operation || operation.status !== 'completed') return 0;
  const data = objectValue(operation.data);
  if (operation.kind === 'deposit-funding' && operation.sourceType === 'deposit' && operation.sourceId === depositId) {
    return money(data.amount ?? data.total);
  }
  if (operation.kind === 'deposit-withdrawal' && operation.sourceType === 'deposit' && operation.sourceId === depositId) {
    return -money(data.amount ?? data.total);
  }
  if (operation.kind === 'payment') {
    return -money(depositAllocations(data.depositAllocations)
      .filter((entry) => entry.depositId === depositId)
      .reduce((sum, entry) => sum + entry.amount, 0));
  }
  if (operation.kind === 'refund') {
    return money(depositAllocations(data.depositAllocations)
      .filter((entry) => entry.depositId === depositId)
      .reduce((sum, entry) => sum + entry.amount, 0));
  }
  return 0;
}

@Injectable()
export class DepositService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  private async rows(tenantId: string, personKey = '') {
    if (personKey) {
      return this.prisma.$queryRaw<DepositRow[]>(Prisma.sql`
        SELECT
          "depositId", "programId", "programName", "personKey", "person", "terms",
          "initialAmount", "balance", "status", "fundedAt", "fundingOperationId", "createdAt", "updatedAt"
        FROM "LoyaltyDepositInstance"
        WHERE "tenantId" = ${tenantId} AND "personKey" = ${personKey}
        ORDER BY "fundedAt" DESC, "createdAt" DESC
      `);
    }
    return this.prisma.$queryRaw<DepositRow[]>(Prisma.sql`
      SELECT
        "depositId", "programId", "programName", "personKey", "person", "terms",
        "initialAmount", "balance", "status", "fundedAt", "fundingOperationId", "createdAt", "updatedAt"
      FROM "LoyaltyDepositInstance"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "fundedAt" DESC, "createdAt" DESC
    `);
  }

  private async operations(tenantId: string) {
    return this.prisma.financeOperation.findMany({
      where: { tenantId, kind: { in: ['deposit-funding', 'deposit-withdrawal', 'payment', 'refund'] } },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  private dto(row: DepositRow, operations: any[]) {
    const depositId = row.depositId;
    return {
      depositId,
      programId: row.programId,
      programName: row.programName,
      person: objectValue(row.person),
      fundedAmount: money(row.initialAmount),
      balance: money(row.balance),
      terms: objectValue(row.terms),
      status: row.status,
      fundedAt: row.fundedAt.toISOString(),
      fundingOperationId: row.fundingOperationId,
      history: operations
        .map((operation) => ({ operation, effect: movementEffect(operation, depositId) }))
        .filter(({ effect }) => Math.abs(effect) > 0.009)
        .map(({ operation, effect }) => ({
          operationId: operation.operationId,
          kind: operation.kind,
          amount: Math.abs(effect),
          direction: effect >= 0 ? 'IN' : 'OUT',
          occurredAt: operation.occurredAt.toISOString(),
          status: operation.status,
          source: { type: operation.sourceType, id: operation.sourceId },
        })),
    };
  }

  async list(tenantId: string, personKey = '') {
    const [rows, operations] = await Promise.all([
      this.rows(tenantId, text(personKey)),
      this.operations(tenantId),
    ]);
    return rows.map((row) => this.dto(row, operations));
  }

  async get(tenantId: string, depositId: string) {
    const id = text(depositId);
    const rows = await this.prisma.$queryRaw<DepositRow[]>(Prisma.sql`
      SELECT
        "depositId", "programId", "programName", "personKey", "person", "terms",
        "initialAmount", "balance", "status", "fundedAt", "fundingOperationId", "createdAt", "updatedAt"
      FROM "LoyaltyDepositInstance"
      WHERE "tenantId" = ${tenantId} AND "depositId" = ${id}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) throw new NotFoundException('Депозит не найден');
    return this.dto(row, await this.operations(tenantId));
  }

  async fund(tenantId: string, body: unknown) {
    const result = await this.finance.recordDepositFunding(tenantId, body);
    const depositId = text(objectValue(result).depositId);
    if (!depositId) throw new NotFoundException('Созданный депозит не найден');
    return this.get(tenantId, depositId);
  }

  async withdraw(tenantId: string, depositId: string, body: unknown) {
    await this.finance.recordDepositWithdrawal(tenantId, depositId, body);
    return this.get(tenantId, depositId);
  }
}

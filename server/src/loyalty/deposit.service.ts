import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { FinanceService } from '../finance/finance.service';
import {
  depositBenefitMode,
  depositBenefitRate,
  depositTermActiveAt,
  expireDepositInstances,
} from './deposit-state';

type JsonObject = Record<string, any>;
type DepositRow = {
  depositId: string;
  programId: string;
  programName: string;
  personKey: string;
  person: unknown;
  terms: unknown;
  initialAmount: Prisma.Decimal;
  principalBalance: Prisma.Decimal;
  benefitBalance: Prisma.Decimal;
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

function money(value: unknown) {
  return Math.round(Math.max(0, numberValue(value)) * 100) / 100;
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

function allocationFor(value: unknown, depositId: string) {
  return money(depositAllocations(value)
    .filter((entry) => entry.depositId === depositId)
    .reduce((sum, entry) => sum + entry.amount, 0));
}

@Injectable()
export class DepositService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  private async rows(tenantId: string, personKeyValue = '') {
    await expireDepositInstances(this.prisma, tenantId);
    return this.prisma.loyaltyDepositInstance.findMany({
      where: { tenantId, ...(personKeyValue ? { personKey: personKeyValue } : {}) },
      orderBy: [{ fundedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async operations(tenantId: string) {
    return this.prisma.financeOperation.findMany({
      where: { tenantId, kind: { in: ['deposit-funding', 'deposit-withdrawal', 'payment', 'refund'] } },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  private history(row: DepositRow, operations: any[]) {
    const id = row.depositId;
    const terms = objectValue(row.terms);
    const mode = depositBenefitMode(terms);
    const rate = depositBenefitRate(terms);
    const items: JsonObject[] = [];

    for (const operation of operations) {
      if (!operation || operation.status !== 'completed') continue;
      const data = objectValue(operation.data);
      const occurredAt = operation.occurredAt instanceof Date ? operation.occurredAt : new Date(operation.occurredAt);

      if (operation.kind === 'deposit-funding' && operation.sourceType === 'deposit' && operation.sourceId === id) {
        const amount = money(data.amount ?? data.total);
        if (amount > 0) items.push({
          operationId: operation.operationId,
          kind: 'deposit-funding', amount, direction: 'IN',
          occurredAt: occurredAt.toISOString(), status: operation.status,
          source: { type: operation.sourceType, id: operation.sourceId },
        });
        if (mode === 'accrual' && rate > 0) {
          const gain = money(amount * rate / 100);
          if (gain > 0) items.push({
            operationId: `${operation.operationId}:benefit`,
            kind: 'deposit-benefit', amount: gain, direction: 'IN',
            occurredAt: occurredAt.toISOString(), status: operation.status,
            source: { type: 'deposit', id },
          });
        }
        continue;
      }

      if (operation.kind === 'deposit-withdrawal' && operation.sourceType === 'deposit' && operation.sourceId === id) {
        const amount = money(data.amount ?? data.total);
        if (amount > 0) items.push({
          operationId: operation.operationId,
          kind: 'deposit-withdrawal', amount, direction: 'OUT',
          occurredAt: occurredAt.toISOString(), status: operation.status,
          source: { type: operation.sourceType, id: operation.sourceId },
        });
        continue;
      }

      if (operation.kind === 'payment') {
        const used = allocationFor(data.depositAllocations, id);
        if (used > 0) items.push({
          operationId: operation.operationId,
          kind: 'payment', amount: used, direction: 'OUT',
          occurredAt: occurredAt.toISOString(), status: operation.status,
          source: { type: operation.sourceType, id: operation.sourceId },
        });
        continue;
      }

      if (operation.kind === 'refund') {
        const restored = allocationFor(data.depositAllocations, id);
        if (restored > 0) items.push({
          operationId: operation.operationId,
          kind: 'refund', amount: restored, direction: 'IN',
          occurredAt: occurredAt.toISOString(), status: operation.status,
          source: { type: operation.sourceType, id: operation.sourceId },
        });
      }
    }

    return items.sort((left, right) => String(left.occurredAt).localeCompare(String(right.occurredAt)));
  }

  private dto(row: DepositRow, operations: any[]) {
    const principalBalance = money(row.principalBalance);
    const benefitBalance = money(row.benefitBalance);
    const balance = money(row.balance);
    const terms = objectValue(row.terms);
    const mode = depositBenefitMode(terms);
    return {
      depositId: row.depositId,
      programId: row.programId,
      programName: row.programName,
      person: objectValue(row.person),
      fundedAmount: money(row.initialAmount),
      principalBalance,
      benefitBalance,
      refundableAmount: row.status === 'active' ? principalBalance : 0,
      balance,
      terms,
      benefitMode: mode,
      discountPercent: mode === 'discount' && row.status === 'active' && depositTermActiveAt(terms, new Date()) ? depositBenefitRate(terms) : 0,
      status: row.status,
      canRefund: row.status === 'active' && principalBalance > 0.009 && depositTermActiveAt(terms, new Date()),
      fundedAt: row.fundedAt.toISOString(),
      fundingOperationId: row.fundingOperationId,
      history: this.history(row, operations),
    };
  }

  async list(tenantId: string, personKeyValue = '') {
    const [rows, operations] = await Promise.all([
      this.rows(tenantId, text(personKeyValue)),
      this.operations(tenantId),
    ]);
    return rows.map((row) => this.dto(row, operations));
  }

  async get(tenantId: string, depositId: string) {
    const id = text(depositId);
    await expireDepositInstances(this.prisma, tenantId, id);
    const row = await this.prisma.loyaltyDepositInstance.findUnique({
      where: { tenantId_depositId: { tenantId, depositId: id } },
    });
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
    const id = text(depositId);
    const current = await this.get(tenantId, id);
    if (!current.canRefund || current.refundableAmount <= 0.009) {
      throw new BadRequestException(current.status === 'expired'
        ? 'Срок депозита закончился. Возврат после окончания срока недоступен.'
        : 'У депозита нет реальных денег к возврату');
    }
    const input = objectValue(body);
    await this.finance.recordDepositWithdrawal(tenantId, id, {
      ...input,
      amount: current.refundableAmount,
    });
    return this.get(tenantId, id);
  }

  private async hardDeleteWith(tx: Prisma.TransactionClient, tenantId: string, depositId: string) {
    const id = text(depositId);
    if (!id) return;

    const row = await tx.loyaltyDepositInstance.findUnique({
      where: { tenantId_depositId: { tenantId, depositId: id } },
    });
    if (!row) return;

    const operations = await tx.financeOperation.findMany({
      where: { tenantId, kind: { in: ['payment', 'refund'] } },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    for (const operation of operations) {
      const data = objectValue(operation.data);
      const allocations = arrayValue(data.depositAllocations).map((value) => clone(objectValue(value)));
      const removed = money(allocations.reduce((sum, allocation) => {
        const allocationId = text(allocation.depositId ?? allocation.sourceId ?? allocation.id);
        return sum + (allocationId === id ? money(allocation.amount) : 0);
      }, 0));
      if (removed <= 0.009) continue;

      const nextAllocations = allocations.filter((allocation) => text(allocation.depositId ?? allocation.sourceId ?? allocation.id) !== id);
      const nextService = Math.max(0, money(money(data.serviceAmount) - removed));
      const tips = money(data.tips);
      const nextData = {
        ...clone(data),
        depositAllocations: nextAllocations,
        serviceAmount: nextService,
        total: money(nextService + tips),
      };

      if (money(nextData.total) <= 0.009 && money(data.cashTotal) <= 0.009) {
        await tx.financeOperation.delete({ where: { id: operation.id } });
      } else {
        await tx.financeOperation.update({ where: { id: operation.id }, data: { data: nextData as Prisma.InputJsonValue } });
      }
    }

    await tx.financeOperation.deleteMany({
      where: {
        tenantId,
        sourceType: 'deposit',
        sourceId: id,
        kind: { in: ['deposit-funding', 'deposit-withdrawal'] },
      },
    });
    await tx.loyaltyDepositInstance.delete({ where: { id: row.id } });
  }

  async hardDelete(tenantId: string, depositId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.hardDeleteWith(tx, tenantId, depositId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { deleted: true, depositId: text(depositId) };
  }

  async hardDeleteProgram(tenantId: string, programId: string) {
    const id = text(programId);
    if (!id) throw new BadRequestException('Депозитная программа не найдена');
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.loyaltyDepositInstance.findMany({
        where: { tenantId, programId: id },
        orderBy: { createdAt: 'asc' },
        select: { depositId: true },
      });
      for (const row of rows) await this.hardDeleteWith(tx, tenantId, row.depositId);
      await tx.loyaltyDepositProgram.deleteMany({ where: { tenantId, programId: id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { deleted: true, programId: id };
  }
}

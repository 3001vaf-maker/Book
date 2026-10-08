import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { FinanceService } from '../finance/finance.service';
import { removeLoyaltySettlementEffects } from '../loyalty/settlement-projection';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
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

function requiredOccurredAt(value: unknown) {
  const raw = text(value);
  if (!raw) throw new BadRequestException('Укажите фактическую дату и время операции');
  const date = value instanceof Date ? value : new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new BadRequestException('Некорректная фактическая дата операции');
  return date;
}

function retryable(error: unknown) {
  const code = text(objectValue(error).code);
  return code === 'P2034' || code === '40001';
}

@Injectable()
export class SettlementLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  private async serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        lastError = error;
        if (!retryable(error) || attempt === 2) throw error;
      }
    }
    throw lastError;
  }

  async cancelRefund(tenantId: string, operationId: string, body: unknown) {
    const id = text(operationId);
    const input = objectValue(body);
    const occurredAt = requiredOccurredAt(input.occurredAt);

    await this.serializable(async (tx) => {
      const refund = await tx.financeOperation.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: id } },
        include: { ledgerEntries: true },
      });
      if (!refund || refund.kind !== 'refund') throw new NotFoundException('Возврат не найден');
      if (refund.status === 'cancelled') return;

      const payment = await tx.financeOperation.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: refund.originalOperationId } },
      });
      if (!payment || payment.kind !== 'payment') throw new NotFoundException('Исходная оплата не найдена');

      await removeLoyaltySettlementEffects(tx, tenantId, [refund.operationId]);

      const reversalId = `cancel-${refund.operationId}`;
      const exists = await tx.financeOperation.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: reversalId } },
      });
      if (!exists) {
        const reversal = await tx.financeOperation.create({
          data: {
            tenantId,
            operationId: reversalId,
            kind: 'cancel',
            status: 'completed',
            sourceType: refund.sourceType,
            sourceId: refund.sourceId,
            originalOperationId: refund.operationId,
            occurredAt,
            data: clone({
              reason: text(input.reason) || 'incorrect-entry',
              cancelledOperationId: refund.operationId,
            }) as Prisma.InputJsonValue,
          },
        });
        for (const entry of refund.ledgerEntries) {
          const data = objectValue(entry.data);
          await tx.financeLedgerEntry.create({
            data: {
              tenantId,
              financeOperationId: reversal.id,
              entryId: randomUUID(),
              walletId: entry.walletId,
              direction: entry.direction === 'IN' ? 'OUT' : 'IN',
              economicType: 'REVERSAL',
              amount: money(entry.amount),
              occurredAt,
              sourceType: refund.sourceType,
              sourceId: refund.sourceId,
              data: clone({
                walletName: text(data.walletName),
                component: text(data.component),
                relatedOperationId: refund.operationId,
              }) as Prisma.InputJsonValue,
            },
          });
        }
      }
      await tx.financeOperation.update({ where: { id: refund.id }, data: { status: 'cancelled' } });
    });

    return this.finance.snapshot(tenantId);
  }

  async hardDeleteRefund(tenantId: string, operationId: string) {
    const id = text(operationId);
    await this.serializable(async (tx) => {
      const refund = await tx.financeOperation.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: id } },
      });
      if (!refund || refund.kind !== 'refund') throw new NotFoundException('Возврат не найден');

      await removeLoyaltySettlementEffects(tx, tenantId, [refund.operationId]);
      const descendants = await tx.financeOperation.findMany({
        where: { tenantId, originalOperationId: refund.operationId },
        select: { operationId: true },
      });
      await tx.financeOperation.deleteMany({
        where: {
          tenantId,
          operationId: { in: [refund.operationId, ...descendants.map((row) => row.operationId)] },
        },
      });
    });
    return this.finance.snapshot(tenantId);
  }
}

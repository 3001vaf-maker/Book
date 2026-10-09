import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import {
  applyPersonalAccountMovement,
  personalAccountDebtById,
  personalAccountMoney,
  personalAccountSnapshot,
  reducePersonalAccountDebt,
} from '../loyalty/personal-account-state';

type JsonObject = Record<string, any>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function requiredOccurredAt(value: unknown) {
  const raw = text(value);
  if (!raw) throw new BadRequestException('Укажите фактическую дату и время операции');
  const date = value instanceof Date ? value : new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new BadRequestException('Некорректная фактическая дата операции');
  return date;
}

function isRetryableTransactionError(error: unknown) {
  const code = text(objectValue(error).code);
  return code === 'P2034' || code === '40001';
}

@Injectable()
export class PersonalAccountFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        lastError = error;
        if (!isRetryableTransactionError(error) || attempt === 2) throw error;
      }
    }
    throw lastError;
  }

  private async createMoneyFact(tx: Prisma.TransactionClient, tenantId: string, input: {
    operationId: string;
    kind: string;
    sourceType: string;
    sourceId: string;
    occurredAt: Date;
    walletId: string;
    walletName: string;
    direction: 'IN' | 'OUT';
    economicType: string;
    amount: number;
    data: JsonObject;
  }) {
    const operation = await tx.financeOperation.create({
      data: {
        tenantId,
        operationId: input.operationId,
        kind: input.kind,
        status: 'completed',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        occurredAt: input.occurredAt,
        data: input.data as Prisma.InputJsonValue,
      },
    });
    await tx.financeLedgerEntry.create({
      data: {
        tenantId,
        financeOperationId: operation.id,
        entryId: randomUUID(),
        walletId: input.walletId,
        direction: input.direction,
        economicType: input.economicType,
        amount: input.amount,
        occurredAt: input.occurredAt,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        data: {
          walletName: input.walletName,
          component: input.kind,
          personalAccount: true,
        } as Prisma.InputJsonValue,
      },
    });
    return operation;
  }

  async fund(tenantId: string, body: unknown) {
    const input = objectValue(body);
    const personKey = text(input.personKey);
    const walletId = text(input.walletId);
    const walletName = text(input.walletName);
    const amount = personalAccountMoney(input.amount);
    const occurredAt = requiredOccurredAt(input.occurredAt);
    if (!personKey) throw new BadRequestException('Не выбран человек');
    if (!walletId) throw new BadRequestException('Выберите кошелёк');
    if (amount <= 0) throw new BadRequestException('Введите сумму пополнения');
    const operationId = randomUUID();
    await this.serializable(async (tx) => {
      const movement = await applyPersonalAccountMovement(tx, {
        eventId: `personal-account:${operationId}`,
        tenantId,
        personKey,
        kind: 'funding',
        direction: 'IN',
        amount,
        sourceType: 'finance-operation',
        sourceId: operationId,
        occurredAt,
        data: { walletId, walletName, note: text(input.note), method: text(input.method), provider: text(input.provider), providerPaymentId: text(input.providerPaymentId) },
      });
      await this.createMoneyFact(tx, tenantId, {
        operationId,
        kind: 'personal-account-funding',
        sourceType: 'personal-account',
        sourceId: String((movement as any).personKey || personKey),
        occurredAt,
        walletId,
        walletName,
        direction: 'IN',
        economicType: 'PERSONAL_ACCOUNT_LIABILITY_IN',
        amount,
        data: {
          personKey: String((movement as any).personKey || personKey),
          amount,
          walletId,
          walletName,
          note: text(input.note),
          method: text(input.method),
          provider: text(input.provider),
          providerPaymentId: text(input.providerPaymentId),
        },
      });
    });
    return personalAccountSnapshot(this.prisma, tenantId, personKey);
  }

  async withdraw(tenantId: string, body: unknown) {
    const input = objectValue(body);
    const personKey = text(input.personKey);
    const walletId = text(input.walletId);
    const walletName = text(input.walletName);
    const amount = personalAccountMoney(input.amount);
    const occurredAt = requiredOccurredAt(input.occurredAt);
    if (!personKey) throw new BadRequestException('Не выбран человек');
    if (!walletId) throw new BadRequestException('Выберите кошелёк возврата');
    if (amount <= 0) throw new BadRequestException('Введите сумму возврата');
    const operationId = randomUUID();
    await this.serializable(async (tx) => {
      const movement = await applyPersonalAccountMovement(tx, {
        eventId: `personal-account:${operationId}`,
        tenantId,
        personKey,
        kind: 'withdrawal',
        direction: 'OUT',
        amount,
        sourceType: 'finance-operation',
        sourceId: operationId,
        occurredAt,
        data: { walletId, walletName, reason: text(input.reason), method: text(input.method), provider: text(input.provider), providerPaymentId: text(input.providerPaymentId) },
      });
      await this.createMoneyFact(tx, tenantId, {
        operationId,
        kind: 'personal-account-withdrawal',
        sourceType: 'personal-account',
        sourceId: String((movement as any).personKey || personKey),
        occurredAt,
        walletId,
        walletName,
        direction: 'OUT',
        economicType: 'PERSONAL_ACCOUNT_LIABILITY_OUT',
        amount,
        data: {
          personKey: String((movement as any).personKey || personKey),
          amount,
          walletId,
          walletName,
          reason: text(input.reason),
          method: text(input.method),
          provider: text(input.provider),
          providerPaymentId: text(input.providerPaymentId),
        },
      });
    });
    return personalAccountSnapshot(this.prisma, tenantId, personKey);
  }

  async settleDebt(tenantId: string, debtIdValue: unknown, body: unknown) {
    const input = objectValue(body);
    const debtId = text(debtIdValue);
    const walletId = text(input.walletId);
    const walletName = text(input.walletName);
    const amount = personalAccountMoney(input.amount);
    const occurredAt = requiredOccurredAt(input.occurredAt);
    if (!debtId) throw new BadRequestException('Задолженность не выбрана');
    if (!walletId) throw new BadRequestException('Выберите кошелёк');
    if (amount <= 0) throw new BadRequestException('Введите сумму оплаты');
    let personKey = '';
    await this.serializable(async (tx) => {
      const debt = await personalAccountDebtById(tx, tenantId, debtId, true);
      if (!debt) throw new BadRequestException('Задолженность не найдена');
      personKey = debt.personKey;
      const operationId = randomUUID();
      await reducePersonalAccountDebt(tx, tenantId, debtId, amount, occurredAt);
      await this.createMoneyFact(tx, tenantId, {
        operationId,
        kind: 'personal-account-debt-payment',
        sourceType: 'personal-account-debt',
        sourceId: debtId,
        occurredAt,
        walletId,
        walletName,
        direction: 'IN',
        economicType: 'DEBT_RECEIPT',
        amount,
        data: {
          debtId,
          personKey,
          amount,
          walletId,
          walletName,
          originalSourceType: debt.sourceType,
          originalSourceId: debt.sourceId,
          note: text(input.note),
          method: text(input.method),
          provider: text(input.provider),
          providerPaymentId: text(input.providerPaymentId),
        },
      });
    });
    return personalAccountSnapshot(this.prisma, tenantId, personKey);
  }
}

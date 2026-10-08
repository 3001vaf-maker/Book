import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { FinanceService } from '../finance/finance.service';
import {
  applyLoyaltySettlementMovements,
  normalizeSettlementMovements,
  removeLoyaltySettlementEffects,
  restoreLoyaltySettlementMovements,
  settlementMovementTotal,
  settlementSourcesForPerson,
  type SettlementMovement,
} from '../loyalty/settlement-projection';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
type Db = PrismaService | Prisma.TransactionClient;

type Source = { type: string; id: string };

type CashAllocation = { walletId: string; walletName: string; amount: number };

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
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

function percent(value: unknown) {
  return Math.max(0, Math.min(100, numberValue(value)));
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

function sourceValue(value: unknown): Source {
  const source = objectValue(value);
  return { type: text(source.type), id: text(source.id) };
}

function normalizeSettlement(value: unknown) {
  const source = objectValue(value);
  const items = arrayValue(source.items).map((item) => {
    const row = objectValue(item);
    const price = money(row.price ?? row.cost);
    const discountMoney = Math.min(price, money(row.discountMoney));
    return {
      sourceType: text(row.sourceType) || 'procedure',
      sourceId: text(row.sourceId ?? row.id),
      name: text(row.name),
      price,
      discountMode: ['percent', 'money', 'none'].includes(text(row.discountMode)) ? text(row.discountMode) : 'none',
      discountPercent: percent(row.discountPercent),
      discountMoney,
      planAmount: Math.max(0, money(row.planAmount ?? (price - discountMoney))),
    };
  });
  const serviceTotal = money(source.serviceTotal ?? items.reduce((sum, item) => sum + item.price, 0));
  const discountTotal = money(source.discountTotal ?? items.reduce((sum, item) => sum + item.discountMoney, 0));
  const planTotal = money(source.planTotal ?? items.reduce((sum, item) => sum + item.planAmount, 0));
  return {
    items,
    serviceTotal,
    discountPercent: source.discountPercent == null ? null : percent(source.discountPercent),
    discountTotal,
    planTotal,
  };
}

function validSettlement(value: unknown) {
  const settlement = normalizeSettlement(value);
  return settlement.items.length > 0 || settlement.planTotal > 0 ? settlement : null;
}

function allocationsValue(value: unknown): CashAllocation[] {
  return arrayValue(value)
    .map((entry) => {
      const row = objectValue(entry);
      return {
        walletId: text(row.walletId),
        walletName: text(row.walletName),
        amount: money(row.amount),
      };
    })
    .filter((entry) => entry.walletId && entry.amount > 0);
}

function splitCashComponents(allocations: CashAllocation[], serviceAmount: number, tips: number) {
  let serviceLeft = money(serviceAmount);
  let tipsLeft = money(tips);
  const service: CashAllocation[] = [];
  const tipRows: CashAllocation[] = [];
  for (const allocation of allocations) {
    let walletLeft = money(allocation.amount);
    const servicePiece = Math.min(walletLeft, serviceLeft);
    if (servicePiece > 0) {
      service.push({ ...allocation, amount: money(servicePiece) });
      walletLeft = money(walletLeft - servicePiece);
      serviceLeft = money(serviceLeft - servicePiece);
    }
    const tipPiece = Math.min(walletLeft, tipsLeft);
    if (tipPiece > 0) {
      tipRows.push({ ...allocation, amount: money(tipPiece) });
      tipsLeft = money(tipsLeft - tipPiece);
    }
  }
  if (serviceLeft > 0.009 || tipsLeft > 0.009) throw new BadRequestException('Сумма по кошелькам не совпадает с оплатой');
  return { service, tips: tipRows };
}

function movementId() {
  return `settlement-movement-${randomUUID()}`;
}

function movementApplied(data: JsonObject) {
  const movements = normalizeSettlementMovements(data.settlementMovements);
  if (movements.length) return settlementMovementTotal(movements);
  return money(money(data.serviceAmount) + money(data.bonusAmount));
}

function movementBreakdown(movements: SettlementMovement[]) {
  let walletMoney = 0;
  let depositMoney = 0;
  let personalAccountMoney = 0;
  let bonus = 0;
  for (const movement of movements) {
    if (movement.nominal === 'bonus') bonus += movement.amount;
    else if (movement.sourceType === 'wallet') walletMoney += movement.amount;
    else if (movement.sourceType === 'deposit') depositMoney += movement.amount;
    else if (movement.sourceType === 'personal-account') personalAccountMoney += movement.amount;
  }
  return {
    walletMoney: money(walletMoney),
    depositMoney: money(depositMoney),
    personalAccountMoney: money(personalAccountMoney),
    bonus: money(bonus),
  };
}

function movementKey(value: JsonObject) {
  return `${text(value.nominal)}:${text(value.sourceType)}:${text(value.sourceId)}`;
}

function originalMovementId(value: JsonObject) {
  return text(value.originalMovementId || value.movementId);
}

@Injectable()
export class SettlementService {
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

  private async saveSettlement(db: Db, tenantId: string, source: Source, settlement: JsonObject) {
    await db.financeSettlement.upsert({
      where: { tenantId_sourceType_sourceId: { tenantId, sourceType: source.type, sourceId: source.id } },
      create: { tenantId, sourceType: source.type, sourceId: source.id, data: clone(settlement) as Prisma.InputJsonValue },
      update: { data: clone(settlement) as Prisma.InputJsonValue },
    });
  }

  private async settlementNet(db: Db, tenantId: string, source: Source, excludeOperationId = '') {
    const operations = await db.financeOperation.findMany({
      where: {
        tenantId,
        sourceType: source.type,
        sourceId: source.id,
        status: 'completed',
        kind: { in: ['payment', 'refund'] },
        ...(excludeOperationId ? { operationId: { not: excludeOperationId } } : {}),
      },
      select: { kind: true, data: true },
    });
    return money(operations.reduce((sum, operation) => {
      const applied = movementApplied(objectValue(operation.data));
      return sum + (operation.kind === 'refund' ? -applied : applied);
    }, 0));
  }

  private async createOperation(
    db: Db,
    tenantId: string,
    {
      operationId,
      kind,
      source,
      originalOperationId = '',
      occurredAt,
      data,
      entries,
    }: {
      operationId: string;
      kind: string;
      source: Source;
      originalOperationId?: string;
      occurredAt: Date;
      data: JsonObject;
      entries: JsonObject[];
    },
  ) {
    const operation = await db.financeOperation.create({
      data: {
        tenantId,
        operationId,
        kind,
        status: 'completed',
        sourceType: source.type,
        sourceId: source.id,
        originalOperationId,
        occurredAt,
        data: clone(data) as Prisma.InputJsonValue,
      },
    });
    for (const entry of entries) {
      await db.financeLedgerEntry.create({
        data: {
          tenantId,
          financeOperationId: operation.id,
          entryId: randomUUID(),
          walletId: text(entry.walletId),
          direction: text(entry.direction),
          economicType: text(entry.economicType),
          amount: money(entry.amount),
          occurredAt,
          sourceType: source.type,
          sourceId: source.id,
          data: clone({
            walletName: text(entry.walletName),
            component: text(entry.component),
            relatedOperationId: text(entry.relatedOperationId),
            note: text(entry.note),
          }) as Prisma.InputJsonValue,
        },
      });
    }
    return operation;
  }

  private async replaceOperation(
    db: Db,
    tenantId: string,
    operation: { id: string; sourceType: string; sourceId: string },
    occurredAt: Date,
    data: JsonObject,
    entries: JsonObject[],
  ) {
    await db.financeLedgerEntry.deleteMany({ where: { tenantId, financeOperationId: operation.id } });
    await db.financeOperation.update({
      where: { id: operation.id },
      data: { occurredAt, data: clone(data) as Prisma.InputJsonValue },
    });
    for (const entry of entries) {
      await db.financeLedgerEntry.create({
        data: {
          tenantId,
          financeOperationId: operation.id,
          entryId: randomUUID(),
          walletId: text(entry.walletId),
          direction: text(entry.direction),
          economicType: text(entry.economicType),
          amount: money(entry.amount),
          occurredAt,
          sourceType: operation.sourceType,
          sourceId: operation.sourceId,
          data: clone({
            walletName: text(entry.walletName),
            component: text(entry.component),
            relatedOperationId: text(entry.relatedOperationId),
            note: text(entry.note),
          }) as Prisma.InputJsonValue,
        },
      });
    }
  }

  private paymentRequest(input: JsonObject) {
    const source = sourceValue(input.source);
    if (!source.type || !source.id) throw new BadRequestException('У оплаты отсутствует источник');
    const settlement = validSettlement(input.settlement);
    if (!settlement) throw new BadRequestException('У оплаты отсутствует расчёт');
    const allocations = allocationsValue(input.allocations);
    const allocated = money(allocations.reduce((sum, entry) => sum + entry.amount, 0));
    const tips = Math.min(allocated, money(input.tips));
    const cashService = money(allocated - tips);
    if (input.serviceAmount != null && Math.abs(money(input.serviceAmount) - cashService) > 0.009) {
      throw new BadRequestException('Денежная часть оплаты не совпадает с распределением по кошелькам');
    }
    const person = clone(objectValue(input.person));
    const personKey = text(input.personKey || person.key);
    return { source, settlement, allocations, allocated, tips, cashService, person, personKey };
  }

  private async requestedLoyaltyMovements(db: Db, tenantId: string, input: JsonObject, personKey: string) {
    const explicit = normalizeSettlementMovements(input.settlementMovements)
      .filter((movement) => movement.sourceType !== 'wallet');
    if (explicit.length) return explicit;
    const bonus = money(input.bonusAmount);
    if (bonus <= 0) return [];
    const sources = await settlementSourcesForPerson(db, tenantId, personKey);
    if (!sources.account) throw new BadRequestException('Личный счёт с бонусами не найден');
    return [{
      movementId: movementId(),
      nominal: 'bonus' as const,
      sourceType: 'personal-account' as const,
      sourceId: text(sources.account.id),
      sourceName: 'Личный счёт · Бонусы',
      amount: bonus,
    }];
  }

  private cashMovements(serviceAllocations: CashAllocation[]): SettlementMovement[] {
    return serviceAllocations.map((allocation) => ({
      movementId: movementId(),
      nominal: 'money',
      sourceType: 'wallet',
      sourceId: allocation.walletId,
      sourceName: allocation.walletName || 'Кошелёк',
      amount: allocation.amount,
    }));
  }

  private ledgerForCash(parts: { service: CashAllocation[]; tips: CashAllocation[] }, direction: 'IN' | 'OUT') {
    return [
      ...parts.service.map((entry) => ({
        walletId: entry.walletId,
        walletName: entry.walletName,
        amount: entry.amount,
        component: 'service',
        direction,
        economicType: direction === 'IN' ? 'SERVICE_REVENUE' : 'SERVICE_REFUND',
      })),
      ...parts.tips.map((entry) => ({
        walletId: entry.walletId,
        walletName: entry.walletName,
        amount: entry.amount,
        component: 'tips',
        direction,
        economicType: direction === 'IN' ? 'TIPS' : 'TIPS_REFUND',
      })),
    ];
  }

  async sources(tenantId: string, personKey: string) {
    return settlementSourcesForPerson(this.prisma, tenantId, personKey);
  }

  async recordPayment(tenantId: string, body: unknown) {
    const input = objectValue(body);
    const occurredAt = requiredOccurredAt(input.occurredAt);
    const operationId = randomUUID();

    await this.serializable(async (tx) => {
      const request = this.paymentRequest(input);
      const loyaltyRequested = await this.requestedLoyaltyMovements(tx, tenantId, input, request.personKey);
      const requestedApplied = money(request.cashService + settlementMovementTotal(loyaltyRequested));
      if (requestedApplied <= 0 && request.tips <= 0) throw new BadRequestException('Введите сумму оплаты');

      await this.saveSettlement(tx, tenantId, request.source, request.settlement);
      const paid = await this.settlementNet(tx, tenantId, request.source);
      const due = Math.max(0, money(request.settlement.planTotal - paid));
      if (requestedApplied > due + 0.009) throw new BadRequestException('Оплата превышает остаток к оплате');

      const cashParts = splitCashComponents(request.allocations, request.cashService, request.tips);
      const loyaltyApplied = await applyLoyaltySettlementMovements(tx, tenantId, loyaltyRequested, {
        personKey: request.personKey,
        financeOperationId: operationId,
        occurredAt,
      });
      const settlementMovements = [...this.cashMovements(cashParts.service), ...loyaltyApplied];
      const applied = settlementMovementTotal(settlementMovements);
      if (Math.abs(applied - requestedApplied) > 0.009) throw new BadRequestException('Не удалось согласовать источники оплаты');
      const breakdown = movementBreakdown(settlementMovements);

      await this.createOperation(tx, tenantId, {
        operationId,
        kind: 'payment',
        source: request.source,
        occurredAt,
        data: {
          workplace: text(input.workplace),
          person: { ...request.person, ...(request.personKey ? { key: request.personKey } : {}) },
          personKey: request.personKey,
          allocations: request.allocations,
          cashReceived: request.allocated,
          cashServiceAmount: request.cashService,
          serviceAmount: applied,
          tips: request.tips,
          total: money(applied + request.tips),
          settlement: request.settlement,
          settlementMovements,
          bonusAmount: breakdown.bonus,
          depositAmount: breakdown.depositMoney,
          personalAccountMoneyAmount: breakdown.personalAccountMoney,
        },
        entries: this.ledgerForCash(cashParts, 'IN'),
      });
    });

    return this.finance.snapshot(tenantId);
  }

  private activeRefunds(operations: Array<{ operationId: string; kind: string; status: string; data: Prisma.JsonValue }>, paymentId: string, excludeId = '') {
    return operations.filter((operation) => operation.kind === 'refund'
      && operation.status === 'completed'
      && text((operation as any).originalOperationId || objectValue(operation.data).originalOperationId) !== ''
      && (!excludeId || operation.operationId !== excludeId));
  }

  private refundedForMovement(refunds: Array<{ data: Prisma.JsonValue }>, movement: SettlementMovement) {
    const id = movement.movementId;
    const key = movementKey(movement as unknown as JsonObject);
    return money(refunds.reduce((sum, refund) => {
      const rows = arrayValue(objectValue(refund.data).settlementMovements);
      return sum + rows.reduce((inner: number, value: unknown) => {
        const row = objectValue(value);
        const matches = text(row.originalMovementId) === id
          || (!text(row.originalMovementId) && movementKey(row) === key);
        return inner + (matches ? money(row.amount) : 0);
      }, 0);
    }, 0));
  }

  private remainingMovements(paymentData: JsonObject, refunds: Array<{ data: Prisma.JsonValue }>) {
    return normalizeSettlementMovements(paymentData.settlementMovements)
      .map((movement) => ({
        ...movement,
        remaining: Math.max(0, money(movement.amount - this.refundedForMovement(refunds, movement))),
      }))
      .filter((movement) => movement.remaining > 0.009);
  }

  private explicitRefundMovements(input: JsonObject, remaining: Array<SettlementMovement & { remaining: number }>) {
    const requested = arrayValue(input.settlementMovements);
    if (!requested.length) return [];
    const result: JsonObject[] = [];
    for (const value of requested) {
      const row = objectValue(value);
      const originalId = text(row.originalMovementId || row.movementId);
      const target = remaining.find((movement) => movement.movementId === originalId)
        || remaining.find((movement) => movementKey(movement as unknown as JsonObject) === movementKey(row));
      if (!target) throw new BadRequestException('Источник частичного возврата не найден');
      const amount = Math.min(target.remaining, money(row.amount));
      if (amount <= 0) continue;
      result.push({ ...target, amount, originalMovementId: target.movementId });
    }
    return result;
  }

  private autoRefundMovements(remaining: Array<SettlementMovement & { remaining: number }>, requested: number) {
    const total = money(remaining.reduce((sum, movement) => sum + movement.remaining, 0));
    const amount = Math.min(total, money(requested));
    if (amount <= 0) return [];
    if (remaining.length > 1 && amount + 0.009 < total) {
      throw new BadRequestException('Для частичного возврата смешанной оплаты выберите конкретные источники возврата');
    }
    let left = amount;
    const result: JsonObject[] = [];
    for (const movement of remaining) {
      if (left <= 0.009) break;
      const piece = Math.min(left, movement.remaining);
      if (piece <= 0) continue;
      result.push({ ...movement, amount: money(piece), originalMovementId: movement.movementId });
      left = money(left - piece);
    }
    return result;
  }

  private async prepareRefund(
    tx: Prisma.TransactionClient,
    tenantId: string,
    payment: any,
    input: JsonObject,
    refundOperationId: string,
    occurredAt: Date,
    excludeRefundId = '',
  ) {
    const paymentData = objectValue(payment.data);
    const refunds = await tx.financeOperation.findMany({
      where: {
        tenantId,
        kind: 'refund',
        originalOperationId: payment.operationId,
        status: 'completed',
        ...(excludeRefundId ? { operationId: { not: excludeRefundId } } : {}),
      },
      select: { operationId: true, kind: true, status: true, originalOperationId: true, data: true },
    });
    const remaining = this.remainingMovements(paymentData, refunds);
    const serviceRemaining = money(remaining.reduce((sum, movement) => sum + movement.remaining, 0));
    const refundedTips = money(refunds.reduce((sum, refund) => sum + money(objectValue(refund.data).tips), 0));
    const tipsRemaining = Math.max(0, money(paymentData.tips - refundedTips));
    const totalRemaining = money(serviceRemaining + tipsRemaining);
    if (totalRemaining <= 0.009) throw new BadRequestException('Оплата уже возвращена полностью');

    const requestedTotal = Math.min(totalRemaining, money(input.amount == null ? totalRemaining : input.amount));
    if (requestedTotal <= 0) throw new BadRequestException('Некорректная сумма возврата');
    const serviceRequested = Math.min(requestedTotal, serviceRemaining);
    let refundMovements = this.explicitRefundMovements(input, remaining);
    if (!refundMovements.length && serviceRequested > 0) refundMovements = this.autoRefundMovements(remaining, serviceRequested);
    const serviceAmount = money(refundMovements.reduce((sum, movement) => sum + money(movement.amount), 0));
    if (serviceAmount + 0.009 < serviceRequested && arrayValue(input.settlementMovements).length) {
      throw new BadRequestException('Выбранные источники не покрывают сумму возврата');
    }
    const tips = Math.min(Math.max(0, money(requestedTotal - serviceAmount)), tipsRemaining);

    const loyaltyOriginal = refundMovements.filter((movement) => text(movement.sourceType) !== 'wallet') as SettlementMovement[];
    const restored = await restoreLoyaltySettlementMovements(tx, tenantId, payment.operationId, loyaltyOriginal, {
      reversalFinanceOperationId: refundOperationId,
      occurredAt,
    });
    const restoredByKey = new Map(restored.map((movement) => [movementKey(movement as unknown as JsonObject), movement]));
    const canonical = refundMovements.map((movement) => {
      if (text(movement.sourceType) === 'wallet') return {
        ...movement,
        movementId: movementId(),
      };
      const restoredMovement = restoredByKey.get(movementKey(movement));
      if (!restoredMovement || money(restoredMovement.amount) + 0.009 < money(movement.amount)) {
        throw new BadRequestException('Не удалось восстановить источник Лояльности');
      }
      return {
        ...movement,
        movementId: movementId(),
        loyaltyOperationId: restoredMovement.loyaltyOperationId || '',
      };
    });

    const cashServiceAmount = money(canonical
      .filter((movement) => text(movement.sourceType) === 'wallet')
      .reduce((sum, movement) => sum + money(movement.amount), 0));
    const walletId = text(input.walletId);
    const walletName = text(input.walletName);
    if (cashServiceAmount + tips > 0.009 && !walletId) throw new BadRequestException('Не выбран кошелёк возврата');
    const cashParts = {
      service: cashServiceAmount > 0 ? [{ walletId, walletName, amount: cashServiceAmount }] : [],
      tips: tips > 0 ? [{ walletId, walletName, amount: tips }] : [],
    };
    const breakdown = movementBreakdown(canonical as SettlementMovement[]);
    return {
      settlementMovements: canonical,
      serviceAmount,
      cashServiceAmount,
      tips,
      total: money(serviceAmount + tips),
      cashParts,
      walletId,
      walletName,
      breakdown,
    };
  }

  async recordRefund(tenantId: string, paymentId: string, body: unknown) {
    const id = text(paymentId);
    const input = objectValue(body);
    const occurredAt = requiredOccurredAt(input.occurredAt);
    const refundOperationId = randomUUID();

    await this.serializable(async (tx) => {
      const payment = await tx.financeOperation.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: id } },
      });
      if (!payment || payment.kind !== 'payment') throw new NotFoundException('Оплата не найдена');
      if (payment.status === 'cancelled') throw new BadRequestException('Отменённую оплату вернуть нельзя');
      const prepared = await this.prepareRefund(tx, tenantId, payment, input, refundOperationId, occurredAt);
      const paymentData = objectValue(payment.data);
      await this.createOperation(tx, tenantId, {
        operationId: refundOperationId,
        kind: 'refund',
        source: { type: payment.sourceType, id: payment.sourceId },
        originalOperationId: payment.operationId,
        occurredAt,
        data: {
          workplace: text(paymentData.workplace),
          person: clone(objectValue(paymentData.person)),
          personKey: text(paymentData.personKey || objectValue(paymentData.person).key),
          walletId: prepared.walletId,
          walletName: prepared.walletName,
          total: prepared.total,
          serviceAmount: prepared.serviceAmount,
          cashServiceAmount: prepared.cashServiceAmount,
          tips: prepared.tips,
          reason: text(input.reason),
          settlement: clone(objectValue(paymentData.settlement)),
          settlementMovements: prepared.settlementMovements,
          bonusAmount: prepared.breakdown.bonus,
          depositAmount: prepared.breakdown.depositMoney,
          personalAccountMoneyAmount: prepared.breakdown.personalAccountMoney,
        },
        entries: this.ledgerForCash(prepared.cashParts, 'OUT'),
      });
    });

    return this.finance.snapshot(tenantId);
  }

  async correctPayment(tenantId: string, operationId: string, body: unknown) {
    const id = text(operationId);
    const input = objectValue(body);
    await this.serializable(async (tx) => {
      const current = await tx.financeOperation.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: id } },
      });
      if (!current || current.kind !== 'payment') throw new NotFoundException('Оплата не найдена');
      if (current.status === 'cancelled') throw new BadRequestException('Отменённую оплату корректировать нельзя');
      const related = await tx.financeOperation.findFirst({
        where: { tenantId, originalOperationId: current.operationId },
        select: { operationId: true },
      });
      if (related) throw new BadRequestException('Операцию со связанными возвратами или отменами сначала нужно привести в исходное состояние');

      const currentData = objectValue(current.data);
      const occurredAt = requiredOccurredAt(input.occurredAt ?? current.occurredAt);
      const request = this.paymentRequest({
        ...currentData,
        ...input,
        source: { type: current.sourceType, id: current.sourceId },
        settlement: currentData.settlement,
        person: currentData.person,
        personKey: currentData.personKey,
      });
      const loyaltyRequested = await this.requestedLoyaltyMovements(tx, tenantId, input, request.personKey);
      const requestedApplied = money(request.cashService + settlementMovementTotal(loyaltyRequested));
      const otherPaid = await this.settlementNet(tx, tenantId, request.source, current.operationId);
      const due = Math.max(0, money(request.settlement.planTotal - otherPaid));
      if (requestedApplied > due + 0.009) throw new BadRequestException('Оплата превышает остаток к оплате');

      await removeLoyaltySettlementEffects(tx, tenantId, [current.operationId]);
      const cashParts = splitCashComponents(request.allocations, request.cashService, request.tips);
      const loyaltyApplied = await applyLoyaltySettlementMovements(tx, tenantId, loyaltyRequested, {
        personKey: request.personKey,
        financeOperationId: current.operationId,
        occurredAt,
      });
      const settlementMovements = [...this.cashMovements(cashParts.service), ...loyaltyApplied];
      const applied = settlementMovementTotal(settlementMovements);
      const breakdown = movementBreakdown(settlementMovements);
      await this.replaceOperation(tx, tenantId, current, occurredAt, {
        workplace: text(currentData.workplace),
        person: clone(objectValue(currentData.person)),
        personKey: request.personKey,
        allocations: request.allocations,
        cashReceived: request.allocated,
        cashServiceAmount: request.cashService,
        serviceAmount: applied,
        tips: request.tips,
        total: money(applied + request.tips),
        settlement: request.settlement,
        settlementMovements,
        bonusAmount: breakdown.bonus,
        depositAmount: breakdown.depositMoney,
        personalAccountMoneyAmount: breakdown.personalAccountMoney,
      }, this.ledgerForCash(cashParts, 'IN'));
    });
    return this.finance.snapshot(tenantId);
  }

  async correctRefund(tenantId: string, operationId: string, body: unknown) {
    const id = text(operationId);
    const input = objectValue(body);
    await this.serializable(async (tx) => {
      const current = await tx.financeOperation.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: id } },
      });
      if (!current || current.kind !== 'refund') throw new NotFoundException('Возврат не найден');
      if (current.status === 'cancelled') throw new BadRequestException('Отменённый возврат корректировать нельзя');
      const payment = await tx.financeOperation.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: current.originalOperationId } },
      });
      if (!payment || payment.kind !== 'payment') throw new NotFoundException('Исходная оплата не найдена');
      const occurredAt = requiredOccurredAt(input.occurredAt ?? current.occurredAt);
      await removeLoyaltySettlementEffects(tx, tenantId, [current.operationId]);
      const prepared = await this.prepareRefund(tx, tenantId, payment, {
        ...objectValue(current.data),
        ...input,
      }, current.operationId, occurredAt, current.operationId);
      const paymentData = objectValue(payment.data);
      await this.replaceOperation(tx, tenantId, current, occurredAt, {
        workplace: text(paymentData.workplace),
        person: clone(objectValue(paymentData.person)),
        personKey: text(paymentData.personKey || objectValue(paymentData.person).key),
        walletId: prepared.walletId,
        walletName: prepared.walletName,
        total: prepared.total,
        serviceAmount: prepared.serviceAmount,
        cashServiceAmount: prepared.cashServiceAmount,
        tips: prepared.tips,
        reason: text(input.reason ?? objectValue(current.data).reason),
        settlement: clone(objectValue(paymentData.settlement)),
        settlementMovements: prepared.settlementMovements,
        bonusAmount: prepared.breakdown.bonus,
        depositAmount: prepared.breakdown.depositMoney,
        personalAccountMoneyAmount: prepared.breakdown.personalAccountMoney,
      }, this.ledgerForCash(prepared.cashParts, 'OUT'));
    });
    return this.finance.snapshot(tenantId);
  }

  private async ledgerReversal(tx: Prisma.TransactionClient, tenantId: string, target: any, occurredAt: Date, reason: string) {
    const ledger = await tx.financeLedgerEntry.findMany({ where: { tenantId, financeOperationId: target.id } });
    const reversalId = `cancel-${target.operationId}`;
    const existing = await tx.financeOperation.findUnique({ where: { tenantId_operationId: { tenantId, operationId: reversalId } } });
    if (existing) return existing;
    return this.createOperation(tx, tenantId, {
      operationId: reversalId,
      kind: 'cancel',
      source: { type: target.sourceType, id: target.sourceId },
      originalOperationId: target.operationId,
      occurredAt,
      data: { reason, cancelledOperationId: target.operationId },
      entries: ledger.map((entry) => ({
        walletId: entry.walletId,
        walletName: text(objectValue(entry.data).walletName),
        amount: numberValue(entry.amount),
        component: text(objectValue(entry.data).component),
        direction: entry.direction === 'IN' ? 'OUT' : 'IN',
        economicType: 'REVERSAL',
        relatedOperationId: target.operationId,
      })),
    });
  }

  async cancelPaymentTree(tenantId: string, operationId: string, body: unknown) {
    const id = text(operationId);
    const input = objectValue(body);
    const occurredAt = requiredOccurredAt(input.occurredAt);
    await this.serializable(async (tx) => {
      const payment = await tx.financeOperation.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: id } },
      });
      if (!payment || payment.kind !== 'payment') throw new NotFoundException('Оплата не найдена');
      if (payment.status === 'cancelled') return;
      const refunds = await tx.financeOperation.findMany({
        where: { tenantId, kind: 'refund', originalOperationId: payment.operationId, status: 'completed' },
      });
      const targetIds = [payment.operationId, ...refunds.map((refund) => refund.operationId)];
      await removeLoyaltySettlementEffects(tx, tenantId, targetIds);
      for (const refund of refunds) {
        await this.ledgerReversal(tx, tenantId, refund, occurredAt, text(input.reason) || 'incorrect-entry');
        await tx.financeOperation.update({ where: { id: refund.id }, data: { status: 'cancelled' } });
      }
      await this.ledgerReversal(tx, tenantId, payment, occurredAt, text(input.reason) || 'incorrect-entry');
      await tx.financeOperation.update({ where: { id: payment.id }, data: { status: 'cancelled' } });
    });
    return this.finance.snapshot(tenantId);
  }

  async hardDeletePaymentTree(tenantId: string, operationId: string) {
    const id = text(operationId);
    await this.serializable(async (tx) => {
      const current = await tx.financeOperation.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: id } },
      });
      if (!current || !['payment', 'refund', 'cancel'].includes(current.kind)) return;
      const rootId = current.kind === 'payment'
        ? current.operationId
        : (current.kind === 'refund' ? current.originalOperationId : text(objectValue(current.data).cancelledOperationId || current.originalOperationId));
      const root = await tx.financeOperation.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: rootId } },
      });
      if (!root || root.kind !== 'payment') return;
      const operationIds = new Set([root.operationId]);
      let frontier = [root.operationId];
      while (frontier.length) {
        const related = await tx.financeOperation.findMany({
          where: { tenantId, originalOperationId: { in: frontier } },
          select: { operationId: true },
        });
        const next = related.map((row) => row.operationId).filter((relatedId) => !operationIds.has(relatedId));
        next.forEach((relatedId) => operationIds.add(relatedId));
        frontier = next;
      }
      await removeLoyaltySettlementEffects(tx, tenantId, [...operationIds]);
      await tx.financeOperation.deleteMany({ where: { tenantId, operationId: { in: [...operationIds] } } });
    });
    return this.finance.snapshot(tenantId);
  }

  async operationKind(tenantId: string, operationId: string) {
    const row = await this.prisma.financeOperation.findUnique({
      where: { tenantId_operationId: { tenantId, operationId: text(operationId) } },
      select: { kind: true },
    });
    return text(row?.kind);
  }
}

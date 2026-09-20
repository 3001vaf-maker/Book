import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
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

function dateValue(value: unknown, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date : fallback;
}

function sourceValue(value: unknown) {
  const source = objectValue(value);
  return { type: text(source.type), id: text(source.id) };
}

function normalizeSettlement(value: unknown) {
  const source = objectValue(value);
  const items = arrayValue(source.items).map((item) => {
    const row = objectValue(item);
    const price = money(row.price ?? row.cost);
    const discountMoney = Math.min(price, money(row.discountMoney));
    const planAmount = Math.max(0, money(row.planAmount ?? (price - discountMoney)));
    return {
      sourceType: text(row.sourceType) || 'procedure',
      sourceId: text(row.sourceId ?? row.id),
      name: text(row.name),
      price,
      discountMode: ['percent', 'money', 'none'].includes(text(row.discountMode)) ? text(row.discountMode) : 'none',
      discountPercent: percent(row.discountPercent),
      discountMoney,
      planAmount,
    };
  });
  const serviceTotal = money(source.serviceTotal ?? items.reduce((sum, item) => sum + item.price, 0));
  const discountTotal = money(source.discountTotal ?? items.reduce((sum, item) => sum + item.discountMoney, 0));
  const planTotal = money(source.planTotal ?? source.dueTotal ?? items.reduce((sum, item) => sum + item.planAmount, 0));
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

function allocationsValue(value: unknown) {
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

function splitAllocationComponents(allocations: JsonObject[], serviceAmount: number, tips: number) {
  let serviceLeft = money(serviceAmount);
  let tipsLeft = money(tips);
  const entries: JsonObject[] = [];
  for (const allocation of allocations) {
    let walletLeft = money(allocation.amount);
    const service = Math.min(walletLeft, serviceLeft);
    if (service > 0) {
      entries.push({
        walletId: allocation.walletId,
        walletName: allocation.walletName,
        amount: service,
        component: 'service',
      });
      walletLeft = money(walletLeft - service);
      serviceLeft = money(serviceLeft - service);
    }
    const tip = Math.min(walletLeft, tipsLeft);
    if (tip > 0) {
      entries.push({
        walletId: allocation.walletId,
        walletName: allocation.walletName,
        amount: tip,
        component: 'tips',
      });
      tipsLeft = money(tipsLeft - tip);
    }
  }
  if (serviceLeft > 0.009 || tipsLeft > 0.009) throw new BadRequestException('Сумма по кошелькам не совпадает с оплатой');
  return entries;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  calculateSettlement(items: JsonObject[], discountValue: unknown = 0) {
    const discountPercent = percent(discountValue);
    const prepared = items.map((item) => {
      const price = money(item?.cost ?? item?.price);
      const discountMoney = money(price * discountPercent / 100);
      return {
        sourceType: text(item?.sourceType) || 'procedure',
        sourceId: text(item?.sourceId ?? item?.id),
        name: text(item?.name),
        price,
        discountMode: discountPercent > 0 ? 'percent' : 'none',
        discountPercent,
        discountMoney,
        planAmount: Math.max(0, money(price - discountMoney)),
      };
    });
    return {
      items: prepared,
      serviceTotal: money(prepared.reduce((sum, item) => sum + item.price, 0)),
      discountPercent,
      discountTotal: money(prepared.reduce((sum, item) => sum + item.discountMoney, 0)),
      planTotal: money(prepared.reduce((sum, item) => sum + item.planAmount, 0)),
    };
  }

  private async saveSettlementWith(db: Db, tenantId: string, sourceType: string, sourceId: string, value: unknown) {
    const settlement = validSettlement(value);
    if (!settlement) throw new BadRequestException('Расчёт не содержит суммы');
    const type = text(sourceType);
    const id = text(sourceId);
    if (!type || !id) throw new BadRequestException('У расчёта отсутствует источник');
    await db.financeSettlement.upsert({
      where: { tenantId_sourceType_sourceId: { tenantId, sourceType: type, sourceId: id } },
      create: { tenantId, sourceType: type, sourceId: id, data: json(settlement) },
      update: { data: json(settlement) },
    });
    return settlement;
  }

  async upsertSettlement(tenantId: string, sourceType: string, sourceId: string, value: unknown) {
    await this.ensureLegacyMigrated(tenantId);
    return this.saveSettlementWith(this.prisma, tenantId, sourceType, sourceId, value);
  }

  async settlementForSource(tenantId: string, sourceType: string, sourceId: string, fallback: unknown = null) {
    await this.ensureLegacyMigrated(tenantId);
    const type = text(sourceType);
    const id = text(sourceId);
    const row = await this.prisma.financeSettlement.findUnique({
      where: { tenantId_sourceType_sourceId: { tenantId, sourceType: type, sourceId: id } },
    });
    if (row) return normalizeSettlement(row.data);
    const settlement = validSettlement(fallback);
    if (!settlement) return null;
    return this.saveSettlementWith(this.prisma, tenantId, type, id, settlement);
  }

  async saveSettlement(tenantId: string, sourceType: string, sourceId: string, value: unknown) {
    await this.upsertSettlement(tenantId, sourceType, sourceId, value);
    return this.snapshot(tenantId, { skipMigration: true });
  }

  private async serviceNet(db: Db, tenantId: string, sourceType: string, sourceId: string) {
    const rows = await db.financeLedgerEntry.findMany({
      where: { tenantId, sourceType, sourceId },
      select: { direction: true, amount: true, data: true },
    });
    return money(rows.reduce((sum, row) => {
      if (text(objectValue(row.data).component) !== 'service') return sum;
      const amount = numberValue(row.amount);
      return sum + (row.direction === 'IN' ? amount : -amount);
    }, 0));
  }

  async recordSettlementPaymentState(tenantId: string, recordId: string, settlement: JsonObject) {
    await this.ensureLegacyMigrated(tenantId);
    const paid = Math.max(0, await this.serviceNet(this.prisma, tenantId, 'record', text(recordId)));
    const total = money(settlement?.planTotal);
    const due = Math.max(0, money(total - paid));
    return {
      state: due <= 0.009 ? 'paid' : paid > 0.009 ? 'partial' : 'unpaid',
      paid,
      due,
    };
  }

  private async createOperationWithEntries(db: Db, tenantId: string, {
    operationId,
    kind,
    status = 'completed',
    source,
    originalOperationId = '',
    occurredAt,
    data,
    entries,
  }: {
    operationId: string;
    kind: string;
    status?: string;
    source: { type: string; id: string };
    originalOperationId?: string;
    occurredAt: Date;
    data: JsonObject;
    entries: JsonObject[];
  }) {
    const existing = await db.financeOperation.findUnique({
      where: { tenantId_operationId: { tenantId, operationId } },
      include: { ledgerEntries: true },
    });
    if (existing) return existing;

    const operation = await db.financeOperation.create({
      data: {
        tenantId,
        operationId,
        kind,
        status,
        sourceType: source.type,
        sourceId: source.id,
        originalOperationId,
        occurredAt,
        data: json(data),
      },
    });

    for (const entry of entries) {
      await db.financeLedgerEntry.create({
        data: {
          tenantId,
          financeOperationId: operation.id,
          entryId: text(entry.entryId) || randomUUID(),
          walletId: text(entry.walletId),
          direction: text(entry.direction),
          economicType: text(entry.economicType),
          amount: money(entry.amount),
          occurredAt,
          sourceType: source.type,
          sourceId: source.id,
          data: json({
            walletName: text(entry.walletName),
            component: text(entry.component),
            relatedOperationId: text(entry.relatedOperationId),
          }),
        },
      });
    }

    return db.financeOperation.findUnique({
      where: { tenantId_operationId: { tenantId, operationId } },
      include: { ledgerEntries: true },
    });
  }

  private async migrateLegacyPayment(tx: Prisma.TransactionClient, tenantId: string, item: JsonObject, index: number) {
    const source = sourceValue(item.source);
    if (!source.type || !source.id) return;
    const operationId = text(item.id) || `legacy-payment-${index}`;
    const allocations = allocationsValue(item.allocations?.length ? item.allocations : [{
      walletId: item.walletId,
      walletName: item.walletName,
      amount: item.total,
    }]);
    if (!allocations.length) return;
    const total = money(item.total ?? allocations.reduce((sum, entry) => sum + entry.amount, 0));
    const tips = Math.min(total, money(item.tips));
    const serviceAmount = Math.min(total, money(item.serviceAmount ?? (total - tips)));
    const occurredAt = dateValue(item.paidAt ?? item.createdAt);
    const components = splitAllocationComponents(allocations, serviceAmount, tips);
    const settlement = validSettlement(item.finance);
    if (settlement) await this.saveSettlementWith(tx, tenantId, source.type, source.id, settlement);

    await this.createOperationWithEntries(tx, tenantId, {
      operationId,
      kind: 'payment',
      status: item.status === 'cancelled' ? 'cancelled' : 'completed',
      source,
      occurredAt,
      data: {
        workplace: text(item.workplace),
        person: clone(objectValue(item.person)),
        allocations,
        total,
        serviceAmount,
        tips,
        settlement,
        legacy: true,
      },
      entries: components.map((entry) => ({
        ...entry,
        direction: 'IN',
        economicType: entry.component === 'tips' ? 'TIPS' : 'SERVICE_REVENUE',
      })),
    });

    if (item.status === 'cancelled') {
      await this.createReversalFor(tx, tenantId, operationId, 'legacy-cancelled-payment', occurredAt);
    }
  }

  private async migrateLegacyExpense(tx: Prisma.TransactionClient, tenantId: string, item: JsonObject, index: number) {
    const source = sourceValue(item.source);
    if (!source.type || !source.id) return;
    const operationId = text(item.id) || `legacy-expense-${index}`;
    const total = money(item.total);
    if (total <= 0) return;
    const tips = Math.min(total, money(item.tips));
    const serviceAmount = Math.min(total, money(item.serviceAmount ?? (total - tips)));
    const occurredAt = dateValue(item.refundedAt ?? item.createdAt);
    const walletId = text(item.walletId);
    if (!walletId) return;
    const kind = text(item.expenseType) === 'refund' ? 'refund' : 'expense';
    const entries: JsonObject[] = [];
    if (serviceAmount > 0) entries.push({
      walletId,
      walletName: text(item.walletName),
      amount: serviceAmount,
      component: 'service',
      direction: 'OUT',
      economicType: kind === 'refund' ? 'SERVICE_REFUND' : 'EXPENSE',
    });
    if (tips > 0) entries.push({
      walletId,
      walletName: text(item.walletName),
      amount: tips,
      component: 'tips',
      direction: 'OUT',
      economicType: kind === 'refund' ? 'TIPS_REFUND' : 'EXPENSE',
    });

    await this.createOperationWithEntries(tx, tenantId, {
      operationId,
      kind,
      status: item.status === 'cancelled' ? 'cancelled' : 'completed',
      source,
      originalOperationId: text(item.originalPaymentId),
      occurredAt,
      data: {
        workplace: text(item.workplace),
        person: clone(objectValue(item.person)),
        walletId,
        walletName: text(item.walletName),
        total,
        serviceAmount,
        tips,
        reason: text(item.reason),
        settlement: validSettlement(item.finance),
        legacy: true,
      },
      entries,
    });

    if (item.status === 'cancelled') {
      await this.createReversalFor(tx, tenantId, operationId, 'legacy-cancelled-expense', occurredAt);
    }
  }

  private async createReversalFor(db: Db, tenantId: string, originalOperationId: string, reason: string, occurredAt = new Date()) {
    const original = await db.financeOperation.findUnique({
      where: { tenantId_operationId: { tenantId, operationId: originalOperationId } },
      include: { ledgerEntries: true },
    });
    if (!original) return null;
    const reversalId = `cancel-${originalOperationId}`;
    return this.createOperationWithEntries(db, tenantId, {
      operationId: reversalId,
      kind: 'cancel',
      source: { type: original.sourceType, id: original.sourceId },
      originalOperationId: original.operationId,
      occurredAt,
      data: { reason, cancelledOperationId: original.operationId },
      entries: original.ledgerEntries.map((entry) => ({
        walletId: entry.walletId,
        walletName: text(objectValue(entry.data).walletName),
        amount: numberValue(entry.amount),
        component: text(objectValue(entry.data).component),
        direction: entry.direction === 'IN' ? 'OUT' : 'IN',
        economicType: 'REVERSAL',
        relatedOperationId: original.operationId,
      })),
    });
  }

  private async ensureLegacyMigrated(tenantId: string) {
    const auxiliary = await this.prisma.businessAuxiliaryState.findUnique({ where: { tenantId } });
    const bundle = objectValue(auxiliary?.data);
    const legacy = objectValue(bundle.finance);
    const alreadyMarked = Boolean(legacy.canonicalLedgerMigratedAt);

    const records = await this.prisma.record.findMany({ where: { tenantId } });
    const recordsWithSettlement = records.filter((row) => validSettlement(objectValue(row.data).finance));

    if (alreadyMarked && !recordsWithSettlement.length) return;

    await this.prisma.$transaction(async (tx) => {
      for (const row of recordsWithSettlement) {
        const record = clone(objectValue(row.data));
        const settlement = validSettlement(record.finance);
        if (settlement) await this.saveSettlementWith(tx, tenantId, 'record', text(record.id ?? row.recordId), settlement);
        delete record.finance;
        await tx.record.update({ where: { id: row.id }, data: { data: json(record) } });
      }

      if (!alreadyMarked) {
        for (const [index, item] of arrayValue(legacy.income).entries()) {
          await this.migrateLegacyPayment(tx, tenantId, objectValue(item), index);
        }
        for (const [index, item] of arrayValue(legacy.expense).entries()) {
          await this.migrateLegacyExpense(tx, tenantId, objectValue(item), index);
        }
        if (auxiliary) {
          const nextFinance = { ...legacy, canonicalLedgerMigratedAt: new Date().toISOString() };
          const nextBundle = { ...bundle, finance: nextFinance };
          await tx.businessAuxiliaryState.update({ where: { tenantId }, data: { data: json(nextBundle) } });
        }
      }
    });
  }

  async recordPayment(tenantId: string, body: unknown) {
    await this.ensureLegacyMigrated(tenantId);
    const input = objectValue(body);
    const source = sourceValue(input.source);
    if (!source.type || !source.id) throw new BadRequestException('У оплаты отсутствует источник');
    const settlement = validSettlement(input.settlement);
    if (!settlement) throw new BadRequestException('У оплаты отсутствует расчёт');
    const allocations = allocationsValue(input.allocations);
    if (!allocations.length) throw new BadRequestException('Не выбран кошелёк');

    const allocated = money(allocations.reduce((sum, entry) => sum + entry.amount, 0));
    const tips = Math.min(allocated, money(input.tips));
    const serviceAmount = money(input.serviceAmount == null ? allocated - tips : input.serviceAmount);
    if (serviceAmount <= 0 || money(serviceAmount + tips) !== allocated) {
      throw new BadRequestException('Сумма оплаты не совпадает с распределением по кошелькам');
    }

    const operationId = randomUUID();
    const occurredAt = dateValue(input.occurredAt);
    await this.prisma.$transaction(async (tx) => {
      await this.saveSettlementWith(tx, tenantId, source.type, source.id, settlement);
      const paid = Math.max(0, await this.serviceNet(tx, tenantId, source.type, source.id));
      const due = Math.max(0, money(settlement.planTotal - paid));
      if (serviceAmount > due + 0.009) throw new BadRequestException('Оплата превышает остаток к оплате');

      const components = splitAllocationComponents(allocations, serviceAmount, tips);
      await this.createOperationWithEntries(tx, tenantId, {
        operationId,
        kind: 'payment',
        source,
        occurredAt,
        data: {
          workplace: text(input.workplace),
          person: clone(objectValue(input.person)),
          allocations,
          total: allocated,
          serviceAmount,
          tips,
          settlement,
        },
        entries: components.map((entry) => ({
          ...entry,
          direction: 'IN',
          economicType: entry.component === 'tips' ? 'TIPS' : 'SERVICE_REVENUE',
        })),
      });
    });
    return this.snapshot(tenantId, { skipMigration: true });
  }

  async recordRefund(tenantId: string, operationId: string, body: unknown) {
    await this.ensureLegacyMigrated(tenantId);
    const id = text(operationId);
    const payment = await this.prisma.financeOperation.findUnique({
      where: { tenantId_operationId: { tenantId, operationId: id } },
    });
    if (!payment || payment.kind !== 'payment') throw new NotFoundException('Оплата не найдена');
    if (payment.status === 'cancelled') throw new BadRequestException('Отменённую оплату вернуть нельзя');

    const paymentData = objectValue(payment.data);
    const refunds = await this.prisma.financeOperation.findMany({
      where: { tenantId, kind: 'refund', originalOperationId: id, status: 'completed' },
    });
    const refundedTips = money(refunds.reduce((sum, row) => sum + money(objectValue(row.data).tips), 0));
    const refundedService = money(refunds.reduce((sum, row) => sum + money(objectValue(row.data).serviceAmount), 0));
    const tipsRemaining = Math.max(0, money(paymentData.tips - refundedTips));
    const serviceRemaining = Math.max(0, money(paymentData.serviceAmount - refundedService));
    const remaining = money(tipsRemaining + serviceRemaining);
    if (remaining <= 0.009) throw new BadRequestException('Оплата уже возвращена полностью');

    const input = objectValue(body);
    const requested = Math.min(remaining, money(input.amount == null ? remaining : input.amount));
    if (requested <= 0) throw new BadRequestException('Некорректная сумма возврата');
    const tips = Math.min(requested, tipsRemaining);
    const serviceAmount = Math.min(money(requested - tips), serviceRemaining);
    const walletId = text(input.walletId);
    const walletName = text(input.walletName);
    if (!walletId) throw new BadRequestException('Не выбран кошелёк возврата');
    const refundId = randomUUID();
    const occurredAt = dateValue(input.occurredAt);

    await this.prisma.$transaction(async (tx) => {
      await this.createOperationWithEntries(tx, tenantId, {
        operationId: refundId,
        kind: 'refund',
        source: { type: payment.sourceType, id: payment.sourceId },
        originalOperationId: payment.operationId,
        occurredAt,
        data: {
          workplace: text(paymentData.workplace),
          person: clone(objectValue(paymentData.person)),
          walletId,
          walletName,
          total: money(serviceAmount + tips),
          serviceAmount,
          tips,
          reason: text(input.reason),
          settlement: clone(objectValue(paymentData.settlement)),
        },
        entries: [
          ...(serviceAmount > 0 ? [{
            walletId, walletName, amount: serviceAmount, component: 'service', direction: 'OUT', economicType: 'SERVICE_REFUND',
          }] : []),
          ...(tips > 0 ? [{
            walletId, walletName, amount: tips, component: 'tips', direction: 'OUT', economicType: 'TIPS_REFUND',
          }] : []),
        ],
      });
    });

    return this.snapshot(tenantId, { skipMigration: true });
  }

  async cancelOperation(tenantId: string, operationId: string, body: unknown) {
    await this.ensureLegacyMigrated(tenantId);
    const id = text(operationId);
    const input = objectValue(body);
    const original = await this.prisma.financeOperation.findUnique({
      where: { tenantId_operationId: { tenantId, operationId: id } },
    });
    if (!original) throw new NotFoundException('Операция не найдена');
    if (original.status === 'cancelled') return this.snapshot(tenantId, { skipMigration: true });

    await this.prisma.$transaction(async (tx) => {
      const targets = [original];
      if (original.kind === 'payment') {
        const refunds = await tx.financeOperation.findMany({
          where: { tenantId, kind: 'refund', originalOperationId: original.operationId, status: 'completed' },
        });
        targets.push(...refunds);
      }

      for (const target of targets) {
        await this.createReversalFor(tx, tenantId, target.operationId, text(input.reason) || 'incorrect-entry', new Date());
        await tx.financeOperation.update({ where: { id: target.id }, data: { status: 'cancelled' } });
      }
    });

    return this.snapshot(tenantId, { skipMigration: true });
  }

  private legacyReadModel(operation: any) {
    if (operation.kind === 'cancel') return null;
    const data = objectValue(operation.data);
    const source = { type: operation.sourceType, id: operation.sourceId };
    const base = {
      id: operation.operationId,
      status: operation.status,
      source,
      workplace: text(data.workplace),
      person: clone(objectValue(data.person)),
      total: money(data.total),
      serviceAmount: money(data.serviceAmount),
      tips: money(data.tips),
      finance: clone(objectValue(data.settlement)),
      createdAt: operation.occurredAt.toISOString(),
    };
    if (operation.kind === 'payment') {
      return {
        ...base,
        movementType: 'income',
        incomeType: 'payment',
        allocations: arrayValue(data.allocations).map((entry) => clone(objectValue(entry))),
        walletId: arrayValue(data.allocations).length === 1 ? text(objectValue(data.allocations[0]).walletId) : '',
        walletName: arrayValue(data.allocations).length === 1 ? text(objectValue(data.allocations[0]).walletName) : '',
        paidAt: operation.occurredAt.toISOString(),
      };
    }
    return {
      ...base,
      movementType: 'expense',
      expenseType: operation.kind === 'refund' ? 'refund' : 'expense',
      originalPaymentId: operation.originalOperationId,
      walletId: text(data.walletId),
      walletName: text(data.walletName),
      reason: text(data.reason),
      refundedAt: operation.occurredAt.toISOString(),
    };
  }

  async snapshot(tenantId: string, { skipMigration = false } = {}) {
    if (!skipMigration) await this.ensureLegacyMigrated(tenantId);
    const [settlements, operations, ledger] = await Promise.all([
      this.prisma.financeSettlement.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.financeOperation.findMany({ where: { tenantId }, orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.financeLedgerEntry.findMany({ where: { tenantId }, orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }] }),
    ]);

    const operationRows = operations.map((row) => ({
      operationId: row.operationId,
      kind: row.kind,
      status: row.status,
      source: { type: row.sourceType, id: row.sourceId },
      originalOperationId: row.originalOperationId,
      occurredAt: row.occurredAt.toISOString(),
      data: clone(row.data),
    }));
    const ledgerRows = ledger.map((row) => ({
      entryId: row.entryId,
      operationId: operations.find((operation) => operation.id === row.financeOperationId)?.operationId || '',
      walletId: row.walletId,
      walletName: text(objectValue(row.data).walletName),
      direction: row.direction,
      economicType: row.economicType,
      amount: numberValue(row.amount),
      occurredAt: row.occurredAt.toISOString(),
      source: { type: row.sourceType, id: row.sourceId },
      component: text(objectValue(row.data).component),
      relatedOperationId: text(objectValue(row.data).relatedOperationId),
    }));
    const compatibility = operations.map((row) => this.legacyReadModel(row)).filter(Boolean) as JsonObject[];
    return {
      version: 6,
      settlements: settlements.map((row) => ({
        source: { type: row.sourceType, id: row.sourceId },
        settlement: clone(row.data),
      })),
      operations: operationRows,
      ledger: ledgerRows,
      income: compatibility.filter((row) => row.movementType === 'income'),
      expense: compatibility.filter((row) => row.movementType === 'expense'),
    };
  }
}

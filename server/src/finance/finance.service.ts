import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

function discountMode(item: JsonObject, defaultPercent = 0) {
  const explicit = text(item.discountMode);
  if (['percent', 'money', 'none'].includes(explicit)) return explicit;
  if (item.discountPercent !== '' && item.discountPercent != null && percent(item.discountPercent) > 0) return 'percent';
  if (item.discountMoney !== '' && item.discountMoney != null && money(item.discountMoney) > 0) return 'money';
  return defaultPercent > 0 ? 'percent' : 'none';
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

const DEFAULT_FINANCE_ARTICLES = [
  { articleId: 'system-income', parentArticleId: '', name: 'Доходы', direction: 'IN', economicType: 'GROUP', systemKey: 'INCOME_ROOT', position: 10 },
  { articleId: 'system-service-revenue', parentArticleId: 'system-income', name: 'Услуги', direction: 'IN', economicType: 'OPERATING_REVENUE', systemKey: 'SERVICE_REVENUE', position: 20 },
  { articleId: 'system-product-revenue', parentArticleId: 'system-income', name: 'Продажа товаров', direction: 'IN', economicType: 'PRODUCT_REVENUE', systemKey: 'PRODUCT_REVENUE', position: 30 },
  { articleId: 'system-other-income', parentArticleId: 'system-income', name: 'Прочие доходы', direction: 'IN', economicType: 'OPERATING_REVENUE', systemKey: 'OTHER_INCOME', position: 40 },
  { articleId: 'system-tips', parentArticleId: 'system-income', name: 'Чаевые', direction: 'IN', economicType: 'TIPS', systemKey: 'TIPS', position: 50 },
  { articleId: 'system-loan-received', parentArticleId: 'system-income', name: 'Займ', direction: 'IN', economicType: 'LOAN_RECEIVED', systemKey: 'LOAN_RECEIVED', position: 60 },
  { articleId: 'system-investment-received', parentArticleId: 'system-income', name: 'Инвестиции', direction: 'IN', economicType: 'INVESTMENT_RECEIVED', systemKey: 'INVESTMENT_RECEIVED', position: 70 },
  { articleId: 'system-expense', parentArticleId: '', name: 'Расходы', direction: 'OUT', economicType: 'GROUP', systemKey: 'EXPENSE_ROOT', position: 100 },
  { articleId: 'system-materials', parentArticleId: 'system-expense', name: 'Материалы', direction: 'OUT', economicType: 'OPERATING_EXPENSE', systemKey: 'MATERIALS', position: 110 },
  { articleId: 'system-rent', parentArticleId: 'system-expense', name: 'Аренда', direction: 'OUT', economicType: 'OPERATING_EXPENSE', systemKey: 'RENT', position: 120 },
  { articleId: 'system-tax', parentArticleId: 'system-expense', name: 'Налог', direction: 'OUT', economicType: 'TAX', systemKey: 'TAX', position: 130 },
  { articleId: 'system-other-expense', parentArticleId: 'system-expense', name: 'Прочие расходы', direction: 'OUT', economicType: 'OPERATING_EXPENSE', systemKey: 'OTHER_EXPENSE', position: 140 },
  { articleId: 'system-refund', parentArticleId: 'system-expense', name: 'Возврат', direction: 'OUT', economicType: 'REFUND', systemKey: 'REFUND', position: 150 },
  { articleId: 'system-loan-repayment', parentArticleId: 'system-expense', name: 'Возврат займа', direction: 'OUT', economicType: 'LOAN_REPAYMENT', systemKey: 'LOAN_REPAYMENT', position: 160 },
  { articleId: 'system-investment-return', parentArticleId: 'system-expense', name: 'Возврат инвестиций', direction: 'OUT', economicType: 'INVESTMENT_RETURN', systemKey: 'INVESTMENT_RETURN', position: 170 },
  { articleId: 'system-transfer', parentArticleId: '', name: 'Перевод между кошельками', direction: 'TRANSFER', economicType: 'TRANSFER', systemKey: 'TRANSFER', position: 200 },
] as const;

const ARTICLE_DIRECTIONS = new Set(['IN', 'OUT', 'TRANSFER']);
const ARTICLE_ECONOMIC_TYPES = new Set([
  'GROUP',
  'OPERATING_REVENUE',
  'PRODUCT_REVENUE',
  'OPERATING_EXPENSE',
  'TAX',
  'TIPS',
  'REFUND',
  'LOAN_RECEIVED',
  'LOAN_REPAYMENT',
  'INVESTMENT_RECEIVED',
  'INVESTMENT_RETURN',
  'TRANSFER',
]);

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

  private async serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        lastError = error;
        if (!isRetryableTransactionError(error) || attempt === 2) throw error;
      }
    }
    throw lastError;
  }

  calculateSettlement(items: JsonObject[], discountValue: unknown = 0) {
    const defaultPercent = percent(discountValue);
    const prepared = items.map((item) => {
      const price = money(item?.cost ?? item?.price);
      const mode = discountMode(item, defaultPercent);
      const selectedPercent = mode === 'percent'
        ? percent(item?.discountPercent === '' || item?.discountPercent == null ? defaultPercent : item.discountPercent)
        : 0;
      const discountMoney = Math.min(price, money(
        mode === 'money' ? item?.discountMoney : price * selectedPercent / 100,
      ));
      const resolvedPercent = price > 0
        ? (mode === 'money' ? discountMoney / price * 100 : selectedPercent)
        : 0;
      return {
        sourceType: text(item?.sourceType) || 'procedure',
        sourceId: text(item?.sourceId ?? item?.id),
        name: text(item?.name),
        price,
        discountMode: mode,
        discountPercent: percent(resolvedPercent),
        discountMoney,
        planAmount: Math.max(0, money(price - discountMoney)),
      };
    });
    const percents = [...new Set(prepared.map((item) => Math.round(item.discountPercent * 10000) / 10000))];
    return {
      items: prepared,
      serviceTotal: money(prepared.reduce((sum, item) => sum + item.price, 0)),
      discountPercent: percents.length === 1 ? percents[0] : null,
      discountTotal: money(prepared.reduce((sum, item) => sum + item.discountMoney, 0)),
      planTotal: money(prepared.reduce((sum, item) => sum + item.planAmount, 0)),
    };
  }

  repriceSettlement(items: JsonObject[], current: unknown, discountValue: unknown = 0) {
    const previous = normalizeSettlement(current);
    const priorItems = arrayValue(previous.items);
    const bySource = new Map(priorItems.map((item) => [
      `${text(item?.sourceType) || 'procedure'}:${text(item?.sourceId)}`,
      objectValue(item),
    ]));
    const defaultPercent = previous.discountPercent == null ? percent(discountValue) : percent(previous.discountPercent);
    const repriced = items.map((item) => {
      const sourceType = text(item?.sourceType) || 'procedure';
      const sourceId = text(item?.sourceId ?? item?.id);
      const prior = bySource.get(`${sourceType}:${sourceId}`) || null;
      const base = {
        ...item,
        sourceType,
        sourceId,
      };
      if (!prior) return { ...base, discountMode: defaultPercent > 0 ? 'percent' : 'none', discountPercent: defaultPercent };
      if (prior.discountMode === 'money') {
        return { ...base, discountMode: 'money', discountMoney: prior.discountMoney };
      }
      if (prior.discountMode === 'percent' || numberValue(prior.discountPercent) > 0) {
        return { ...base, discountMode: 'percent', discountPercent: prior.discountPercent };
      }
      return { ...base, discountMode: 'none', discountPercent: 0, discountMoney: 0 };
    });
    return this.calculateSettlement(repriced, defaultPercent);
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
    return this.saveSettlementWith(this.prisma, tenantId, sourceType, sourceId, value);
  }

  async settlementForSource(tenantId: string, sourceType: string, sourceId: string, fallback: unknown = null) {
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
    const settlement = validSettlement(value);
    if (!settlement) throw new BadRequestException('Расчёт не содержит суммы');
    const type = text(sourceType);
    const id = text(sourceId);
    if (!type || !id) throw new BadRequestException('У расчёта отсутствует источник');

    await this.serializable(async (tx) => {
      const paid = Math.max(0, await this.serviceNet(tx, tenantId, type, id));
      if (money(settlement.planTotal) + 0.009 < paid) {
        throw new BadRequestException('Расчёт нельзя уменьшить ниже уже оплаченной суммы. Сначала выполните возврат или отмените ошибочную оплату.');
      }
      await this.saveSettlementWith(tx, tenantId, type, id, settlement);
    });
    return this.snapshot(tenantId);
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
            articleId: text(entry.articleId),
            articleName: text(entry.articleName),
            lineName: text(entry.lineName),
            quantity: entry.quantity == null ? null : numberValue(entry.quantity),
            unitPrice: entry.unitPrice == null ? null : money(entry.unitPrice),
            note: text(entry.note),
          }),
        },
      });
    }

    return db.financeOperation.findUnique({
      where: { tenantId_operationId: { tenantId, operationId } },
      include: { ledgerEntries: true },
    });
  }



  private async createReversalFor(db: Db, tenantId: string, originalOperationId: string, reason: string, occurredAt: Date) {
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


  private async ensureDefaultArticles(tenantId: string, db: Db = this.prisma) {
    const existing = await db.financeArticle.findMany({
      where: { tenantId, systemKey: { not: '' } },
      select: { systemKey: true },
    });
    const keys = new Set(existing.map((row) => row.systemKey));
    for (const item of DEFAULT_FINANCE_ARTICLES) {
      if (keys.has(item.systemKey)) continue;
      await db.financeArticle.create({ data: { tenantId, ...item } });
    }
  }

  private articleDto(row: any) {
    return {
      articleId: row.articleId,
      parentArticleId: row.parentArticleId,
      name: row.name,
      direction: row.direction,
      economicType: row.economicType,
      systemKey: row.systemKey,
      position: row.position,
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : '',
    };
  }

  async listArticles(tenantId: string) {
    await this.ensureDefaultArticles(tenantId);
    const rows = await this.prisma.financeArticle.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.articleDto(row));
  }

  async createArticle(tenantId: string, body: unknown) {
    await this.ensureDefaultArticles(tenantId);
    const input = objectValue(body);
    const name = text(input.name);
    if (!name) throw new BadRequestException('Введите название статьи');
    const parentArticleId = text(input.parentArticleId);
    const parent = parentArticleId
      ? await this.prisma.financeArticle.findUnique({
          where: { tenantId_articleId: { tenantId, articleId: parentArticleId } },
        })
      : null;
    if (parentArticleId && (!parent || parent.archivedAt)) throw new BadRequestException('Родительская статья не найдена');

    const direction = text(input.direction || parent?.direction);
    const economicType = text(input.economicType || parent?.economicType);
    if (!ARTICLE_DIRECTIONS.has(direction)) throw new BadRequestException('Некорректное направление статьи');
    if (!ARTICLE_ECONOMIC_TYPES.has(economicType) || economicType === 'GROUP') {
      throw new BadRequestException('Выберите экономический характер статьи');
    }
    if (parent && parent.direction !== direction) throw new BadRequestException('Направление дочерней статьи должно совпадать с родительской');

    const max = await this.prisma.financeArticle.aggregate({ where: { tenantId, parentArticleId }, _max: { position: true } });
    const row = await this.prisma.financeArticle.create({
      data: {
        tenantId,
        articleId: randomUUID(),
        parentArticleId,
        name,
        direction,
        economicType,
        position: (max._max.position || 0) + 10,
      },
    });
    return this.snapshot(tenantId);
  }

  async updateArticle(tenantId: string, articleId: string, body: unknown) {
    await this.ensureDefaultArticles(tenantId);
    const id = text(articleId);
    const current = await this.prisma.financeArticle.findUnique({
      where: { tenantId_articleId: { tenantId, articleId: id } },
    });
    if (!current || current.archivedAt) throw new NotFoundException('Статья не найдена');
    const input = objectValue(body);
    const name = text(input.name || current.name);
    if (!name) throw new BadRequestException('Введите название статьи');
    const parentArticleId = input.parentArticleId == null ? current.parentArticleId : text(input.parentArticleId);
    if (parentArticleId === id) throw new BadRequestException('Статья не может быть родителем самой себе');
    const parent = parentArticleId
      ? await this.prisma.financeArticle.findUnique({ where: { tenantId_articleId: { tenantId, articleId: parentArticleId } } })
      : null;
    if (parentArticleId && (!parent || parent.archivedAt)) throw new BadRequestException('Родительская статья не найдена');
    let ancestor = parent;
    let depthGuard = 0;
    while (ancestor && depthGuard < 100) {
      if (ancestor.articleId === id) throw new BadRequestException('Нельзя создать цикл в дереве статей');
      ancestor = ancestor.parentArticleId
        ? await this.prisma.financeArticle.findUnique({
            where: { tenantId_articleId: { tenantId, articleId: ancestor.parentArticleId } },
          })
        : null;
      depthGuard += 1;
    }

    const direction = current.systemKey ? current.direction : text(input.direction || current.direction);
    const economicType = current.systemKey ? current.economicType : text(input.economicType || current.economicType);
    if (!ARTICLE_DIRECTIONS.has(direction) || !ARTICLE_ECONOMIC_TYPES.has(economicType)) {
      throw new BadRequestException('Некорректный экономический характер статьи');
    }
    if (parent && parent.direction !== direction) throw new BadRequestException('Направление дочерней статьи должно совпадать с родительской');

    await this.prisma.financeArticle.update({
      where: { id: current.id },
      data: { name, parentArticleId, direction, economicType },
    });
    return this.snapshot(tenantId);
  }

  async archiveArticle(tenantId: string, articleId: string) {
    await this.ensureDefaultArticles(tenantId);
    const id = text(articleId);
    const current = await this.prisma.financeArticle.findUnique({
      where: { tenantId_articleId: { tenantId, articleId: id } },
    });
    if (!current || current.archivedAt) return this.snapshot(tenantId);
    if (current.systemKey) throw new BadRequestException('Системную статью удалить нельзя');
    const child = await this.prisma.financeArticle.findFirst({ where: { tenantId, parentArticleId: id, archivedAt: null } });
    if (child) throw new BadRequestException('Сначала удалите или перенесите вложенные статьи');
    await this.prisma.financeArticle.update({ where: { id: current.id }, data: { archivedAt: new Date() } });
    return this.snapshot(tenantId);
  }

  async recordManualOperation(tenantId: string, body: unknown) {
    await this.ensureDefaultArticles(tenantId);
    const input = objectValue(body);
    const direction = text(input.direction);
    if (!['IN', 'OUT'].includes(direction)) throw new BadRequestException('Для ручной операции выберите доход или расход');
    const walletId = text(input.walletId);
    const walletName = text(input.walletName);
    if (!walletId) throw new BadRequestException('Выберите кошелёк');

    const operationArticleId = text(input.articleId);
    const rawLines = arrayValue(input.lines);
    const simpleAmount = money(input.amount);
    const preparedLines = rawLines.length
      ? rawLines.map((value, index) => {
          const row = objectValue(value);
          const quantity = Math.max(0, numberValue(row.quantity || 1));
          const unitPrice = money(row.unitPrice ?? row.price);
          const total = money(quantity * unitPrice);
          return {
            lineName: text(row.name) || `Позиция ${index + 1}`,
            quantity,
            unitPrice,
            total,
            articleId: text(row.articleId || operationArticleId),
          };
        }).filter((row) => row.quantity > 0 && row.unitPrice > 0 && row.total > 0)
      : (simpleAmount > 0 ? [{
          lineName: text(input.name),
          quantity: 1,
          unitPrice: simpleAmount,
          total: simpleAmount,
          articleId: operationArticleId,
        }] : []);
    if (!preparedLines.length) throw new BadRequestException('Введите сумму или позиции');

    const articleIds = [...new Set(preparedLines.map((line) => line.articleId).filter(Boolean))];
    if (!articleIds.length) throw new BadRequestException('Выберите статью');
    const articles = await this.prisma.financeArticle.findMany({
      where: { tenantId, articleId: { in: articleIds }, archivedAt: null },
    });
    const articleById = new Map(articles.map((article) => [article.articleId, article]));
    for (const line of preparedLines) {
      const article = articleById.get(line.articleId);
      if (!article) throw new BadRequestException('Статья не найдена');
      if (article.economicType === 'GROUP') throw new BadRequestException('Выберите конечную статью, а не группу');
      if (article.direction !== direction) throw new BadRequestException('Статья не соответствует типу операции');
    }

    const operationId = randomUUID();
    const occurredAt = requiredOccurredAt(input.occurredAt);
    const total = money(preparedLines.reduce((sum, line) => sum + line.total, 0));
    const source = { type: 'manual', id: operationId };
    await this.serializable(async (tx) => {
      await this.createOperationWithEntries(tx, tenantId, {
        operationId,
        kind: direction === 'IN' ? 'manual-income' : 'manual-expense',
        source,
        occurredAt,
        data: {
          direction,
          articleId: operationArticleId,
          walletId,
          walletName,
          note: text(input.note),
          total,
          lines: preparedLines,
        },
        entries: preparedLines.map((line) => {
          const article = articleById.get(line.articleId)!;
          return {
            walletId,
            walletName,
            direction,
            economicType: article.economicType,
            amount: line.total,
            component: 'manual',
            articleId: article.articleId,
            articleName: article.name,
            lineName: line.lineName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            note: text(input.note),
          };
        }),
      });
    });
    return this.snapshot(tenantId);
  }

  async recordSpecialOperation(tenantId: string, body: unknown) {
    await this.ensureDefaultArticles(tenantId);
    const input = objectValue(body);
    const kind = text(input.kind);
    const amount = money(input.amount);
    if (amount <= 0) throw new BadRequestException('Введите сумму операции');

    const definitions: Record<string, {
      direction: 'IN' | 'OUT';
      economicType: string;
      systemKey: string;
      operationKind: string;
    }> = {
      'loan-received': { direction: 'IN', economicType: 'LOAN_RECEIVED', systemKey: 'LOAN_RECEIVED', operationKind: 'loan-received' },
      'loan-repayment': { direction: 'OUT', economicType: 'LOAN_REPAYMENT', systemKey: 'LOAN_REPAYMENT', operationKind: 'loan-repayment' },
      'investment-received': { direction: 'IN', economicType: 'INVESTMENT_RECEIVED', systemKey: 'INVESTMENT_RECEIVED', operationKind: 'investment-received' },
      'investment-return': { direction: 'OUT', economicType: 'INVESTMENT_RETURN', systemKey: 'INVESTMENT_RETURN', operationKind: 'investment-return' },
    };

    const occurredAt = requiredOccurredAt(input.occurredAt);
    const operationId = randomUUID();
    const note = text(input.note);
    const counterparty = text(input.counterparty);

    if (kind === 'transfer') {
      const fromWalletId = text(input.fromWalletId);
      const fromWalletName = text(input.fromWalletName);
      const toWalletId = text(input.toWalletId);
      const toWalletName = text(input.toWalletName);
      if (!fromWalletId || !toWalletId) throw new BadRequestException('Выберите оба кошелька');
      if (fromWalletId === toWalletId) throw new BadRequestException('Для перевода нужны разные кошельки');

      const article = await this.prisma.financeArticle.findFirst({
        where: { tenantId, systemKey: 'TRANSFER', archivedAt: null },
      });
      if (!article) throw new BadRequestException('Системная статья перевода не найдена');

      await this.serializable(async (tx) => {
        await this.createOperationWithEntries(tx, tenantId, {
          operationId,
          kind: 'transfer',
          source: { type: 'finance', id: operationId },
          occurredAt,
          data: {
            total: amount,
            fromWalletId,
            fromWalletName,
            toWalletId,
            toWalletName,
            note,
          },
          entries: [
            {
              walletId: fromWalletId,
              walletName: fromWalletName,
              direction: 'OUT',
              economicType: 'TRANSFER',
              amount,
              component: 'transfer-out',
              articleId: article.articleId,
              articleName: article.name,
              note,
            },
            {
              walletId: toWalletId,
              walletName: toWalletName,
              direction: 'IN',
              economicType: 'TRANSFER',
              amount,
              component: 'transfer-in',
              articleId: article.articleId,
              articleName: article.name,
              note,
            },
          ],
        });
      });

      return this.snapshot(tenantId);
    }

    const definition = definitions[kind];
    if (!definition) throw new BadRequestException('Неизвестный вид финансовой операции');
    const walletId = text(input.walletId);
    const walletName = text(input.walletName);
    if (!walletId) throw new BadRequestException('Выберите кошелёк');
    const article = await this.prisma.financeArticle.findFirst({
      where: { tenantId, systemKey: definition.systemKey, archivedAt: null },
    });
    if (!article) throw new BadRequestException('Системная статья операции не найдена');

    await this.serializable(async (tx) => {
      await this.createOperationWithEntries(tx, tenantId, {
        operationId,
        kind: definition.operationKind,
        source: { type: 'finance', id: operationId },
        occurredAt,
        data: {
          total: amount,
          walletId,
          walletName,
          counterparty,
          note,
          articleId: article.articleId,
        },
        entries: [{
          walletId,
          walletName,
          direction: definition.direction,
          economicType: definition.economicType,
          amount,
          component: kind,
          articleId: article.articleId,
          articleName: article.name,
          lineName: counterparty,
          quantity: 1,
          unitPrice: amount,
          note,
        }],
      });
    });

    return this.snapshot(tenantId);
  }

  async recordPayment(tenantId: string, body: unknown) {
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
    const occurredAt = requiredOccurredAt(input.occurredAt);
    await this.serializable(async (tx) => {
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
    return this.snapshot(tenantId);
  }

  async recordRefund(tenantId: string, operationId: string, body: unknown) {
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
    const serviceAmount = Math.min(requested, serviceRemaining);
    const tips = Math.min(money(requested - serviceAmount), tipsRemaining);
    const walletId = text(input.walletId);
    const walletName = text(input.walletName);
    if (!walletId) throw new BadRequestException('Не выбран кошелёк возврата');
    const refundId = randomUUID();
    const occurredAt = requiredOccurredAt(input.occurredAt);

    await this.serializable(async (tx) => {
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

    return this.snapshot(tenantId);
  }

  async cancelOperation(tenantId: string, operationId: string, body: unknown) {
    const id = text(operationId);
    const input = objectValue(body);
    const occurredAt = requiredOccurredAt(input.occurredAt);
    const original = await this.prisma.financeOperation.findUnique({
      where: { tenantId_operationId: { tenantId, operationId: id } },
    });
    if (!original) throw new NotFoundException('Операция не найдена');
    if (original.status === 'cancelled') return this.snapshot(tenantId);

    await this.serializable(async (tx) => {
      const targets = [original];
      if (original.kind === 'payment') {
        const refunds = await tx.financeOperation.findMany({
          where: { tenantId, kind: 'refund', originalOperationId: original.operationId, status: 'completed' },
        });
        targets.push(...refunds);
      }

      for (const target of targets) {
        await this.createReversalFor(tx, tenantId, target.operationId, text(input.reason) || 'incorrect-entry', occurredAt);
        await tx.financeOperation.update({ where: { id: target.id }, data: { status: 'cancelled' } });
      }
    });

    return this.snapshot(tenantId);
  }

  async hardDeleteWallet(tenantId: string, platformAccountId: string, walletId: string) {
    const accountId = text(platformAccountId);
    const id = text(walletId);
    if (!id) throw new BadRequestException('Касса не найдена');
    if (id === 'cash' || id === 'cashless') {
      throw new BadRequestException('Системную кассу полностью удалить нельзя');
    }

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { platformAccountId: accountId },
      select: { id: true },
    });
    if (!admin) throw new ForbiddenException('Полное удаление доступно только администратору платформы');

    await this.serializable(async (tx) => {
      const direct = await tx.financeOperation.findMany({
        where: {
          tenantId,
          ledgerEntries: { some: { walletId: id } },
        },
        select: { operationId: true },
      });
      const operationIds = new Set(direct.map((row) => row.operationId));
      let frontier = [...operationIds];

      while (frontier.length) {
        const related = await tx.financeOperation.findMany({
          where: {
            tenantId,
            originalOperationId: { in: frontier },
          },
          select: { operationId: true },
        });
        const next = related
          .map((row) => row.operationId)
          .filter((operationId) => !operationIds.has(operationId));
        next.forEach((operationId) => operationIds.add(operationId));
        frontier = next;
      }

      if (operationIds.size) {
        await tx.financeOperation.deleteMany({
          where: {
            tenantId,
            operationId: { in: [...operationIds] },
          },
        });
      }
    });

    return this.snapshot(tenantId);
  }

  async snapshot(tenantId: string) {
    await this.ensureDefaultArticles(tenantId);
    const [articles, settlements, operations, ledger] = await Promise.all([
      this.prisma.financeArticle.findMany({ where: { tenantId, archivedAt: null }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
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
      recordedAt: row.createdAt.toISOString(),
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
      recordedAt: row.createdAt.toISOString(),
      source: { type: row.sourceType, id: row.sourceId },
      component: text(objectValue(row.data).component),
      relatedOperationId: text(objectValue(row.data).relatedOperationId),
      articleId: text(objectValue(row.data).articleId),
      articleName: text(objectValue(row.data).articleName),
      lineName: text(objectValue(row.data).lineName),
      quantity: objectValue(row.data).quantity == null ? null : numberValue(objectValue(row.data).quantity),
      unitPrice: objectValue(row.data).unitPrice == null ? null : money(objectValue(row.data).unitPrice),
      note: text(objectValue(row.data).note),
    }));
    return {
      version: 7,
      articles: articles.map((row) => this.articleDto(row)),
      settlements: settlements.map((row) => ({
        source: { type: row.sourceType, id: row.sourceId },
        settlement: clone(row.data),
        recordedAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      operations: operationRows,
      ledger: ledgerRows,
    };
  }
}

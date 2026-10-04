import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';

type AnyRecord = Record<string, any>;
type Tx = AnyRecord;

type PreparedLine = {
  itemId: string;
  quantity: number;
  direction: 'IN' | 'OUT';
  unitCost: number | null;
  expectedQuantity: number | null;
  actualQuantity: number | null;
  note: string;
};

const OUT_KINDS = new Set(['CONSUMPTION', 'SALE', 'WRITE_OFF']);
const IN_KINDS = new Set(['RECEIPT', 'RETURN']);
const MOVEMENT_KINDS = new Set([...OUT_KINDS, ...IN_KINDS, 'ADJUSTMENT', 'CORRECTION']);

function objectValue(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function optionalText(value: unknown): string {
  return text(value);
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegative(value: unknown, fallback = 0): number {
  return Math.max(0, numberValue(value, fallback));
}

function nullableNonNegative(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = numberValue(value, NaN);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function dateValue(value: unknown, fallback = new Date()): Date {
  if (!value) return fallback;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function movementDirection(kind: string, quantity: number, explicit = ''): 'IN' | 'OUT' {
  if (explicit === 'IN' || explicit === 'OUT') return explicit;
  if (IN_KINDS.has(kind)) return 'IN';
  if (OUT_KINDS.has(kind)) return 'OUT';
  return quantity < 0 ? 'OUT' : 'IN';
}

function normalizedMovementLines(kind: string, value: unknown): PreparedLine[] {
  const rows = Array.isArray(value) ? value : [];
  return rows.map((raw) => {
    const row = objectValue(raw);
    const signed = numberValue(row.quantity, 0);
    const direction = movementDirection(kind, signed, text(row.direction).toUpperCase());
    return {
      itemId: text(row.itemId),
      quantity: Math.abs(signed),
      direction,
      unitCost: nullableNonNegative(row.unitCost),
      expectedQuantity: nullableNonNegative(row.expectedQuantity),
      actualQuantity: nullableNonNegative(row.actualQuantity),
      note: optionalText(row.note),
    };
  }).filter((row) => row.itemId && row.quantity > 0);
}

function decimalNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(tenantId: string) {
    const [items, lots, movements, lines] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { tenantId, archivedAt: null },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.inventoryLot.findMany({
        where: { tenantId, quantityRemaining: { gt: 0 } },
        orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.inventoryMovement.findMany({
        where: { tenantId },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: 600,
      }),
      this.prisma.inventoryMovementLine.findMany({
        where: { tenantId },
        orderBy: { position: 'asc' },
      }),
    ]);

    const balances = new Map<string, number>();
    lines.forEach((line: AnyRecord) => {
      const signed = line.direction === 'OUT' ? -decimalNumber(line.quantity) : decimalNumber(line.quantity);
      balances.set(line.inventoryItemId, (balances.get(line.inventoryItemId) || 0) + signed);
    });

    const itemByInternal = new Map(items.map((item: AnyRecord) => [item.id, item]));
    const linesByMovement = new Map<string, AnyRecord[]>();
    lines.forEach((line: AnyRecord) => {
      const group = linesByMovement.get(line.inventoryMovementId) || [];
      const item = itemByInternal.get(line.inventoryItemId) as AnyRecord | undefined;
      group.push({
        lineId: line.lineId,
        itemId: item?.itemId || '',
        name: item?.name || '',
        unit: item?.unit || '',
        direction: line.direction,
        quantity: decimalNumber(line.quantity),
        unitCost: decimalNumber(line.unitCost),
        amount: decimalNumber(line.amount),
        expectedQuantity: line.expectedQuantity == null ? null : decimalNumber(line.expectedQuantity),
        actualQuantity: line.actualQuantity == null ? null : decimalNumber(line.actualQuantity),
        note: line.note,
      });
      linesByMovement.set(line.inventoryMovementId, group);
    });

    return {
      items: items.map((item: AnyRecord) => ({
        itemId: item.itemId,
        name: item.name,
        unit: item.unit,
        category: item.category,
        sku: item.sku,
        barcode: item.barcode,
        location: item.location,
        supplier: item.supplier,
        minStock: item.minStock == null ? null : decimalNumber(item.minStock),
        targetStock: item.targetStock == null ? null : decimalNumber(item.targetStock),
        packageQuantity: item.packageQuantity == null ? null : decimalNumber(item.packageQuantity),
        lastPurchasePrice: item.lastPurchasePrice == null ? null : decimalNumber(item.lastPurchasePrice),
        trackLots: item.trackLots,
        canConsume: item.canConsume,
        canSell: item.canSell,
        balance: balances.get(item.id) || 0,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      lots: lots.map((lot: AnyRecord) => ({
        lotId: lot.lotId,
        itemId: (itemByInternal.get(lot.inventoryItemId) as AnyRecord | undefined)?.itemId || '',
        quantityReceived: decimalNumber(lot.quantityReceived),
        quantityRemaining: decimalNumber(lot.quantityRemaining),
        unitCost: decimalNumber(lot.unitCost),
        receivedAt: lot.receivedAt,
        expiresAt: lot.expiresAt,
        supplier: lot.supplier,
        note: lot.note,
      })),
      movements: movements.map((movement: AnyRecord) => ({
        movementId: movement.movementId,
        kind: movement.kind,
        status: movement.status,
        sourceType: movement.sourceType,
        sourceId: movement.sourceId,
        originalMovementId: movement.originalMovementId,
        personKey: movement.personKey,
        personUei: movement.personUei,
        recordId: movement.recordId,
        procedureKey: movement.procedureKey,
        workplaceKey: movement.workplaceKey,
        note: movement.note,
        occurredAt: movement.occurredAt,
        recordedAt: movement.createdAt,
        lines: linesByMovement.get(movement.id) || [],
      })),
    };
  }

  async createItem(tenantId: string, body: unknown) {
    const source = objectValue(body);
    const name = text(source.name);
    if (!name) throw new BadRequestException('Укажите наименование позиции');
    const unit = text(source.unit) || 'шт.';
    const itemId = text(source.itemId) || randomUUID();
    const initialQuantity = nonNegative(source.quantity);
    const purchasePrice = nullableNonNegative(source.purchasePrice ?? source.lastPurchasePrice);

    await this.prisma.$transaction(async (tx: Tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          tenantId,
          itemId,
          name,
          unit,
          category: optionalText(source.category),
          sku: optionalText(source.sku),
          barcode: optionalText(source.barcode),
          location: optionalText(source.location),
          supplier: optionalText(source.supplier),
          minStock: nullableNonNegative(source.minStock),
          targetStock: nullableNonNegative(source.targetStock),
          packageQuantity: nullableNonNegative(source.packageQuantity),
          lastPurchasePrice: purchasePrice,
          trackLots: source.trackLots !== false,
          canConsume: source.canConsume !== false,
          canSell: source.canSell === true,
          position: Number.isInteger(source.position) ? source.position : 0,
        },
      });

      if (initialQuantity > 0) {
        await this.createMovementInTx(tx, tenantId, {
          kind: 'RECEIPT',
          sourceType: 'initial-stock',
          sourceId: itemId,
          occurredAt: source.occurredAt,
          note: 'Начальный остаток',
          lines: [{ itemId, quantity: initialQuantity, unitCost: purchasePrice }],
        });
      }
    });

    return this.snapshot(tenantId);
  }

  async updateItem(tenantId: string, itemId: string, body: unknown) {
    const source = objectValue(body);
    const current = await this.prisma.inventoryItem.findFirst({ where: { tenantId, itemId, archivedAt: null } });
    if (!current) throw new NotFoundException('Позиция склада не найдена');

    const data: AnyRecord = {};
    if ('name' in source) {
      const name = text(source.name);
      if (!name) throw new BadRequestException('Укажите наименование позиции');
      data.name = name;
    }
    if ('unit' in source) data.unit = text(source.unit) || current.unit;
    for (const key of ['category', 'sku', 'barcode', 'location', 'supplier'] as const) {
      if (key in source) data[key] = optionalText(source[key]);
    }
    for (const key of ['minStock', 'targetStock', 'packageQuantity', 'lastPurchasePrice'] as const) {
      if (key in source) data[key] = nullableNonNegative(source[key]);
    }
    if ('trackLots' in source) data.trackLots = source.trackLots !== false;
    if ('canConsume' in source) data.canConsume = source.canConsume !== false;
    if ('canSell' in source) data.canSell = source.canSell === true;
    if ('position' in source && Number.isInteger(source.position)) data.position = source.position;
    if (source.archived === true) data.archivedAt = new Date();

    await this.prisma.inventoryItem.update({ where: { id: current.id }, data });
    return this.snapshot(tenantId);
  }

  async createMovement(tenantId: string, body: unknown) {
    await this.prisma.$transaction(async (tx: Tx) => {
      await this.createMovementInTx(tx, tenantId, objectValue(body));
    });
    return this.snapshot(tenantId);
  }

  async correctMovement(tenantId: string, movementId: string, body: unknown) {
    const source = objectValue(body);
    const original = await this.prisma.inventoryMovement.findFirst({
      where: { tenantId, movementId },
      include: { lines: { include: { item: true } } },
    });
    if (!original) throw new NotFoundException('Движение не найдено');

    const desired = normalizedMovementLines(original.kind, source.lines);
    if (!desired.length) throw new BadRequestException('В корректировке нет позиций');

    const currentByItem = new Map<string, { signed: number; unitCost: number }>();
    (original.lines as AnyRecord[]).forEach((line) => {
      const itemId = String(line.item?.itemId || '');
      const signed = line.direction === 'OUT' ? -decimalNumber(line.quantity) : decimalNumber(line.quantity);
      const row = currentByItem.get(itemId) || { signed: 0, unitCost: decimalNumber(line.unitCost) };
      row.signed += signed;
      if (!row.unitCost) row.unitCost = decimalNumber(line.unitCost);
      currentByItem.set(itemId, row);
    });

    const desiredByItem = new Map<string, { signed: number; unitCost: number | null }>();
    desired.forEach((line) => {
      const signed = line.direction === 'OUT' ? -line.quantity : line.quantity;
      const row = desiredByItem.get(line.itemId) || { signed: 0, unitCost: line.unitCost };
      row.signed += signed;
      if (row.unitCost == null && line.unitCost != null) row.unitCost = line.unitCost;
      desiredByItem.set(line.itemId, row);
    });

    const itemIds = new Set([...currentByItem.keys(), ...desiredByItem.keys()]);
    const deltaLines: AnyRecord[] = [];
    itemIds.forEach((itemId) => {
      const before = currentByItem.get(itemId)?.signed || 0;
      const after = desiredByItem.get(itemId)?.signed || 0;
      const delta = after - before;
      if (Math.abs(delta) < 0.000001) return;
      deltaLines.push({
        itemId,
        quantity: delta,
        unitCost: delta > 0
          ? (desiredByItem.get(itemId)?.unitCost ?? currentByItem.get(itemId)?.unitCost ?? null)
          : null,
      });
    });
    if (!deltaLines.length) return this.snapshot(tenantId);

    await this.prisma.$transaction(async (tx: Tx) => {
      await this.createMovementInTx(tx, tenantId, {
        kind: 'CORRECTION',
        sourceType: 'inventory-correction',
        sourceId: movementId,
        originalMovementId: movementId,
        personKey: original.personKey,
        personUei: original.personUei,
        recordId: original.recordId,
        procedureKey: original.procedureKey,
        workplaceKey: original.workplaceKey,
        occurredAt: source.occurredAt || new Date(),
        note: optionalText(source.note) || 'Корректировка движения',
        lines: deltaLines,
      });
    });

    return this.snapshot(tenantId);
  }

  private async createMovementInTx(tx: Tx, tenantId: string, raw: AnyRecord) {
    const kind = text(raw.kind).toUpperCase();
    if (!MOVEMENT_KINDS.has(kind)) throw new BadRequestException('Неизвестный тип складского движения');
    const lines = normalizedMovementLines(kind, raw.lines);
    if (!lines.length) throw new BadRequestException('Добавьте хотя бы одну позицию');

    const requestedIds = [...new Set(lines.map((line) => line.itemId))];
    const items = await tx.inventoryItem.findMany({
      where: { tenantId, itemId: { in: requestedIds }, archivedAt: null },
    });
    const itemById = new Map((items as AnyRecord[]).map((item) => [item.itemId, item]));
    if (itemById.size !== requestedIds.length) throw new BadRequestException('Одна из позиций склада не найдена');

    const movement = await tx.inventoryMovement.create({
      data: {
        tenantId,
        movementId: text(raw.movementId) || randomUUID(),
        kind,
        status: 'completed',
        sourceType: optionalText(raw.sourceType),
        sourceId: optionalText(raw.sourceId),
        originalMovementId: optionalText(raw.originalMovementId),
        personKey: optionalText(raw.personKey),
        personUei: optionalText(raw.personUei),
        recordId: optionalText(raw.recordId),
        procedureKey: optionalText(raw.procedureKey),
        workplaceKey: optionalText(raw.workplaceKey),
        note: optionalText(raw.note),
        occurredAt: dateValue(raw.occurredAt),
      },
    });

    for (let position = 0; position < lines.length; position += 1) {
      const line = lines[position];
      const item = itemById.get(line.itemId) as AnyRecord;
      if (line.direction === 'IN') {
        const unitCost = line.unitCost ?? decimalNumber(item.lastPurchasePrice);
        const lineRow = await tx.inventoryMovementLine.create({
          data: {
            tenantId,
            inventoryMovementId: movement.id,
            inventoryItemId: item.id,
            lineId: randomUUID(),
            position,
            direction: 'IN',
            quantity: line.quantity,
            unitCost,
            amount: line.quantity * unitCost,
            expectedQuantity: line.expectedQuantity,
            actualQuantity: line.actualQuantity,
            note: line.note,
          },
        });
        const lot = await tx.inventoryLot.create({
          data: {
            tenantId,
            lotId: randomUUID(),
            inventoryItemId: item.id,
            quantityReceived: line.quantity,
            quantityRemaining: line.quantity,
            unitCost,
            receivedAt: movement.occurredAt,
            expiresAt: raw.expiresAt ? dateValue(raw.expiresAt) : null,
            supplier: optionalText(raw.supplier) || item.supplier,
            note: line.note,
          },
        });
        await tx.inventoryMovementAllocation.create({
          data: {
            tenantId,
            inventoryMovementLineId: lineRow.id,
            inventoryLotId: lot.id,
            allocationId: randomUUID(),
            quantity: line.quantity,
            unitCost,
            amount: line.quantity * unitCost,
          },
        });
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { lastPurchasePrice: unitCost },
        });
        continue;
      }

      const lots = await tx.inventoryLot.findMany({
        where: { tenantId, inventoryItemId: item.id, quantityRemaining: { gt: 0 } },
        orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }],
      });
      const available = (lots as AnyRecord[]).reduce((sum, lot) => sum + decimalNumber(lot.quantityRemaining), 0);
      if (available + 0.000001 < line.quantity) {
        throw new BadRequestException(`Недостаточно остатка: ${item.name}`);
      }

      let remaining = line.quantity;
      let cost = 0;
      const allocations: Array<{ lot: AnyRecord; quantity: number; unitCost: number }> = [];
      for (const lot of lots as AnyRecord[]) {
        if (remaining <= 0.000001) break;
        const quantity = Math.min(remaining, decimalNumber(lot.quantityRemaining));
        const unitCost = decimalNumber(lot.unitCost);
        allocations.push({ lot, quantity, unitCost });
        cost += quantity * unitCost;
        remaining -= quantity;
      }
      const averageUnitCost = line.quantity > 0 ? cost / line.quantity : 0;
      const lineRow = await tx.inventoryMovementLine.create({
        data: {
          tenantId,
          inventoryMovementId: movement.id,
          inventoryItemId: item.id,
          lineId: randomUUID(),
          position,
          direction: 'OUT',
          quantity: line.quantity,
          unitCost: averageUnitCost,
          amount: cost,
          expectedQuantity: line.expectedQuantity,
          actualQuantity: line.actualQuantity,
          note: line.note,
        },
      });
      for (const allocation of allocations) {
        await tx.inventoryMovementAllocation.create({
          data: {
            tenantId,
            inventoryMovementLineId: lineRow.id,
            inventoryLotId: allocation.lot.id,
            allocationId: randomUUID(),
            quantity: allocation.quantity,
            unitCost: allocation.unitCost,
            amount: allocation.quantity * allocation.unitCost,
          },
        });
        await tx.inventoryLot.update({
          where: { id: allocation.lot.id },
          data: { quantityRemaining: decimalNumber(allocation.lot.quantityRemaining) - allocation.quantity },
        });
      }
    }

    return movement;
  }
}

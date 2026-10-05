import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma.service';
import { InventoryService } from './inventory.service';

type AnyRecord = Record<string, any>;

type StockRow = {
  row: number;
  manufacturer: string;
  name: string;
  productType: string;
  unit: string;
  quantity: number;
  packageQuantity: number | null;
  grossWeight: number | null;
  tareWeight: number | null;
  supplier: string;
  listPrice: number | null;
  discountPercent: number | null;
  actualPrice: number | null;
  location: string;
  minStock: number | null;
  targetStock: number | null;
  sku: string;
  barcode: string;
};

type SupplierRow = {
  row: number;
  manufacturer: string;
  name: string;
  unit: string;
  supplier: string;
  listPrice: number | null;
  discountPercent: number | null;
  actualPrice: number | null;
  supplierSku: string;
  note: string;
};

type MovementRow = {
  row: number;
  date: string;
  time: string;
  personUei: string;
  personName: string;
  procedure: string;
  section: string;
  kind: string;
  manufacturer: string;
  material: string;
  quantity: number;
  unit: string;
  supplier: string;
  listPrice: number | null;
  discountPercent: number | null;
  actualPrice: number | null;
  unitCost: number | null;
  note: string;
};

const STOCK_HEADERS = [
  'Производитель', 'Наименование *', 'Категория / тип', 'Единица *', 'Количество *',
  'В упаковке', 'Масса брутто полной упаковки', 'Масса тары',
  'Поставщик начального остатка', 'Прайсовая цена', 'Скидка %', 'Фактическая цена закупки',
  'Место хранения', 'Минимальный остаток', 'Целевой остаток', 'Артикул', 'Штрихкод',
];

const SUPPLIER_HEADERS = [
  'Производитель', 'Наименование товара *', 'Единица', 'Поставщик *',
  'Прайсовая цена', 'Скидка %', 'Фактическая цена', 'Артикул поставщика', 'Примечание',
];

const MOVEMENT_HEADERS = [
  'Дата *', 'Время', 'UEI', 'Имя', 'Процедура', 'Часть / зона', 'Тип *',
  'Производитель', 'Материал *', 'Количество *', 'Единица', 'Поставщик',
  'Прайсовая цена', 'Скидка %', 'Фактическая цена закупки', 'Себестоимость', 'Примечание',
];

const ORDER_HEADERS = ['Наименование', 'Количество', 'Единица', 'Поставщик', 'Артикул'];

const KIND_LABELS: Record<string, string> = {
  RECEIPT: 'Приход',
  CONSUMPTION: 'Расход',
  WRITE_OFF: 'Списание',
  SALE: 'Продажа',
  RETURN: 'Возврат',
  ADJUSTMENT: 'Инвентаризация',
  CORRECTION: 'Корректировка',
};

const KIND_VALUES: Record<string, string> = {
  приход: 'RECEIPT',
  расход: 'CONSUMPTION',
  списание: 'WRITE_OFF',
  продажа: 'SALE',
  возврат: 'RETURN',
  инвентаризация: 'ADJUSTMENT',
  корректировка: 'CORRECTION',
};

function text(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    const object = value as AnyRecord;
    if (object.text != null) return String(object.text).trim();
    if (object.result != null) return String(object.result).trim();
    if (Array.isArray(object.richText)) return object.richText.map((part: AnyRecord) => String(part?.text || '')).join('').trim();
  }
  return String(value ?? '').trim();
}

function normalized(value: unknown): string {
  return text(value).toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ').trim();
}

function numberValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegative(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed == null ? null : Math.max(0, parsed);
}

function percentValue(value: unknown): number | null {
  const parsed = nonNegative(value);
  return parsed == null ? null : Math.min(100, parsed);
}

function effectivePrice(listPrice: number | null, discountPercent: number | null, actualPrice: number | null): number | null {
  if (actualPrice != null) return actualPrice;
  if (listPrice == null) return null;
  return discountPercent == null ? listPrice : listPrice * (1 - discountPercent / 100);
}

function effectiveDiscount(listPrice: number | null, discountPercent: number | null, actualPrice: number | null): number | null {
  if (discountPercent != null) return discountPercent;
  if (listPrice == null || actualPrice == null || listPrice <= 0) return null;
  return Math.max(0, Math.min(100, (1 - actualPrice / listPrice) * 100));
}

function dateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = text(value);
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ru = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  if (ru) {
    const year = ru[3].length === 2 ? `20${ru[3]}` : ru[3];
    return `${year}-${ru[2].padStart(2, '0')}-${ru[1].padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function timeOnly(value: unknown): string {
  if (value instanceof Date) return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  const raw = text(value);
  if (!raw) return '';
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

function occurredAt(date: string, time = ''): Date {
  const resolvedTime = /^\d{2}:\d{2}$/.test(time) ? time : '12:00';
  const parsed = new Date(`${date}T${resolvedTime}:00`);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`Некорректная дата: ${date}`);
  return parsed;
}

function fileBuffer(dataUrl: unknown): Buffer {
  const raw = text(dataUrl);
  const comma = raw.indexOf(',');
  const base64 = comma >= 0 ? raw.slice(comma + 1) : raw;
  if (!base64) throw new BadRequestException('Файл Excel пуст');
  return Buffer.from(base64, 'base64');
}

function styleSheet(sheet: ExcelJS.Worksheet, headers: string[]) {
  const row = sheet.getRow(1);
  row.values = headers;
  row.font = { bold: true };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 30;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  headers.forEach((header, index) => {
    sheet.getColumn(index + 1).width = Math.max(14, Math.min(34, header.length + 4));
  });
}

async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function rowValues(row: ExcelJS.Row, count: number) {
  return Array.from({ length: count }, (_, index) => row.getCell(index + 1).value);
}

function stableSourceId(parts: unknown[]): string {
  return createHash('sha256').update(parts.map((part) => text(part)).join('|')).digest('hex').slice(0, 40);
}

function stockIdentity(row: Pick<StockRow, 'manufacturer' | 'name' | 'unit' | 'sku' | 'barcode'>): string {
  if (row.sku) return `sku:${normalized(row.sku)}`;
  if (row.barcode) return `barcode:${normalized(row.barcode)}`;
  return `product:${normalized(row.manufacturer)}|${normalized(row.name)}|${normalized(row.unit)}`;
}

@Injectable()
export class InventoryExcelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async stockTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Остатки');
    styleSheet(sheet, STOCK_HEADERS);
    sheet.addRow(['Пример бренда', 'Пример товара', 'Тип продукта', 'шт.', 25, 100, '', '', '', '', '', '', '', '', '', '', '']);

    const suppliers = workbook.addWorksheet('Поставщики');
    styleSheet(suppliers, SUPPLIER_HEADERS);
    suppliers.addRow(['Пример бренда', 'Пример товара', 'шт.', 'Поставщик А', 1000, '', 850, 'SKU-001', '']);
    suppliers.addRow(['Пример бренда', 'Пример товара', 'шт.', 'Поставщик Б', 920, '', '', 'SKU-002', '']);
    return workbookBuffer(workbook);
  }

  async stockExport(tenantId: string) {
    const snapshot = await this.inventory.snapshot(tenantId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Остатки');
    styleSheet(sheet, STOCK_HEADERS);
    snapshot.items.forEach((item: AnyRecord) => sheet.addRow([
      item.manufacturer || '', item.name, item.productType || item.category || '', item.unit, item.balance,
      item.packageQuantity ?? '', item.grossWeight ?? '', item.tareWeight ?? '',
      '', '', '', item.lastPurchasePrice ?? '',
      item.location || '', item.minStock ?? '', item.targetStock ?? '', item.sku || '', item.barcode || '',
    ]));

    const suppliers = workbook.addWorksheet('Поставщики');
    styleSheet(suppliers, SUPPLIER_HEADERS);
    snapshot.items.forEach((item: AnyRecord) => {
      (item.supplierOffers || []).forEach((offer: AnyRecord) => suppliers.addRow([
        item.manufacturer || '', item.name, item.unit, offer.supplier || '',
        offer.listPrice ?? '', offer.discountPercent ?? '', offer.actualPrice ?? '',
        offer.supplierSku || '', offer.note || '',
      ]));
    });
    return workbookBuffer(workbook);
  }

  private async parseStock(dataUrl: unknown): Promise<{ rows: StockRow[]; suppliers: SupplierRow[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer(dataUrl) as any);
    const sheet = workbook.getWorksheet('Остатки') || workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('В Excel нет листа «Остатки»');
    const rows: StockRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const v = rowValues(row, STOCK_HEADERS.length);
      if (v.every((value) => !text(value))) return;
      rows.push({
        row: rowNumber,
        manufacturer: text(v[0]),
        name: text(v[1]),
        productType: text(v[2]),
        unit: text(v[3]) || 'шт.',
        quantity: nonNegative(v[4]) ?? -1,
        packageQuantity: nonNegative(v[5]),
        grossWeight: nonNegative(v[6]),
        tareWeight: nonNegative(v[7]),
        supplier: text(v[8]),
        listPrice: nonNegative(v[9]),
        discountPercent: percentValue(v[10]),
        actualPrice: nonNegative(v[11]),
        location: text(v[12]),
        minStock: nonNegative(v[13]),
        targetStock: nonNegative(v[14]),
        sku: text(v[15]),
        barcode: text(v[16]),
      });
    });

    const suppliers: SupplierRow[] = [];
    const supplierSheet = workbook.getWorksheet('Поставщики');
    supplierSheet?.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const v = rowValues(row, SUPPLIER_HEADERS.length);
      if (v.every((value) => !text(value))) return;
      suppliers.push({
        row: rowNumber,
        manufacturer: text(v[0]),
        name: text(v[1]),
        unit: text(v[2]),
        supplier: text(v[3]),
        listPrice: nonNegative(v[4]),
        discountPercent: percentValue(v[5]),
        actualPrice: nonNegative(v[6]),
        supplierSku: text(v[7]),
        note: text(v[8]),
      });
    });
    return { rows, suppliers };
  }

  private matchItem(items: AnyRecord[], row: Pick<StockRow, 'manufacturer' | 'name' | 'unit' | 'sku' | 'barcode'>) {
    const bySku = row.sku ? items.filter((item) => normalized(item.sku) === normalized(row.sku)) : [];
    if (bySku.length === 1) return bySku[0];
    if (bySku.length > 1) return 'ambiguous';
    const byBarcode = row.barcode ? items.filter((item) => normalized(item.barcode) === normalized(row.barcode)) : [];
    if (byBarcode.length === 1) return byBarcode[0];
    if (byBarcode.length > 1) return 'ambiguous';
    const byName = items.filter((item) =>
      normalized(item.manufacturer) === normalized(row.manufacturer)
      && normalized(item.name) === normalized(row.name)
      && normalized(item.unit) === normalized(row.unit));
    if (byName.length === 1) return byName[0];
    if (byName.length > 1) return 'ambiguous';
    return null;
  }

  private supplierItemMatch(items: AnyRecord[], row: SupplierRow) {
    const matches = items.filter((item) =>
      normalized(item.manufacturer) === normalized(row.manufacturer)
      && normalized(item.name) === normalized(row.name)
      && (!row.unit || normalized(item.unit) === normalized(row.unit)));
    return matches.length === 1 ? matches[0] : matches.length > 1 ? 'ambiguous' : null;
  }

  async stockPreview(tenantId: string, dataUrl: unknown) {
    const parsed = await this.parseStock(dataUrl);
    const snapshot = await this.inventory.snapshot(tenantId);
    const errors: string[] = [];
    let create = 0;
    let update = 0;
    const seen = new Set<string>();
    parsed.rows.forEach((row) => {
      if (!row.name) errors.push(`Остатки, строка ${row.row}: нет наименования`);
      if (!row.unit) errors.push(`Остатки, строка ${row.row}: нет единицы`);
      if (row.quantity < 0) errors.push(`Остатки, строка ${row.row}: количество должно быть числом`);
      if (row.grossWeight != null && row.tareWeight != null && row.tareWeight > row.grossWeight) {
        errors.push(`Остатки, строка ${row.row}: масса тары больше массы брутто`);
      }
      const identity = stockIdentity(row);
      if (seen.has(identity)) errors.push(`Остатки, строка ${row.row}: позиция повторяется в файле`);
      seen.add(identity);
      const match = this.matchItem(snapshot.items, row);
      if (match === 'ambiguous') errors.push(`Остатки, строка ${row.row}: позиция определяется неоднозначно`);
      else if (match) update += 1;
      else create += 1;
    });

    const projected = [...snapshot.items];
    parsed.rows.forEach((row) => {
      const match = this.matchItem(projected, row);
      if (!match) projected.push({ ...row, itemId: `preview:${row.row}` });
    });
    parsed.suppliers.forEach((row) => {
      if (!row.name) errors.push(`Поставщики, строка ${row.row}: нет товара`);
      if (!row.supplier) errors.push(`Поставщики, строка ${row.row}: нет поставщика`);
      const match = this.supplierItemMatch(projected, row);
      if (!match) errors.push(`Поставщики, строка ${row.row}: товар «${row.name}» не найден в остатках`);
      if (match === 'ambiguous') errors.push(`Поставщики, строка ${row.row}: товар «${row.name}» определяется неоднозначно`);
    });
    return { rows: parsed.rows.length, create, update, offers: parsed.suppliers.length, errors };
  }

  async stockImport(tenantId: string, dataUrl: unknown) {
    const parsed = await this.parseStock(dataUrl);
    const snapshot = await this.inventory.snapshot(tenantId);
    const preview = await this.stockPreview(tenantId, dataUrl);
    if (preview.errors.length) throw new BadRequestException(preview.errors.join('; '));

    const prepared = parsed.rows.map((row) => {
      const match = this.matchItem(snapshot.items, row);
      const existing = match && match !== 'ambiguous' ? match : null;
      return {
        row,
        itemId: existing ? String(existing.itemId) : randomUUID(),
        existing,
        currentBalance: existing ? Number(existing.balance) || 0 : 0,
      };
    });

    const existingRows = await this.prisma.inventoryItem.findMany({
      where: { tenantId, itemId: { in: prepared.filter((entry) => entry.existing).map((entry) => entry.itemId) } },
      select: { id: true, itemId: true, lastPurchasePrice: true },
    });
    const existingByItemId = new Map(existingRows.map((item) => [item.itemId, item]));

    await this.prisma.$transaction(async (tx) => {
      for (const entry of prepared) {
        const commonData: AnyRecord = {
          name: entry.row.name,
          manufacturer: entry.row.manufacturer,
          productType: entry.row.productType,
          category: entry.row.productType,
          unit: entry.row.unit,
          location: entry.row.location,
          minStock: entry.row.minStock,
          targetStock: entry.row.targetStock,
          packageQuantity: entry.row.packageQuantity,
          grossWeight: entry.row.grossWeight,
          tareWeight: entry.row.tareWeight,
          sku: entry.row.sku,
          barcode: entry.row.barcode,
        };
        const purchasePrice = effectivePrice(entry.row.listPrice, entry.row.discountPercent, entry.row.actualPrice);
        if (purchasePrice != null) commonData.lastPurchasePrice = purchasePrice;
        if (entry.row.supplier) commonData.supplier = entry.row.supplier;
        const stored = existingByItemId.get(entry.itemId);
        if (stored) {
          await tx.inventoryItem.update({ where: { id: stored.id }, data: commonData });
        } else {
          await tx.inventoryItem.create({
            data: {
              tenantId,
              itemId: entry.itemId,
              ...commonData,
              lastPurchasePrice: purchasePrice,
              supplier: entry.row.supplier,
              trackLots: true,
              canConsume: true,
              canSell: false,
              position: 0,
            } as any,
          });
        }
      }
    });

    const effectivePrices = new Map(existingRows.map((item) => [item.itemId, item.lastPurchasePrice == null ? null : Number(item.lastPurchasePrice)]));
    const lines = prepared.map((entry) => {
      const difference = entry.row.quantity - entry.currentBalance;
      if (Math.abs(difference) < 0.000001) return null;
      const importedPrice = effectivePrice(entry.row.listPrice, entry.row.discountPercent, entry.row.actualPrice);
      return {
        itemId: entry.itemId,
        quantity: difference,
        unitCost: difference > 0 ? (importedPrice ?? effectivePrices.get(entry.itemId) ?? null) : null,
        supplier: entry.row.supplier,
        listPrice: entry.row.listPrice,
        discountPercent: effectiveDiscount(entry.row.listPrice, entry.row.discountPercent, entry.row.actualPrice),
      };
    }).filter(Boolean);

    if (lines.length) {
      await this.inventory.createMovement(tenantId, {
        kind: 'ADJUSTMENT',
        sourceType: 'excel-stock-import',
        sourceId: stableSourceId([Date.now(), parsed.rows.length]),
        note: 'Импорт остатков',
        lines,
      });
    }

    const freshSnapshot = await this.inventory.snapshot(tenantId);
    for (const row of parsed.suppliers) {
      const item = this.supplierItemMatch(freshSnapshot.items, row);
      if (!item || item === 'ambiguous') continue;
      const stored = await this.prisma.inventoryItem.findFirst({ where: { tenantId, itemId: item.itemId, archivedAt: null } });
      if (!stored) continue;
      const discount = effectiveDiscount(row.listPrice, row.discountPercent, row.actualPrice);
      const actual = effectivePrice(row.listPrice, row.discountPercent, row.actualPrice);
      const existing = await this.prisma.inventorySupplierOffer.findFirst({
        where: { tenantId, inventoryItemId: stored.id, supplier: { equals: row.supplier, mode: 'insensitive' } },
      });
      const data = {
        supplier: row.supplier,
        listPrice: row.listPrice,
        discountPercent: discount,
        actualPrice: actual,
        supplierSku: row.supplierSku,
        note: row.note,
        isActive: true,
      };
      if (existing) await this.prisma.inventorySupplierOffer.update({ where: { id: existing.id }, data });
      else await this.prisma.inventorySupplierOffer.create({
        data: { tenantId, offerId: randomUUID(), inventoryItemId: stored.id, ...data },
      });
    }
    return this.inventory.snapshot(tenantId);
  }

  async movementTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Движения');
    styleSheet(sheet, MOVEMENT_HEADERS);
    sheet.addRow(['05.10.2026', '12:00', '', '', 'Пример процедуры', '', 'Расход', 'Пример бренда', 'Пример материала', 2, 'шт.', '', '', '', '', '', '']);
    sheet.addRow(['05.10.2026', '13:00', '', '', '', '', 'Приход', 'Пример бренда', 'Пример материала', 10, 'шт.', 'Поставщик А', 1000, '', 850, '', '']);
    return workbookBuffer(workbook);
  }

  private async parseMovements(dataUrl: unknown): Promise<MovementRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer(dataUrl) as any);
    const sheet = workbook.getWorksheet('Движения') || workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('В Excel нет листа «Движения»');
    const rows: MovementRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const v = rowValues(row, MOVEMENT_HEADERS.length);
      if (v.every((value) => !text(value))) return;
      rows.push({
        row: rowNumber,
        date: dateOnly(v[0]),
        time: timeOnly(v[1]),
        personUei: text(v[2]),
        personName: text(v[3]),
        procedure: text(v[4]),
        section: text(v[5]),
        kind: KIND_VALUES[normalized(v[6])] || text(v[6]).toUpperCase(),
        manufacturer: text(v[7]),
        material: text(v[8]),
        quantity: nonNegative(v[9]) ?? -1,
        unit: text(v[10]),
        supplier: text(v[11]),
        listPrice: nonNegative(v[12]),
        discountPercent: percentValue(v[13]),
        actualPrice: nonNegative(v[14]),
        unitCost: nonNegative(v[15]),
        note: text(v[16]),
      });
    });
    return rows;
  }

  private movementItemMatch(items: AnyRecord[], row: MovementRow) {
    const matches = items.filter((item) =>
      normalized(item.name) === normalized(row.material)
      && (!row.manufacturer || normalized(item.manufacturer) === normalized(row.manufacturer))
      && (!row.unit || normalized(item.unit) === normalized(row.unit)));
    return matches.length === 1 ? matches[0] : matches.length > 1 ? 'ambiguous' : null;
  }

  async movementPreview(tenantId: string, dataUrl: unknown) {
    const rows = await this.parseMovements(dataUrl);
    const snapshot = await this.inventory.snapshot(tenantId);
    const errors: string[] = [];
    rows.forEach((row) => {
      if (!row.date) errors.push(`Строка ${row.row}: нет корректной даты`);
      if (!KIND_LABELS[row.kind]) errors.push(`Строка ${row.row}: неизвестный тип движения`);
      if (!row.material) errors.push(`Строка ${row.row}: нет материала`);
      if (row.quantity <= 0) errors.push(`Строка ${row.row}: количество должно быть больше нуля`);
      const match = this.movementItemMatch(snapshot.items, row);
      if (!match) errors.push(`Строка ${row.row}: материал «${row.material}» не найден в остатках`);
      if (match === 'ambiguous') errors.push(`Строка ${row.row}: материал «${row.material}» определяется неоднозначно`);
    });
    const groups = new Set(rows.map((row) => [row.date, row.time, row.personUei, row.procedure, row.kind, row.note].join('|')));
    return { rows: rows.length, groups: groups.size, errors };
  }

  private async ueiPersonMap(tenantId: string) {
    const state = await this.prisma.ueiState.findUnique({ where: { tenantId } });
    const relations = ((state?.data as AnyRecord)?.relations || {}) as Record<string, string>;
    const map = new Map<string, string>();
    Object.entries(relations).forEach(([member, uei]) => {
      if (member.startsWith('person:') && uei) map.set(String(uei), member.slice('person:'.length));
    });
    return map;
  }

  async movementImport(tenantId: string, dataUrl: unknown) {
    const rows = await this.parseMovements(dataUrl);
    const preview = await this.movementPreview(tenantId, dataUrl);
    if (preview.errors.length) throw new BadRequestException(preview.errors.join('; '));
    const snapshot = await this.inventory.snapshot(tenantId);
    const ueiMap = await this.ueiPersonMap(tenantId);
    const grouped = new Map<string, AnyRecord>();

    rows.forEach((row) => {
      const item = this.movementItemMatch(snapshot.items, row) as AnyRecord;
      const key = [row.date, row.time, row.personUei, row.procedure, row.kind, row.note].join('|');
      const group = grouped.get(key) || {
        kind: row.kind,
        sourceType: 'excel-import',
        personUei: row.personUei,
        personKey: ueiMap.get(row.personUei) || '',
        procedureKey: row.procedure,
        occurredAt: occurredAt(row.date, row.time),
        note: row.note,
        lines: [],
      };
      const importedCost = effectivePrice(row.listPrice, row.discountPercent, row.actualPrice) ?? row.unitCost;
      group.lines.push({
        itemId: item.itemId,
        quantity: row.quantity,
        unitCost: row.kind === 'RECEIPT' || row.kind === 'RETURN' || row.kind === 'ADJUSTMENT' ? importedCost : null,
        supplier: row.supplier,
        listPrice: row.listPrice,
        discountPercent: effectiveDiscount(row.listPrice, row.discountPercent, row.actualPrice),
        note: row.section,
      });
      grouped.set(key, group);
    });

    const candidates: AnyRecord[] = [...grouped.entries()].map(([key, group]): AnyRecord => ({
      ...group,
      sourceId: stableSourceId([key, ...group.lines.map((line: AnyRecord) => [
        line.itemId, line.quantity, line.unitCost ?? '', line.supplier || '', line.listPrice ?? '',
        line.discountPercent ?? '', line.note || '',
      ].join(':'))]),
    }));
    candidates.sort((a: AnyRecord, b: AnyRecord) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    const existing = await this.prisma.inventoryMovement.findMany({
      where: { tenantId, sourceType: 'excel-import', sourceId: { in: candidates.map((item) => item.sourceId) } },
      select: { sourceId: true },
    });
    const existingIds = new Set(existing.map((item) => item.sourceId));
    const fresh = candidates.filter((item) => !existingIds.has(item.sourceId));
    if (fresh.length) await this.inventory.createMovements(tenantId, fresh);
    return { snapshot: await this.inventory.snapshot(tenantId), imported: fresh.length, skipped: candidates.length - fresh.length };
  }

  private async personNames(tenantId: string) {
    const [people, ueiMap] = await Promise.all([
      this.prisma.person.findMany({ where: { tenantId }, select: { key: true, data: true } }),
      this.ueiPersonMap(tenantId),
    ]);
    const byKey = new Map(people.map((person) => {
      const data = (person.data || {}) as AnyRecord;
      return [person.key, [text(data.name), text(data.surname)].filter(Boolean).join(' ')];
    }));
    const byUei = new Map<string, string>();
    ueiMap.forEach((key, uei) => byUei.set(uei, byKey.get(key) || ''));
    return { byKey, byUei };
  }

  async movementExport(tenantId: string, from = '', to = '') {
    const start = from ? new Date(`${from}T00:00:00`) : undefined;
    const end = to ? new Date(`${to}T23:59:59.999`) : undefined;
    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        tenantId,
        ...(start || end ? { occurredAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}),
      },
      include: {
        lines: {
          include: { item: true, allocations: { include: { lot: true } } },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });
    const names = await this.personNames(tenantId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Движения');
    styleSheet(sheet, MOVEMENT_HEADERS);
    movements.forEach((movement: AnyRecord) => {
      const date = new Date(movement.occurredAt);
      const personName = names.byUei.get(movement.personUei) || names.byKey.get(movement.personKey) || '';
      (movement.lines || []).forEach((line: AnyRecord) => {
        const lots = (line.allocations || []).map((allocation: AnyRecord) => allocation.lot).filter(Boolean);
        const suppliers = [...new Set(lots.map((lot: AnyRecord) => text(lot.supplier)).filter(Boolean))];
        const listPrices = [...new Set(lots.map((lot: AnyRecord) => lot.listPrice == null ? '' : String(lot.listPrice)).filter(Boolean))];
        const discounts = [...new Set(lots.map((lot: AnyRecord) => lot.discountPercent == null ? '' : String(lot.discountPercent)).filter(Boolean))];
        sheet.addRow([
          date.toLocaleDateString('ru-RU'),
          date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          movement.personUei || '',
          personName,
          movement.procedureKey || '',
          line.note || '',
          KIND_LABELS[movement.kind] || movement.kind,
          line.item?.manufacturer || '',
          line.item?.name || '',
          Number(line.quantity),
          line.item?.unit || '',
          suppliers.join(', '),
          listPrices.length === 1 ? Number(listPrices[0]) : '',
          discounts.length === 1 ? Number(discounts[0]) : '',
          line.direction === 'IN' ? Number(line.unitCost) || '' : '',
          Number(line.unitCost) || '',
          movement.note || '',
        ]);
      });
    });
    return workbookBuffer(workbook);
  }

  async orderExport(tenantId: string, selections: unknown) {
    const rows = Array.isArray(selections) ? selections.map((item) => item as AnyRecord) : [];
    if (!rows.length) throw new BadRequestException('Не выбраны позиции заказа');
    const ids = rows.map((row) => text(row.itemId)).filter(Boolean);
    const items = await this.prisma.inventoryItem.findMany({ where: { tenantId, itemId: { in: ids }, archivedAt: null } });
    const byId = new Map(items.map((item: AnyRecord) => [item.itemId, item]));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Заказ');
    styleSheet(sheet, ORDER_HEADERS);
    rows.forEach((row) => {
      const item = byId.get(text(row.itemId)) as AnyRecord | undefined;
      if (!item) return;
      sheet.addRow([item.name, nonNegative(row.quantity) || 0, item.unit, item.supplier || '', item.sku || '']);
    });
    return workbookBuffer(workbook);
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma.service';
import { InventoryService } from './inventory.service';

type AnyRecord = Record<string, any>;

type StockRow = {
  row: number;
  name: string;
  unit: string;
  quantity: number;
  purchasePrice: number | null;
  category: string;
  supplier: string;
  location: string;
  minStock: number | null;
  targetStock: number | null;
  packageQuantity: number | null;
  sku: string;
  barcode: string;
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
  material: string;
  quantity: number;
  unit: string;
  unitCost: number | null;
  note: string;
};

const STOCK_HEADERS = [
  'Наименование *', 'Единица *', 'Количество *', 'Цена закупки', 'Категория',
  'Поставщик', 'Место хранения', 'Минимальный остаток', 'Целевой остаток',
  'В упаковке', 'Артикул', 'Штрихкод',
];

const MOVEMENT_HEADERS = [
  'Дата *', 'Время', 'UEI', 'Имя', 'Процедура', 'Часть / зона', 'Тип *',
  'Материал *', 'Количество *', 'Единица', 'Себестоимость', 'Примечание',
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
  'приход': 'RECEIPT',
  'расход': 'CONSUMPTION',
  'списание': 'WRITE_OFF',
  'продажа': 'SALE',
  'возврат': 'RETURN',
  'инвентаризация': 'ADJUSTMENT',
  'корректировка': 'CORRECTION',
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
  try {
    return Buffer.from(base64, 'base64');
  } catch {
    throw new BadRequestException('Не удалось прочитать файл Excel');
  }
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
    const column = sheet.getColumn(index + 1);
    column.width = Math.max(14, Math.min(28, header.length + 4));
  });
}

async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const value = await workbook.xlsx.writeBuffer();
  return Buffer.from(value);
}

function rowValues(row: ExcelJS.Row, count: number) {
  return Array.from({ length: count }, (_, index) => row.getCell(index + 1).value);
}

function stableSourceId(parts: unknown[]): string {
  return createHash('sha256').update(parts.map((part) => text(part)).join('|')).digest('hex').slice(0, 40);
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
    sheet.addRow(['6A', 'г', 100, 0, 'Красители', '', '', '', '', '', '', '']);
    return workbookBuffer(workbook);
  }

  async stockExport(tenantId: string) {
    const snapshot = await this.inventory.snapshot(tenantId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Остатки');
    styleSheet(sheet, STOCK_HEADERS);
    snapshot.items.forEach((item: AnyRecord) => sheet.addRow([
      item.name, item.unit, item.balance, item.lastPurchasePrice ?? '', item.category || '',
      item.supplier || '', item.location || '', item.minStock ?? '', item.targetStock ?? '',
      item.packageQuantity ?? '', item.sku || '', item.barcode || '',
    ]));
    return workbookBuffer(workbook);
  }

  private async parseStock(dataUrl: unknown): Promise<StockRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer(dataUrl));
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('В Excel нет листа');
    const rows: StockRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const v = rowValues(row, STOCK_HEADERS.length);
      const name = text(v[0]);
      if (!name && v.every((value) => !text(value))) return;
      rows.push({
        row: rowNumber,
        name,
        unit: text(v[1]) || 'шт.',
        quantity: nonNegative(v[2]) ?? -1,
        purchasePrice: nonNegative(v[3]),
        category: text(v[4]), supplier: text(v[5]), location: text(v[6]),
        minStock: nonNegative(v[7]), targetStock: nonNegative(v[8]), packageQuantity: nonNegative(v[9]),
        sku: text(v[10]), barcode: text(v[11]),
      });
    });
    return rows;
  }

  private matchItem(items: AnyRecord[], row: Pick<StockRow, 'name' | 'unit' | 'sku' | 'barcode'>) {
    const bySku = row.sku ? items.filter((item) => normalized(item.sku) === normalized(row.sku)) : [];
    if (bySku.length === 1) return bySku[0];
    if (bySku.length > 1) return 'ambiguous';
    const byBarcode = row.barcode ? items.filter((item) => normalized(item.barcode) === normalized(row.barcode)) : [];
    if (byBarcode.length === 1) return byBarcode[0];
    if (byBarcode.length > 1) return 'ambiguous';
    const byName = items.filter((item) => normalized(item.name) === normalized(row.name) && normalized(item.unit) === normalized(row.unit));
    if (byName.length === 1) return byName[0];
    if (byName.length > 1) return 'ambiguous';
    return null;
  }

  async stockPreview(tenantId: string, dataUrl: unknown) {
    const rows = await this.parseStock(dataUrl);
    const snapshot = await this.inventory.snapshot(tenantId);
    const errors: string[] = [];
    let create = 0;
    let update = 0;
    rows.forEach((row) => {
      if (!row.name) errors.push(`Строка ${row.row}: нет наименования`);
      if (!row.unit) errors.push(`Строка ${row.row}: нет единицы`);
      if (row.quantity < 0) errors.push(`Строка ${row.row}: количество должно быть числом`);
      const match = this.matchItem(snapshot.items, row);
      if (match === 'ambiguous') errors.push(`Строка ${row.row}: позиция определяется неоднозначно`);
      else if (match) update += 1;
      else create += 1;
    });
    return { rows: rows.length, create, update, errors };
  }

  async stockImport(tenantId: string, dataUrl: unknown) {
    const rows = await this.parseStock(dataUrl);
    const snapshot = await this.inventory.snapshot(tenantId);
    const preview = await this.stockPreview(tenantId, dataUrl);
    if (preview.errors.length) throw new BadRequestException(preview.errors.join('; '));

    const existingItems = [...snapshot.items];
    const prepared = rows.map((row) => {
      const match = this.matchItem(existingItems, row);
      const itemId = match && match !== 'ambiguous' ? String(match.itemId) : randomUUID();
      const currentBalance = match && match !== 'ambiguous' ? Number(match.balance) || 0 : 0;
      if (!match) existingItems.push({ itemId, ...row, balance: 0 });
      return { row, itemId, match: match && match !== 'ambiguous' ? match : null, currentBalance };
    });

    await this.prisma.$transaction(async (tx) => {
      for (const entry of prepared) {
        const data = {
          name: entry.row.name,
          unit: entry.row.unit,
          category: entry.row.category,
          supplier: entry.row.supplier,
          location: entry.row.location,
          minStock: entry.row.minStock,
          targetStock: entry.row.targetStock,
          packageQuantity: entry.row.packageQuantity,
          sku: entry.row.sku,
          barcode: entry.row.barcode,
          lastPurchasePrice: entry.row.purchasePrice,
        };
        if (entry.match) {
          await tx.inventoryItem.update({ where: { id: entry.match.id }, data });
        } else {
          await tx.inventoryItem.create({
            data: {
              tenantId,
              itemId: entry.itemId,
              ...data,
              trackLots: true,
              canConsume: true,
              canSell: false,
              position: 0,
            },
          });
        }
      }
    });

    const lines = prepared.map((entry) => {
      const difference = entry.row.quantity - entry.currentBalance;
      if (Math.abs(difference) < 0.000001) return null;
      return {
        itemId: entry.itemId,
        quantity: difference,
        unitCost: difference > 0 ? entry.row.purchasePrice : null,
      };
    }).filter(Boolean);

    if (lines.length) {
      await this.inventory.createMovement(tenantId, {
        kind: 'ADJUSTMENT',
        sourceType: 'excel-stock-import',
        sourceId: stableSourceId([Date.now(), rows.length]),
        note: 'Импорт остатков',
        lines,
      });
    }
    return this.inventory.snapshot(tenantId);
  }

  async movementTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Движения');
    styleSheet(sheet, MOVEMENT_HEADERS);
    sheet.addRow(['05.10.2026', '12:00', '', '', 'Окрашивание', 'Корни', 'Расход', '6A', 8, 'г', '', '']);
    sheet.addRow(['05.10.2026', '12:00', '', '', 'Окрашивание', 'Корни', 'Расход', 'Оксид 3%', 42, 'г', '', '']);
    return workbookBuffer(workbook);
  }

  private async parseMovements(dataUrl: unknown): Promise<MovementRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer(dataUrl));
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('В Excel нет листа');
    const rows: MovementRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const v = rowValues(row, MOVEMENT_HEADERS.length);
      if (v.every((value) => !text(value))) return;
      rows.push({
        row: rowNumber,
        date: dateOnly(v[0]), time: timeOnly(v[1]), personUei: text(v[2]), personName: text(v[3]),
        procedure: text(v[4]), section: text(v[5]), kind: KIND_VALUES[normalized(v[6])] || text(v[6]).toUpperCase(),
        material: text(v[7]), quantity: nonNegative(v[8]) ?? -1, unit: text(v[9]), unitCost: nonNegative(v[10]), note: text(v[11]),
      });
    });
    return rows;
  }

  private movementItemMatch(items: AnyRecord[], row: MovementRow) {
    const matches = items.filter((item) => normalized(item.name) === normalized(row.material) && (!row.unit || normalized(item.unit) === normalized(row.unit)));
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
    const groups = new Set(rows.map((row) => [row.date, row.time, row.personUei, row.procedure, row.section, row.kind, row.note].join('|')));
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
      const key = [row.date, row.time, row.personUei, row.procedure, row.section, row.kind, row.note].join('|');
      const group = grouped.get(key) || {
        kind: row.kind,
        sourceType: 'excel-import',
        sourceId: stableSourceId([key]),
        personUei: row.personUei,
        personKey: ueiMap.get(row.personUei) || '',
        procedureKey: row.procedure,
        occurredAt: occurredAt(row.date, row.time),
        note: row.note,
        lines: [],
      };
      group.lines.push({ itemId: item.itemId, quantity: row.quantity, unitCost: row.unitCost, note: row.section });
      grouped.set(key, group);
    });

    const candidates = [...grouped.values()].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
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
      include: { lines: { include: { item: true }, orderBy: { position: 'asc' } } },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });
    const names = await this.personNames(tenantId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Движения');
    styleSheet(sheet, MOVEMENT_HEADERS);
    movements.forEach((movement: AnyRecord) => {
      const date = new Date(movement.occurredAt);
      const personName = names.byUei.get(movement.personUei) || names.byKey.get(movement.personKey) || '';
      (movement.lines || []).forEach((line: AnyRecord) => sheet.addRow([
        date.toLocaleDateString('ru-RU'),
        date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        movement.personUei || '', personName, movement.procedureKey || '', line.note || '',
        KIND_LABELS[movement.kind] || movement.kind, line.item?.name || '', Number(line.quantity), line.item?.unit || '',
        Number(line.unitCost) || '', movement.note || '',
      ]));
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

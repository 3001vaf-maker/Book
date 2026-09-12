import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
type AuxiliaryBundle = {
  finance: JsonObject | null;
  wallets: JsonObject[];
  tags: JsonObject[];
  products: JsonObject[];
  productHistory: JsonObject[];
};

const DATASETS = new Set(['finance', 'wallets', 'tags', 'products', 'productHistory']);

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function normalize(value: unknown): AuxiliaryBundle {
  const source = objectValue(value);
  return {
    finance: source.finance && typeof source.finance === 'object' && !Array.isArray(source.finance)
      ? clone(objectValue(source.finance))
      : null,
    wallets: (Array.isArray(source.wallets) ? source.wallets : []).map((item) => clone(objectValue(item))),
    tags: (Array.isArray(source.tags) ? source.tags : []).map((item) => clone(objectValue(item))),
    products: (Array.isArray(source.products) ? source.products : []).map((item) => clone(objectValue(item))),
    productHistory: (Array.isArray(source.productHistory) ? source.productHistory : []).map((item) => clone(objectValue(item))),
  };
}

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonical(value: AuxiliaryBundle) {
  return JSON.stringify(stable(normalize(value)));
}

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

@Injectable()
export class AuxiliaryStateService {
  constructor(private readonly prisma: PrismaService) {}

  private async bundle(tenantId: string) {
    const row = await this.prisma.businessAuxiliaryState.findUnique({ where: { tenantId } });
    return {
      migrated: Boolean(row),
      verified: Boolean(row?.migrationVerifiedAt),
      migrationVerifiedAt: row?.migrationVerifiedAt || null,
      ...normalize(row?.data || {}),
    };
  }

  get(tenantId: string) {
    return this.bundle(tenantId);
  }

  private async requireVerified(tenantId: string) {
    const row = await this.prisma.businessAuxiliaryState.findUnique({ where: { tenantId } });
    if (!row?.migrationVerifiedAt) throw new ConflictException('Перенос Финансов и связанных данных ещё не подтверждён');
    return row;
  }

  async migrate(tenantId: string, body: unknown) {
    const expected = normalize(body);
    const existing = await this.prisma.businessAuxiliaryState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessAuxiliaryState.create({ data: { tenantId, data: json(expected) } });
    }
    return this.bundle(tenantId);
  }

  async verifyMigration(tenantId: string, body: unknown) {
    const expected = normalize(body);
    const current = await this.bundle(tenantId);
    if (!current.migrated) throw new ConflictException('Финансы и связанные данные ещё не перенесены');
    const actual = normalize(current);
    if (canonical(actual) !== canonical(expected)) {
      throw new ConflictException('Проверка переноса Финансов и связанных данных не пройдена');
    }
    await this.prisma.businessAuxiliaryState.update({ where: { tenantId }, data: { migrationVerifiedAt: new Date() } });
    return this.bundle(tenantId);
  }

  async bootstrap(tenantId: string) {
    const existing = await this.prisma.businessAuxiliaryState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessAuxiliaryState.create({
        data: { tenantId, data: json(normalize({})), migrationVerifiedAt: new Date() },
      });
    }
    return this.bundle(tenantId);
  }

  async updateDataset(tenantId: string, dataset: string, body: unknown) {
    const key = text(dataset);
    if (!DATASETS.has(key)) throw new BadRequestException('Неизвестный набор связанных данных');
    const row = await this.requireVerified(tenantId);
    const current = normalize(row.data);
    const value = objectValue(body).value;
    if (key === 'finance') {
      current.finance = value && typeof value === 'object' && !Array.isArray(value) ? clone(objectValue(value)) : null;
    } else {
      (current as any)[key] = Array.isArray(value) ? clone(value) : [];
    }
    await this.prisma.businessAuxiliaryState.update({ where: { tenantId }, data: { data: json(current) } });
    return current;
  }
}

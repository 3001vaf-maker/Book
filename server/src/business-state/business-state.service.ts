import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
type BusinessBundle = {
  people: JsonObject[];
  uei: { entities: JsonObject; relations: JsonObject; revoked: any[] };
  records: JsonObject[];
  recordEvents: JsonObject[];
};

type OperationalBundle = {
  days: JsonObject[];
  breaks: JsonObject[];
  procedures: JsonObject[];
  procedureHistory: JsonObject[];
  bookingSettings: JsonObject | null;
};

const OPERATIONAL_DATASETS = new Set(['days', 'breaks', 'procedures', 'procedureHistory', 'bookingSettings']);

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function positionValue(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeRows(value: unknown, key: string, label: string): JsonObject[] {
  const rows = (Array.isArray(value) ? value : []).map((item) => clone(objectValue(item)));
  const ids = rows.map((row) => text(row[key]));
  if (ids.some((id) => !id)) throw new BadRequestException(`${label}: отсутствует ${key}`);
  if (new Set(ids).size !== ids.length) throw new BadRequestException(`${label}: дублирующийся ${key}`);
  rows.forEach((row, index) => { row[key] = ids[index]; });
  return rows;
}

function normalizeUEI(value: unknown) {
  const source = objectValue(value);
  return {
    entities: clone(objectValue(source.entities)),
    relations: clone(objectValue(source.relations)),
    revoked: Array.isArray(source.revoked) ? clone(source.revoked) : [],
  };
}

function normalizeBundle(value: unknown): BusinessBundle {
  const source = objectValue(value);
  return {
    people: normalizeRows(source.people, 'key', 'Клиенты'),
    uei: normalizeUEI(source.uei),
    records: normalizeRows(source.records, 'id', 'Записи'),
    recordEvents: normalizeRows(source.recordEvents, 'id', 'История записей'),
  };
}

function normalizeOperational(value: unknown): OperationalBundle {
  const source = objectValue(value);
  const bookingSettings = source.bookingSettings && typeof source.bookingSettings === 'object' && !Array.isArray(source.bookingSettings)
    ? clone(objectValue(source.bookingSettings))
    : null;
  return {
    days: (Array.isArray(source.days) ? source.days : []).map((item) => clone(objectValue(item))),
    breaks: (Array.isArray(source.breaks) ? source.breaks : []).map((item) => clone(objectValue(item))),
    procedures: (Array.isArray(source.procedures) ? source.procedures : []).map((item) => clone(objectValue(item))),
    procedureHistory: (Array.isArray(source.procedureHistory) ? source.procedureHistory : []).map((item) => clone(objectValue(item))),
    bookingSettings,
  };
}

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonical(value: BusinessBundle) {
  return JSON.stringify(stable(value));
}

function canonicalOperational(value: OperationalBundle) {
  return JSON.stringify(stable(value));
}

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

@Injectable()
export class BusinessStateService {
  constructor(private readonly prisma: PrismaService) {}

  private async bundle(tenantId: string) {
    const [meta, people, identity, records, recordEvents] = await Promise.all([
      this.prisma.businessStateMeta.findUnique({ where: { tenantId } }),
      this.prisma.businessPerson.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.businessIdentityState.findUnique({ where: { tenantId } }),
      this.prisma.businessRecord.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.businessRecordEvent.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    ]);

    return {
      migrated: Boolean(meta),
      verified: Boolean(meta?.migrationVerifiedAt),
      migrationVerifiedAt: meta?.migrationVerifiedAt || null,
      people: people.map((row) => clone(row.data)),
      uei: normalizeUEI(identity?.data || {}),
      records: records.map((row) => clone(row.data)),
      recordEvents: recordEvents.map((row) => clone(row.data)),
    };
  }

  get(tenantId: string) {
    return this.bundle(tenantId);
  }

  private async requireVerified(tenantId: string) {
    const meta = await this.prisma.businessStateMeta.findUnique({ where: { tenantId } });
    if (!meta?.migrationVerifiedAt) throw new ConflictException('Перенос Клиентов, UEI и Записей ещё не подтверждён');
  }

  async migrate(tenantId: string, body: unknown) {
    const expected = normalizeBundle(body);
    const existing = await this.prisma.businessStateMeta.findUnique({ where: { tenantId } });
    if (existing) return this.bundle(tenantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.businessStateMeta.create({ data: { tenantId } });
      await tx.businessIdentityState.create({ data: { tenantId, data: json(expected.uei) } });
      for (const [position, person] of expected.people.entries()) {
        await tx.businessPerson.create({ data: { tenantId, key: text(person.key), position, data: json(person) } });
      }
      for (const [position, record] of expected.records.entries()) {
        await tx.businessRecord.create({ data: { tenantId, recordId: text(record.id), position, data: json(record) } });
      }
      for (const [position, event] of expected.recordEvents.entries()) {
        await tx.businessRecordEvent.create({
          data: { tenantId, eventId: text(event.id), recordId: text(event.recordId), position, data: json(event) },
        });
      }
    });

    return this.bundle(tenantId);
  }

  async verifyMigration(tenantId: string, body: unknown) {
    const expected = normalizeBundle(body);
    const current = await this.bundle(tenantId);
    if (!current.migrated) throw new ConflictException('Клиенты, UEI и Записи ещё не перенесены');
    const actual = normalizeBundle(current);
    if (canonical(actual) !== canonical(expected)) {
      throw new ConflictException('Проверка переноса Клиентов, UEI и Записей не пройдена');
    }
    await this.prisma.businessStateMeta.update({ where: { tenantId }, data: { migrationVerifiedAt: new Date() } });
    return this.bundle(tenantId);
  }

  async bootstrap(tenantId: string) {
    const existing = await this.prisma.businessStateMeta.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.businessStateMeta.create({ data: { tenantId, migrationVerifiedAt: new Date() } });
        await tx.businessIdentityState.create({ data: { tenantId, data: json(normalizeUEI({})) } });
      });
    }
    return this.bundle(tenantId);
  }

  async upsertPerson(tenantId: string, key: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const person = clone(objectValue(source.person ?? source));
    const normalizedKey = text(key);
    if (!normalizedKey) throw new BadRequestException('У клиента отсутствует key');
    person.key = normalizedKey;
    await this.prisma.businessPerson.upsert({
      where: { tenantId_key: { tenantId, key: normalizedKey } },
      create: { tenantId, key: normalizedKey, position: positionValue(source.position), data: json(person) },
      update: { position: positionValue(source.position), data: json(person) },
    });
    return person;
  }

  async deletePerson(tenantId: string, key: string) {
    await this.requireVerified(tenantId);
    const normalizedKey = text(key);
    const result = await this.prisma.businessPerson.deleteMany({ where: { tenantId, key: normalizedKey } });
    return { deleted: result.count };
  }

  async updateUEI(tenantId: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const uei = normalizeUEI(source.uei ?? source);
    await this.prisma.businessIdentityState.upsert({
      where: { tenantId },
      create: { tenantId, data: json(uei) },
      update: { data: json(uei) },
    });
    return uei;
  }

  async upsertRecord(tenantId: string, recordId: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const record = clone(objectValue(source.record ?? source));
    const id = text(recordId);
    if (!id) throw new BadRequestException('У записи отсутствует id');
    record.id = id;
    await this.prisma.businessRecord.upsert({
      where: { tenantId_recordId: { tenantId, recordId: id } },
      create: { tenantId, recordId: id, position: positionValue(source.position), data: json(record) },
      update: { position: positionValue(source.position), data: json(record) },
    });
    return record;
  }

  async deleteRecord(tenantId: string, recordId: string) {
    await this.requireVerified(tenantId);
    const id = text(recordId);
    const [events, record] = await this.prisma.$transaction([
      this.prisma.businessRecordEvent.deleteMany({ where: { tenantId, recordId: id } }),
      this.prisma.businessRecord.deleteMany({ where: { tenantId, recordId: id } }),
    ]);
    return { deleted: record.count, deletedEvents: events.count };
  }

  async deleteRecordEvents(tenantId: string, recordId: string) {
    await this.requireVerified(tenantId);
    const result = await this.prisma.businessRecordEvent.deleteMany({ where: { tenantId, recordId: text(recordId) } });
    return { deleted: result.count };
  }

  async upsertRecordEvent(tenantId: string, eventId: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const event = clone(objectValue(source.event ?? source));
    const id = text(eventId);
    const recordId = text(event.recordId);
    if (!id || !recordId) throw new BadRequestException('У события записи отсутствует id или recordId');
    event.id = id;
    event.recordId = recordId;
    await this.prisma.businessRecordEvent.upsert({
      where: { tenantId_eventId: { tenantId, eventId: id } },
      create: { tenantId, eventId: id, recordId, position: positionValue(source.position), data: json(event) },
      update: { recordId, position: positionValue(source.position), data: json(event) },
    });
    return event;
  }

  private async operationalBundle(tenantId: string) {
    const row = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
    const data = normalizeOperational(row?.data || {});
    return {
      migrated: Boolean(row),
      verified: Boolean(row?.migrationVerifiedAt),
      migrationVerifiedAt: row?.migrationVerifiedAt || null,
      ...data,
    };
  }

  getOperational(tenantId: string) {
    return this.operationalBundle(tenantId);
  }

  private async requireOperationalVerified(tenantId: string) {
    const row = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
    if (!row?.migrationVerifiedAt) throw new ConflictException('Перенос Графика, процедур и онлайн-записи ещё не подтверждён');
    return row;
  }

  async migrateOperational(tenantId: string, body: unknown) {
    const expected = normalizeOperational(body);
    const existing = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessOperationalState.create({ data: { tenantId, data: json(expected) } });
    }
    return this.operationalBundle(tenantId);
  }

  async verifyOperationalMigration(tenantId: string, body: unknown) {
    const expected = normalizeOperational(body);
    const current = await this.operationalBundle(tenantId);
    if (!current.migrated) throw new ConflictException('График, процедуры и онлайн-запись ещё не перенесены');
    const actual = normalizeOperational(current);
    if (canonicalOperational(actual) !== canonicalOperational(expected)) {
      throw new ConflictException('Проверка переноса Графика, процедур и онлайн-записи не пройдена');
    }
    await this.prisma.businessOperationalState.update({ where: { tenantId }, data: { migrationVerifiedAt: new Date() } });
    return this.operationalBundle(tenantId);
  }

  async bootstrapOperational(tenantId: string) {
    const existing = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessOperationalState.create({
        data: { tenantId, data: json(normalizeOperational({})), migrationVerifiedAt: new Date() },
      });
    }
    return this.operationalBundle(tenantId);
  }

  async updateOperationalDataset(tenantId: string, dataset: string, body: unknown) {
    const key = text(dataset);
    if (!OPERATIONAL_DATASETS.has(key)) throw new BadRequestException('Неизвестный набор рабочих данных');
    const row = await this.requireOperationalVerified(tenantId);
    const current = normalizeOperational(row.data);
    const source = objectValue(body);
    const value = source.value;
    if (key === 'bookingSettings') current.bookingSettings = value && typeof value === 'object' && !Array.isArray(value) ? clone(objectValue(value)) : null;
    else (current as any)[key] = Array.isArray(value) ? clone(value) : [];
    await this.prisma.businessOperationalState.update({ where: { tenantId }, data: { data: json(current) } });
    return current;
  }
}

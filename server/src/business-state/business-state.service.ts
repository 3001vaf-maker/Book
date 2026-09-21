import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RecordService } from '../record/record.service';

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
    people: normalizeRows(source.people, 'key', 'Люди'),
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

function canonicalJson(value: unknown) {
  return JSON.stringify(stable(value));
}

function canonicalOperational(value: OperationalBundle) {
  return JSON.stringify(stable(value));
}


function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))];
}

function accountIdsFromPerson(person: JsonObject) {
  return uniqueStrings(Array.isArray(person.accounts) ? person.accounts : []);
}

function phoneDigits(value: unknown) {
  return text(value).replace(/\D/g, '');
}

function phonesMatch(left: unknown, right: unknown) {
  const a = phoneDigits(left);
  const b = phoneDigits(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length === 11 && b.length === 11 && a.slice(1) === b.slice(1)
    && ((a.startsWith('7') && b.startsWith('8')) || (a.startsWith('8') && b.startsWith('7')));
}

function personHasPhone(person: JsonObject, phone: unknown) {
  return (Array.isArray(person.phones) ? person.phones : []).some((value) => phonesMatch(value, phone));
}


@Injectable()
export class BusinessStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly records: RecordService,
  ) {}

  private async bundle(tenantId: string) {
    const [meta, people, identity, records, recordEvents] = await Promise.all([
      this.prisma.businessStateMeta.findUnique({ where: { tenantId } }),
      this.prisma.person.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.ueiState.findUnique({ where: { tenantId } }),
      this.prisma.record.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.recordEvent.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
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
    if (!meta?.migrationVerifiedAt) throw new ConflictException('Перенос People, UEI и Записей ещё не подтверждён');
  }

  async migrate(tenantId: string, body: unknown) {
    const expected = normalizeBundle(body);
    const existing = await this.prisma.businessStateMeta.findUnique({ where: { tenantId } });
    if (existing) return this.bundle(tenantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.businessStateMeta.create({ data: { tenantId } });
      await tx.ueiState.create({ data: { tenantId, data: json(expected.uei) } });
      for (const [position, person] of expected.people.entries()) {
        await tx.person.create({ data: { tenantId, key: text(person.key), position, data: json(person) } });
      }
      for (const [position, record] of expected.records.entries()) {
        await tx.record.create({ data: { tenantId, recordId: text(record.id), position, data: json(record) } });
      }
      for (const [position, event] of expected.recordEvents.entries()) {
        await tx.recordEvent.create({
          data: { tenantId, eventId: text(event.id), recordId: text(event.recordId), position, data: json(event) },
        });
      }
    });

    return this.bundle(tenantId);
  }

  async verifyMigration(tenantId: string, body: unknown) {
    const expected = normalizeBundle(body);
    const current = await this.bundle(tenantId);
    if (!current.migrated) throw new ConflictException('People, UEI и Записи ещё не перенесены');
    const actual = normalizeBundle(current);
    if (canonical(actual) !== canonical(expected)) {
      throw new ConflictException('Проверка переноса People, UEI и Записей не пройдена');
    }
    await this.prisma.businessStateMeta.update({ where: { tenantId }, data: { migrationVerifiedAt: new Date() } });
    return this.bundle(tenantId);
  }

  async bootstrap(tenantId: string) {
    const existing = await this.prisma.businessStateMeta.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.businessStateMeta.create({ data: { tenantId, migrationVerifiedAt: new Date() } });
        await tx.ueiState.create({ data: { tenantId, data: json(normalizeUEI({})) } });
      });
    }
    return this.bundle(tenantId);
  }

  async upsertPerson(tenantId: string, key: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const person = clone(objectValue(source.person ?? source));
    const normalizedKey = text(key);
    if (!normalizedKey) throw new BadRequestException('У Person отсутствует key');
    person.key = normalizedKey;
    await this.prisma.person.upsert({
      where: { tenantId_key: { tenantId, key: normalizedKey } },
      create: { tenantId, key: normalizedKey, position: positionValue(source.position), data: json(person) },
      update: { position: positionValue(source.position), data: json(person) },
    });
    return person;
  }

  async deletePerson(tenantId: string, key: string) {
    await this.requireVerified(tenantId);
    const normalizedKey = text(key);
    const result = await this.prisma.person.deleteMany({ where: { tenantId, key: normalizedKey } });
    return { deleted: result.count };
  }

  async updateUEI(tenantId: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const uei = normalizeUEI(source.uei ?? source);
    await this.prisma.ueiState.upsert({
      where: { tenantId },
      create: { tenantId, data: json(uei) },
      update: { data: json(uei) },
    });
    return uei;
  }

  async upsertRecord(tenantId: string, recordId: string, body: unknown) {
    const id = text(recordId);
    if (!id) throw new BadRequestException('У записи отсутствует id');
    return this.records.upsertFromOwner(tenantId, id, body);
  }

  async deleteRecord(tenantId: string, recordId: string) {
    await this.requireVerified(tenantId);
    const id = text(recordId);
    const [events, record] = await this.prisma.$transaction([
      this.prisma.recordEvent.deleteMany({ where: { tenantId, recordId: id } }),
      this.prisma.record.deleteMany({ where: { tenantId, recordId: id } }),
    ]);
    return { deleted: record.count, deletedEvents: events.count };
  }

  async deleteRecordEvents(tenantId: string, recordId: string) {
    await this.requireVerified(tenantId);
    const result = await this.prisma.recordEvent.deleteMany({ where: { tenantId, recordId: text(recordId) } });
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

    const existing = await this.prisma.recordEvent.findUnique({
      where: { tenantId_eventId: { tenantId, eventId: id } },
    });
    if (existing) {
      const sameRecord = existing.recordId === recordId;
      const sameData = canonicalJson(objectValue(existing.data)) === canonicalJson(event);
      if (!sameRecord || !sameData) {
        throw new ConflictException('Событие Record неизменяемо и не может быть переписано');
      }
      return clone(objectValue(existing.data));
    }

    if (text(event.type) === 'created') {
      const recordEvents = await this.prisma.recordEvent.findMany({ where: { tenantId, recordId } });
      const created = recordEvents.find((row) => text(objectValue(row.data).type) === 'created');
      if (created) return clone(objectValue(created.data));
    }

    await this.prisma.recordEvent.create({
      data: {
        tenantId,
        eventId: id,
        recordId,
        position: positionValue(source.position),
        data: json(event),
      },
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

  async publicOperational(tenantId: string) {
    const row = await this.requireOperationalVerified(tenantId);
    return normalizeOperational(row.data);
  }

  async bookingIdentityForAccount(tenantId: string, accountId: string) {
    await this.requireVerified(tenantId);
    const id = text(accountId);
    const [rows, identityRow] = await Promise.all([
      this.prisma.person.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.ueiState.findUnique({ where: { tenantId } }),
    ]);
    const people = rows.map((row) => ({ row, person: objectValue(row.data) }));
    const matched = people.find(({ person }) => accountIdsFromPerson(person).includes(id)) || null;
    if (!matched) return { person: null, matchedPerson: null, uei: '', memberPeople: [], accountIds: id ? [id] : [] };

    const identity = normalizeUEI(identityRow?.data || {});
    const matchedKey = text(matched.person.key || matched.row.key);
    const uei = text(identity.relations[`person:${matchedKey}`]);
    const entity = uei ? objectValue(identity.entities[uei]) : {};
    const memberKeys = uei
      ? uniqueStrings((Array.isArray(entity.members) ? entity.members : [])
          .map((value) => text(value))
          .filter((value) => value.startsWith('person:'))
          .map((value) => value.slice(7)))
      : [matchedKey];
    const memberPeople = people.filter(({ row, person }) => memberKeys.includes(text(person.key || row.key)));
    const ownerKey = objectValue(entity.owner).type === 'person' ? text(objectValue(entity.owner).id) : '';
    const primary = memberPeople.find(({ row, person }) => text(person.key || row.key) === ownerKey) || matched;
    const accountIds = uniqueStrings(memberPeople.flatMap(({ person }) => accountIdsFromPerson(person)));
    return {
      person: primary.person,
      matchedPerson: matched.person,
      uei,
      memberPeople: memberPeople.map(({ person }) => person),
      accountIds: accountIds.length ? accountIds : [id],
    };
  }

  async accountIdsForIdentity(tenantId: string, phoneValue: unknown, ueiValue: unknown) {
    await this.requireVerified(tenantId);
    const phone = text(phoneValue);
    const requestedUei = text(ueiValue);
    if (!phone && !requestedUei) return [];

    const [rows, identityRow] = await Promise.all([
      this.prisma.person.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.ueiState.findUnique({ where: { tenantId } }),
    ]);
    const people = rows.map((row) => ({ row, person: objectValue(row.data) }));
    const identity = normalizeUEI(identityRow?.data || {});
    const memberKeys = new Set<string>();

    const addUeiMembers = (uei: string) => {
      const entity = objectValue(identity.entities[uei]);
      for (const member of Array.isArray(entity.members) ? entity.members : []) {
        const value = text(member);
        if (value.startsWith('person:')) memberKeys.add(value.slice(7));
      }
    };

    if (requestedUei) addUeiMembers(requestedUei);

    if (phone) {
      for (const { row, person } of people) {
        if (!personHasPhone(person, phone)) continue;
        const key = text(person.key || row.key);
        if (!key) continue;
        memberKeys.add(key);
        const linkedUei = text(identity.relations[`person:${key}`]);
        if (linkedUei) addUeiMembers(linkedUei);
      }
    }

    return uniqueStrings(
      people
        .filter(({ row, person }) => memberKeys.has(text(person.key || row.key)))
        .flatMap(({ person }) => accountIdsFromPerson(person)),
    );
  }





}

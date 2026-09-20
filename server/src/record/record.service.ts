import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { FinanceService } from '../finance/finance.service';
import { ProcedureService } from '../procedure/procedure.service';
import { TimeService } from '../time/time.service';

type JsonObject = Record<string, any>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function dateValue(value: unknown) {
  return text(value).slice(0, 10);
}

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

@Injectable()
export class RecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly time: TimeService,
    private readonly finance: FinanceService,
    private readonly procedures: ProcedureService,
  ) {}

  private async requireVerified(tenantId: string) {
    const meta = await this.prisma.businessStateMeta.findUnique({ where: { tenantId } });
    if (!meta?.migrationVerifiedAt) throw new ConflictException('Хранилище Record ещё не подтверждено');
  }

  private subject(person: JsonObject) {
    return {
      personId: text(person?.id),
      personKey: text(person?.key),
      name: text(person?.name),
      surname: text(person?.surname),
    };
  }

  private appointment(record: JsonObject) {
    return {
      date: dateValue(record?.date),
      workplaceId: text(record?.workplaceId),
      from: text(record?.from),
      to: text(record?.to),
    };
  }

  private async validateAvailability(
    tenantId: string,
    { date, workplaceId, from, to }: { date: string; workplaceId: string; from: string; to: string },
    { excludeRecordId = '', excludeRequestId = '' } = {},
  ) {
    const operationalRow = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
    const operational = objectValue(operationalRow?.data);
    const day = arrayValue(operational.days)
      .find((item) => text(item?.workplaceId) === workplaceId && dateValue(item?.date) === date);
    if (!day) throw new ConflictException('Эта дата больше не доступна');

    const workplace = await this.prisma.workplace.findUnique({ where: { tenantId_key: { tenantId, key: workplaceId } } });
    const planFrom = text(day?.from) || text(workplace?.from);
    const planTo = text(day?.to) || text(workplace?.to);

    const [records, events, pending] = await Promise.all([
      this.prisma.businessRecord.findMany({ where: { tenantId } }),
      this.prisma.businessRecordEvent.findMany({ where: { tenantId } }),
      this.prisma.bookingRequest.findMany({
        where: {
          tenantId,
          workplaceKey: workplaceId,
          date,
          status: 'PENDING',
          ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
        },
        select: { id: true, from: true, to: true },
      }),
    ]);
    const cancelled = new Set(events
      .filter((row) => text(objectValue(row.data).type) === 'cancelled')
      .map((row) => row.recordId));

    const recordUsages = records
      .map((row) => objectValue(row.data))
      .filter((record) => {
        const id = text(record?.id);
        return id
          && id !== excludeRecordId
          && !cancelled.has(id)
          && text(record?.status) !== 'cancelled'
          && text(record?.workplaceId) === workplaceId
          && dateValue(record?.date) === date;
      })
      .map((record) => ({ id: text(record.id), from: text(record.from), to: text(record.to) }));

    const breaks = arrayValue(operational.breaks)
      .filter((item) => text(item?.workplaceId) === workplaceId && dateValue(item?.date) === date)
      .map((item) => ({ id: text(item?.id), from: text(item?.from), to: text(item?.to) }));

    const pendingUsages = pending.map((item) => ({ id: `booking-request:${item.id}`, from: item.from, to: item.to }));
    const result = this.time.checkAvailability({
      planFrom,
      planTo,
      from,
      to,
      usages: [...recordUsages, ...breaks, ...pendingUsages],
    });
    if (!result.ok) {
      if (result.reason === 'outside-working-time') throw new ConflictException('Время находится вне рабочего графика');
      throw new ConflictException('Это время уже занято');
    }
  }

  async create(tenantId: string, input: JsonObject, position?: number) {
    await this.requireVerified(tenantId);
    const id = text(input.id) || randomUUID();
    const sourceRequestId = text(input.sourceRequestId);
    if (sourceRequestId) {
      const existingRows = await this.prisma.businessRecord.findMany({ where: { tenantId } });
      const existing = existingRows.find((row) => text(objectValue(row.data).sourceRequestId) === sourceRequestId);
      if (existing) return objectValue(existing.data);
    }
    const existingId = await this.prisma.businessRecord.findUnique({ where: { tenantId_recordId: { tenantId, recordId: id } } });
    if (existingId) return objectValue(existingId.data);

    const date = dateValue(input.date);
    const workplaceId = text(input.workplaceId);
    const from = text(input.from);
    const to = text(input.to);
    await this.validateAvailability(tenantId, { date, workplaceId, from, to }, { excludeRequestId: sourceRequestId });

    const requestedProcedures = arrayValue(input.procedures);
    const procedureIds = [...new Set(arrayValue(input.procedureIds).map(text).filter(Boolean).length
      ? arrayValue(input.procedureIds).map(text).filter(Boolean)
      : requestedProcedures.map((item) => text(item?.id)).filter(Boolean))];
    let procedureSnapshots = requestedProcedures.map((item) => clone(objectValue(item)));
    if (procedureIds.length) {
      const canonical = await this.procedures.snapshots(tenantId, workplaceId, procedureIds);
      const requestedById = new Map(requestedProcedures.map((item) => [text(item?.id), objectValue(item)]));
      procedureSnapshots = canonical.map((item) => {
        const requested = requestedById.get(item.id);
        const requestedDuration = Number(requested?.duration);
        return {
          ...item,
          duration: Number.isFinite(requestedDuration) && requestedDuration > 0 ? requestedDuration : item.duration,
        };
      });
    }

    const products = arrayValue(input.products).map((item) => clone(objectValue(item)));
    const person = clone(objectValue(input.person));
    const finance = this.finance.calculatePlan([
      ...procedureSnapshots.map((item) => ({ ...item, sourceType: 'procedure', sourceId: item.id })),
      ...products.map((item) => ({ ...item, sourceType: 'product', sourceId: text(item?.id) })),
    ], person?.discountPercent);

    const now = new Date().toISOString();
    const createdAt = text(input.createdAt) || now;
    const actor = clone(objectValue(input.createdBy ?? input.actor));
    const record = {
      id,
      date,
      workplaceId,
      from,
      to,
      person,
      procedures: procedureSnapshots,
      products,
      source: text(input.source) || 'manual',
      sourceRequestId,
      createdBy: actor,
      finance,
      createdAt,
      updatedAt: text(input.updatedAt) || createdAt,
    };
    const event = {
      id: randomUUID(),
      recordId: id,
      type: 'created',
      category: 'action',
      at: createdAt,
      source: record.source,
      actor,
      subject: this.subject(person),
      payload: { appointment: this.appointment(record) },
    };

    const resolvedPosition = Number.isInteger(position)
      ? Number(position)
      : (await this.prisma.businessRecord.count({ where: { tenantId } }));
    await this.prisma.$transaction([
      this.prisma.businessRecord.create({ data: { tenantId, recordId: id, position: resolvedPosition, data: json(record) } }),
      this.prisma.businessRecordEvent.create({ data: { tenantId, eventId: event.id, recordId: id, position: 0, data: json(event) } }),
    ]);
    return record;
  }

  private projectLifecycle(record: JsonObject, events: JsonObject[]) {
    let status = text(record?.status) === 'cancelled' ? 'cancelled' : 'active';
    let confirmed = Boolean(record?.confirmed);
    let attendance = ['arrived', 'no-show'].includes(text(record?.attendance)) ? text(record.attendance) : '';
    let confirmedAt = text(record?.confirmedAt);
    let attendanceAt = text(record?.attendanceAt);
    let cancelledAt = text(record?.cancelledAt);
    const ordered = events.slice().sort((left, right) => String(left?.at || '').localeCompare(String(right?.at || '')));
    for (const event of ordered) {
      const type = text(event?.type);
      const at = text(event?.at);
      if (type === 'confirmed') {
        confirmed = true;
        confirmedAt = at;
      } else if (type === 'unconfirmed') {
        confirmed = false;
        confirmedAt = at;
      } else if (type === 'arrived') {
        attendance = 'arrived';
        attendanceAt = at;
      } else if (type === 'no-show') {
        attendance = 'no-show';
        attendanceAt = at;
      } else if (type === 'attendance-cleared') {
        attendance = '';
        attendanceAt = at;
      } else if (type === 'cancelled') {
        status = 'cancelled';
        cancelledAt = at;
      }
    }
    return { status, confirmed, attendance, confirmedAt, attendanceAt, cancelledAt };
  }

  async listForPeople(tenantId: string, people: JsonObject[]) {
    await this.requireVerified(tenantId);
    const personKeys = new Set(people.map((person) => text(person?.key)).filter(Boolean));
    const personIds = new Set(people.map((person) => text(person?.id)).filter(Boolean));
    if (!personKeys.size && !personIds.size) return [];

    const [rows, eventRows] = await Promise.all([
      this.prisma.businessRecord.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.businessRecordEvent.findMany({ where: { tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    ]);
    const byRecord = new Map<string, JsonObject[]>();
    for (const row of eventRows) {
      const list = byRecord.get(row.recordId) || [];
      list.push(objectValue(row.data));
      byRecord.set(row.recordId, list);
    }

    const result = [];
    for (const row of rows) {
      const record = objectValue(row.data);
      const person = objectValue(record.person);
      if (!personKeys.has(text(person?.key)) && !personIds.has(text(person?.id))) continue;
      const events = byRecord.get(text(record.id)) || [];
      const lifecycle = this.projectLifecycle(record, events);
      const storedPlan = objectValue(record.finance);
      const plan = Object.keys(storedPlan).length
        ? storedPlan
        : this.finance.calculatePlan([
            ...arrayValue(record.procedures).map((item) => ({ ...objectValue(item), sourceType: 'procedure', sourceId: text(item?.id) })),
            ...arrayValue(record.products).map((item) => ({ ...objectValue(item), sourceType: 'product', sourceId: text(item?.id) })),
          ], person?.discountPercent);
      const payment = await this.finance.recordPaymentState(tenantId, text(record.id), plan);
      result.push({
        ...record,
        ...lifecycle,
        finance: plan,
        payment,
        history: events,
      });
    }
    return result.sort((left, right) => {
      const a = `${dateValue(left?.date)}T${text(left?.from)}`;
      const b = `${dateValue(right?.date)}T${text(right?.from)}`;
      return b.localeCompare(a);
    });
  }

  async upsertFromOwner(tenantId: string, recordId: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const record = clone(objectValue(source.record ?? source));
    const id = text(recordId);
    record.id = id;
    const existing = await this.prisma.businessRecord.findUnique({ where: { tenantId_recordId: { tenantId, recordId: id } } });
    if (!existing) return this.create(tenantId, record, Number(source.position));

    const current = objectValue(existing.data);
    const scheduleChanged = ['date', 'workplaceId', 'from', 'to']
      .some((key) => text(current?.[key]) !== text(record?.[key]));
    if (scheduleChanged) {
      await this.validateAvailability(tenantId, {
        date: dateValue(record.date),
        workplaceId: text(record.workplaceId),
        from: text(record.from),
        to: text(record.to),
      }, { excludeRecordId: id });
    }
    await this.prisma.businessRecord.update({
      where: { tenantId_recordId: { tenantId, recordId: id } },
      data: { position: Number.isInteger(Number(source.position)) ? Number(source.position) : existing.position, data: json(record) },
    });
    return record;
  }
}

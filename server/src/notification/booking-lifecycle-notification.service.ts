import { Injectable } from '@nestjs/common';
import { BookingRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificationService } from './notification.service';
import { bookingTemplateValues, NotificationTemplateService } from './notification-template.service';

type JsonObject = Record<string, any>;

type Schedule = {
  date: string;
  workplaceId: string;
  from: string;
  to: string;
};

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function scheduleOf(record: JsonObject): Schedule {
  return {
    date: text(record.date).slice(0, 10),
    workplaceId: text(record.workplaceId),
    from: text(record.from),
    to: text(record.to),
  };
}

function scheduleChanged(before: JsonObject, after: JsonObject) {
  const left = scheduleOf(before);
  const right = scheduleOf(after);
  return left.date !== right.date
    || left.workplaceId !== right.workplaceId
    || left.from !== right.from
    || left.to !== right.to;
}

function serviceNames(record: JsonObject) {
  return (Array.isArray(record.procedures) ? record.procedures : [])
    .map((item) => text(item?.name))
    .filter(Boolean)
    .join(', ');
}

function clientName(record: JsonObject) {
  const client = objectValue(record.client);
  return [text(client.name), text(client.surname)].filter(Boolean).join(' ').trim()
    || text(client.phone)
    || text(client.id)
    || text(client.key);
}

@Injectable()
export class BookingLifecycleNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly templates: NotificationTemplateService,
  ) {}

  async recordBefore(tenantId: string, recordId: string) {
    const row = await this.prisma.businessRecord.findUnique({
      where: { tenantId_recordId: { tenantId, recordId: text(recordId) } },
      select: { data: true },
    });
    return row ? objectValue(row.data) : null;
  }

  async recordEventExists(tenantId: string, eventId: string) {
    const row = await this.prisma.businessRecordEvent.findUnique({
      where: { tenantId_eventId: { tenantId, eventId: text(eventId) } },
      select: { id: true },
    });
    return Boolean(row);
  }

  private async requestForRecord(tenantId: string, record: JsonObject) {
    const recordId = text(record.id);
    const sourceRequestId = text(record.sourceRequestId);
    const byImported = recordId ? await this.prisma.bookingRequest.findFirst({ where: { tenantId, importedRecordId: recordId } }) : null;
    if (byImported) return byImported;
    if (!sourceRequestId) return null;
    return this.prisma.bookingRequest.findFirst({ where: { tenantId, id: sourceRequestId } });
  }

  private async accountIdForRecord(tenantId: string, record: JsonObject) {
    const client = objectValue(record.client);
    const direct = text(client.accountId);
    if (direct) {
      const account = await this.prisma.bookingAccount.findFirst({ where: { tenantId, id: direct }, select: { id: true } });
      if (account) return account.id;
    }

    const request = await this.requestForRecord(tenantId, record);
    if (request?.accountId) return request.accountId;

    const clientKey = text(client.key);
    if (!clientKey) return '';
    const person = await this.prisma.businessPerson.findUnique({
      where: { tenantId_key: { tenantId, key: clientKey } },
      select: { data: true },
    });
    const accounts = Array.isArray(objectValue(person?.data).accounts) ? objectValue(person?.data).accounts : [];
    for (const value of accounts) {
      const accountId = text(value);
      if (!accountId) continue;
      const account = await this.prisma.bookingAccount.findFirst({ where: { tenantId, id: accountId }, select: { id: true } });
      if (account) return account.id;
    }
    return '';
  }

  private templateValues(record: JsonObject) {
    const schedule = scheduleOf(record);
    return bookingTemplateValues({
      client: clientName(record),
      date: schedule.date,
      from: schedule.from,
      to: schedule.to,
      services: serviceNames(record),
    });
  }

  private async sendClient(tenantId: string, accountId: string, eventType: string, record: JsonObject) {
    if (!accountId) return null;
    const template = await this.templates.render(tenantId, eventType, this.templateValues(record));
    return this.notifications.createForAccount(tenantId, accountId, {
      type: eventType,
      title: template.title,
      body: template.body,
      entityType: 'record',
      entityId: text(record.id),
    });
  }

  private async syncRequestSchedule(tenantId: string, record: JsonObject) {
    const request = await this.requestForRecord(tenantId, record);
    if (!request) return null;
    const schedule = scheduleOf(record);
    return this.prisma.bookingRequest.update({
      where: { id: request.id },
      data: {
        workplaceKey: schedule.workplaceId || request.workplaceKey,
        date: schedule.date || request.date,
        from: schedule.from || request.from,
        to: schedule.to || request.to,
      },
    });
  }

  private async eventTypesForRecord(tenantId: string, recordId: string) {
    const rows = await this.prisma.businessRecordEvent.findMany({
      where: { tenantId, recordId },
      select: { data: true },
    });
    return new Set(rows.map((row) => text(objectValue(row.data).type)).filter(Boolean));
  }

  async afterRecordUpsert(tenantId: string, beforeValue: unknown, afterValue: unknown) {
    const before = beforeValue ? objectValue(beforeValue) : null;
    const after = objectValue(afterValue);
    const accountId = await this.accountIdForRecord(tenantId, after);
    if (!accountId) return { notified: false, reason: 'no-client-account' };

    if (!before) {
      await this.sendClient(tenantId, accountId, 'booking.created', after);
      return { notified: true, eventType: 'booking.created' };
    }

    if (scheduleChanged(before, after)) {
      await this.syncRequestSchedule(tenantId, after);
      await this.sendClient(tenantId, accountId, 'booking.rescheduled', after);
      return { notified: true, eventType: 'booking.rescheduled' };
    }

    return { notified: false, reason: 'no-notifiable-change' };
  }

  async afterRecordEventUpsert(tenantId: string, eventValue: unknown, alreadyExisted: boolean) {
    if (alreadyExisted) return { notified: false, reason: 'existing-event' };
    const event = objectValue(eventValue);
    const eventType = text(event.type);
    if (eventType !== 'cancelled' && eventType !== 'completed') {
      return { notified: false, reason: 'unsupported-event' };
    }

    const recordId = text(event.recordId);
    if (!recordId) return { notified: false, reason: 'missing-record' };
    const row = await this.prisma.businessRecord.findUnique({
      where: { tenantId_recordId: { tenantId, recordId } },
      select: { data: true },
    });
    if (!row) return { notified: false, reason: 'missing-record' };
    const record = objectValue(row.data);
    const accountId = await this.accountIdForRecord(tenantId, record);

    if (eventType === 'cancelled') {
      const request = await this.requestForRecord(tenantId, record);
      if (request && request.status !== BookingRequestStatus.CANCELLED) {
        await this.prisma.bookingRequest.update({
          where: { id: request.id },
          data: { status: BookingRequestStatus.CANCELLED },
        });
      }
      if (!accountId) return { notified: false, reason: 'no-client-account' };
      await this.sendClient(tenantId, accountId, 'booking.cancelled', record);
      return { notified: true, eventType: 'booking.cancelled' };
    }

    const eventTypes = await this.eventTypesForRecord(tenantId, recordId);
    if (eventTypes.has('cancelled') || eventTypes.has('no-show')) {
      return { notified: false, reason: 'record-not-completable' };
    }
    if (!accountId) return { notified: false, reason: 'no-client-account' };
    await this.sendClient(tenantId, accountId, 'booking.completed', record);
    return { notified: true, eventType: 'booking.completed' };
  }
}

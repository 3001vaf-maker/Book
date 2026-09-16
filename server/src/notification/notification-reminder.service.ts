import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { BookingLifecycleNotificationService } from './booking-lifecycle-notification.service';
import { NotificationTemplateService } from './notification-template.service';

type JsonObject = Record<string, any>;

type ReminderRuleRow = {
  id: string;
  tenantId: string;
  minutesBefore: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ClaimRow = { id: string };

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function reminderTimeZone() {
  return text(process.env.BOOK_TIME_ZONE) || 'Europe/Moscow';
}

function zonedWallClockMinute(now: Date) {
  let parts: Intl.DateTimeFormatPart[] = [];
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: reminderTimeZone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
  } catch {
    return Math.floor(now.getTime() / 60000);
  }
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return Math.floor(Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute')) / 60000);
}

function appointmentWallClockMinute(record: JsonObject) {
  const date = text(record.date).slice(0, 10);
  const time = text(record.from);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match || !clock) return 0;
  return Math.floor(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(clock[1]),
    Number(clock[2]),
  ) / 60000);
}

function normalizeMinutes(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 43200))]
    .sort((left, right) => right - left)
    .slice(0, 20);
}

function eventType(value: unknown) {
  return text(objectValue(value).type);
}

@Injectable()
export class NotificationReminderService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private sweeping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: BookingLifecycleNotificationService,
    private readonly templates: NotificationTemplateService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweep().catch(() => undefined), 30_000);
    this.timer.unref?.();
    void this.sweep().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async listRules(tenantId: string) {
    const rows = await this.prisma.$queryRaw<ReminderRuleRow[]>`
      SELECT "id", "tenantId", "minutesBefore", "enabled", "createdAt", "updatedAt"
      FROM "NotificationReminderRule"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "minutesBefore" DESC
    `;
    return rows.map((row) => ({
      id: row.id,
      minutesBefore: Number(row.minutesBefore),
      enabled: Boolean(row.enabled),
    }));
  }

  async saveRules(tenantId: string, input: { minutesBefore?: unknown }) {
    if (!Array.isArray(input?.minutesBefore)) throw new BadRequestException('Не указан список напоминаний');
    const minutes = normalizeMinutes(input.minutesBefore);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "NotificationReminderRule"
        SET "enabled" = false, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "tenantId" = ${tenantId}
      `;
      for (const minutesBefore of minutes) {
        await tx.$executeRaw`
          INSERT INTO "NotificationReminderRule" (
            "id", "tenantId", "minutesBefore", "enabled", "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}, ${tenantId}, ${minutesBefore}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("tenantId", "minutesBefore") DO UPDATE
          SET "enabled" = true, "updatedAt" = CURRENT_TIMESTAMP
        `;
      }
    });
    return this.listRules(tenantId);
  }

  private async claim(tenantId: string, recordId: string, ruleId: string, scheduleKey: string) {
    const rows = await this.prisma.$queryRaw<ClaimRow[]>`
      INSERT INTO "NotificationReminderDelivery" (
        "id", "tenantId", "recordId", "ruleId", "scheduleKey", "createdAt", "sentAt"
      ) VALUES (
        ${randomUUID()}, ${tenantId}, ${recordId}, ${ruleId}, ${scheduleKey}, CURRENT_TIMESTAMP, NULL
      )
      ON CONFLICT ("tenantId", "recordId", "ruleId", "scheduleKey") DO NOTHING
      RETURNING "id"
    `;
    return rows[0]?.id || '';
  }

  private async releaseClaim(id: string) {
    if (!id) return;
    await this.prisma.$executeRaw`
      DELETE FROM "NotificationReminderDelivery" WHERE "id" = ${id}
    `;
  }

  private async markSent(id: string) {
    if (!id) return;
    await this.prisma.$executeRaw`
      UPDATE "NotificationReminderDelivery"
      SET "sentAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `;
  }

  async sweep(now = new Date()) {
    if (this.sweeping) return { sent: 0, skipped: 'already-running' };
    this.sweeping = true;
    let sent = 0;
    try {
      const rules = await this.prisma.$queryRaw<ReminderRuleRow[]>`
        SELECT "id", "tenantId", "minutesBefore", "enabled", "createdAt", "updatedAt"
        FROM "NotificationReminderRule"
        WHERE "enabled" = true
        ORDER BY "tenantId" ASC, "minutesBefore" DESC
      `;
      const byTenant = new Map<string, ReminderRuleRow[]>();
      for (const rule of rules) {
        const current = byTenant.get(rule.tenantId) || [];
        current.push(rule);
        byTenant.set(rule.tenantId, current);
      }
      const currentMinute = zonedWallClockMinute(now);

      for (const [tenantId, tenantRules] of byTenant) {
        const template = await this.templates.get(tenantId, 'booking.reminder');
        if (!template.enabled) continue;
        const [recordRows, eventRows] = await Promise.all([
          this.prisma.businessRecord.findMany({
            where: { tenantId },
            select: { recordId: true, data: true },
          }),
          this.prisma.businessRecordEvent.findMany({
            where: { tenantId },
            select: { recordId: true, data: true },
          }),
        ]);
        const eventTypes = new Map<string, Set<string>>();
        for (const row of eventRows) {
          const type = eventType(row.data);
          if (!type) continue;
          const current = eventTypes.get(row.recordId) || new Set<string>();
          current.add(type);
          eventTypes.set(row.recordId, current);
        }

        for (const row of recordRows) {
          const types = eventTypes.get(row.recordId) || new Set<string>();
          if (types.has('cancelled') || types.has('completed') || types.has('no-show')) continue;
          const source = objectValue(row.data);
          const record = { ...source, id: text(source.id) || row.recordId };
          const appointmentMinute = appointmentWallClockMinute(record);
          if (!appointmentMinute) continue;
          const leadMinutes = appointmentMinute - currentMinute;
          if (leadMinutes < 0) continue;
          const scheduleKey = `${text(record.date).slice(0, 10)}|${text(record.from)}|${text(record.to)}`;

          for (const rule of tenantRules) {
            const minutesBefore = Number(rule.minutesBefore);
            if (leadMinutes > minutesBefore || leadMinutes < minutesBefore - 2) continue;
            const claimId = await this.claim(tenantId, row.recordId, rule.id, scheduleKey);
            if (!claimId) continue;
            try {
              const result = await this.lifecycle.notifyReminderForRecord(tenantId, record);
              if (result.notified) {
                await this.markSent(claimId);
                sent += 1;
              } else {
                await this.releaseClaim(claimId);
              }
            } catch {
              await this.releaseClaim(claimId);
            }
          }
        }
      }
      return { sent };
    } finally {
      this.sweeping = false;
    }
  }
}

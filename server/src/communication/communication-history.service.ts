import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';

type CommunicationHistoryRow = {
  id: string; tenantId: string; personPhone: string; uei: string; direction: string; kind: string; purpose: string | null; channel: string; body: string;
  attachments: unknown; externalMessageId: string; externalThreadId: string; status: string; createdAt: Date; sentAt: Date | null;
  deliveredAt: Date | null; readAt: Date | null; failedAt: Date | null; error: string;
};

type PreferenceRow = {
  id: string; tenantId: string; personPhone: string; uei: string; preferredChannels: unknown; createdAt: Date; updatedAt: Date;
};

const KNOWN_CHANNELS = new Set(['IN_APP', 'PUSH', 'TELEGRAM', 'EMAIL', 'SMS', 'WHATSAPP']);

function text(value: unknown) { return String(value ?? '').trim(); }
function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}
function normalizeChannels(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map((item) => text(item).toUpperCase()).filter((item) => KNOWN_CHANNELS.has(item)))];
}

@Injectable()
export class CommunicationHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listThread(tenantId: string, input: { phone?: unknown; uei?: unknown }, limit = 300) {
    const personPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    if (!personPhone && !uei) throw new BadRequestException('Не указан человек');
    const safeLimit = Math.max(1, Math.min(1000, Math.floor(Number(limit) || 300)));
    return this.prisma.$queryRaw<CommunicationHistoryRow[]>`
      WITH history AS (
        SELECT m."id", m."tenantId", m."personPhone", m."uei", m."direction", m."kind", m."purpose", m."channel", m."body", m."attachments",
          m."externalMessageId", m."externalThreadId", m."status", m."createdAt", m."sentAt", m."deliveredAt",
          m."readAt", m."failedAt", m."error"
        FROM "CommunicationMessage" m
        WHERE m."tenantId" = ${tenantId}
          AND ((${personPhone} <> '' AND m."personPhone" = ${personPhone}) OR (${personPhone} = '' AND ${uei} <> '' AND m."uei" = ${uei}))
        UNION ALL
        SELECT ('notification:' || n."id") AS "id", n."tenantId", n."personPhone", n."uei", 'system' AS "direction",
          'notification' AS "kind", n."purpose" AS "purpose", 'IN_APP' AS "channel",
          CASE WHEN n."body" = '' THEN n."title" ELSE n."title" || E'\n' || n."body" END AS "body",
          '[]'::jsonb AS "attachments", '' AS "externalMessageId", n."entityId" AS "externalThreadId", d."status", n."createdAt", d."sentAt",
          d."deliveredAt", d."readAt", d."failedAt", d."error"
        FROM "Notification" n
        INNER JOIN "NotificationDelivery" d ON d."notificationId" = n."id" AND d."tenantId" = n."tenantId" AND d."channel" = 'IN_APP'
        WHERE n."tenantId" = ${tenantId}
          AND ((${personPhone} <> '' AND n."personPhone" = ${personPhone}) OR (${personPhone} = '' AND ${uei} <> '' AND n."uei" = ${uei}))
      )
      SELECT * FROM history ORDER BY "createdAt" ASC, "id" ASC LIMIT ${safeLimit}
    `;
  }

  async listThreads(tenantId: string, limit = 200) {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 200)));
    return this.prisma.$queryRaw<CommunicationHistoryRow[]>`
      WITH history AS (
        SELECT m."id", m."tenantId", m."personPhone", m."uei", m."direction", m."kind", m."purpose", m."channel", m."body", m."attachments",
          m."externalMessageId", m."externalThreadId", m."status", m."createdAt", m."sentAt", m."deliveredAt",
          m."readAt", m."failedAt", m."error"
        FROM "CommunicationMessage" m WHERE m."tenantId" = ${tenantId}
        UNION ALL
        SELECT ('notification:' || n."id") AS "id", n."tenantId", n."personPhone", n."uei", 'system' AS "direction",
          'notification' AS "kind", n."purpose" AS "purpose", 'IN_APP' AS "channel",
          CASE WHEN n."body" = '' THEN n."title" ELSE n."title" || E'\n' || n."body" END AS "body",
          '[]'::jsonb AS "attachments", '' AS "externalMessageId", n."entityId" AS "externalThreadId", d."status", n."createdAt", d."sentAt",
          d."deliveredAt", d."readAt", d."failedAt", d."error"
        FROM "Notification" n
        INNER JOIN "NotificationDelivery" d ON d."notificationId" = n."id" AND d."tenantId" = n."tenantId" AND d."channel" = 'IN_APP'
        WHERE n."tenantId" = ${tenantId}
      ), latest AS (
        SELECT DISTINCT ON (COALESCE(NULLIF("personPhone", ''), "uei")) * FROM history
        WHERE "uei" <> '' OR "personPhone" <> ''
        ORDER BY COALESCE(NULLIF("personPhone", ''), "uei"), "createdAt" DESC, "id" DESC
      )
      SELECT * FROM latest ORDER BY "createdAt" DESC, "id" DESC LIMIT ${safeLimit}
    `;
  }

  async getPreferences(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const personPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    if (!personPhone && !uei) throw new BadRequestException('Не указан человек');
    const rows = await this.prisma.$queryRaw<PreferenceRow[]>`
      SELECT "id", "tenantId", "personPhone", "uei", "preferredChannels", "createdAt", "updatedAt"
      FROM "CommunicationPreference"
      WHERE "tenantId" = ${tenantId}
        AND ((${personPhone} <> '' AND "personPhone" = ${personPhone}) OR (${personPhone} = '' AND ${uei} <> '' AND "uei" = ${uei}))
      ORDER BY "updatedAt" DESC LIMIT 1
    `;
    const row = rows[0] || null;
    return { personPhone: row?.personPhone || personPhone, uei: row?.uei || uei, preferredChannels: normalizeChannels(row?.preferredChannels), updatedAt: row?.updatedAt || null };
  }

  async savePreferences(tenantId: string, input: { phone?: unknown; uei?: unknown; preferredChannels?: unknown }) {
    const personPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    if (!personPhone) throw new BadRequestException('Для настроек каналов нужен телефон человека');
    const preferredChannels = normalizeChannels(input?.preferredChannels);
    const json = JSON.stringify(preferredChannels);
    await this.prisma.$executeRaw`
      INSERT INTO "CommunicationPreference" ("id", "tenantId", "personPhone", "uei", "preferredChannels", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${tenantId}, ${personPhone}, ${uei}, ${json}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("tenantId", "personPhone") DO UPDATE
      SET "uei" = EXCLUDED."uei", "preferredChannels" = EXCLUDED."preferredChannels", "updatedAt" = CURRENT_TIMESTAMP
    `;
    return this.getPreferences(tenantId, { phone: personPhone, uei });
  }
}

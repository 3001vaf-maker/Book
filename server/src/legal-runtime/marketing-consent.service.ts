import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';

function text(value: unknown) { return String(value ?? '').trim(); }

@Injectable()
export class MarketingConsentService {
  constructor(private readonly prisma: PrismaService) {}

  private async currentDocument(tenantId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ documentId: string; versionId: string; version: number }>>`
      SELECT d."id" AS "documentId", v."id" AS "versionId", v."version"
      FROM "LegalDocument" d
      JOIN "LegalDocumentVersion" v ON v."documentId" = d."id" AND v."supersededAt" IS NULL
      WHERE d."scope" = 'TENANT'
        AND d."tenantId" = ${tenantId}
        AND d."key" = 'marketing-consent'
        AND d."isActive" = true
      LIMIT 1
    `;
    const current = rows[0];
    if (!current) throw new ConflictException('Актуальная версия согласия на маркетинг не опубликована');
    return current;
  }

  async state(tenantId: string, telegramUserIdValue: unknown) {
    const telegramUserId = text(telegramUserIdValue);
    if (!telegramUserId) return { allowed: false, channel: 'TELEGRAM', event: null };
    const current = await this.currentDocument(tenantId);
    const subjectKey = `TELEGRAM:${telegramUserId}`;
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      documentVersion: number;
      status: string;
      occurredAt: Date;
      source: string;
    }>>`
      SELECT "id", "documentVersion", "status", "occurredAt", "source"
      FROM "ConsentEvent"
      WHERE "tenantId" = ${tenantId}
        AND "subjectType" = 'CONTACT_POINT'
        AND "subjectKey" = ${subjectKey}
        AND "documentId" = 'marketing-consent'
      ORDER BY "occurredAt" DESC, "createdAt" DESC, "id" DESC
      LIMIT 1
    `;
    const latest = rows[0] || null;
    return {
      allowed: Boolean(latest && latest.status === 'accepted' && Number(latest.documentVersion) === Number(current.version)),
      channel: 'TELEGRAM',
      documentVersion: current.version,
      event: latest ? {
        id: latest.id,
        status: latest.status,
        documentVersion: latest.documentVersion,
        occurredAt: latest.occurredAt,
        source: latest.source,
      } : null,
    };
  }

  async set(tenantId: string, telegramUserIdValue: unknown, accepted: boolean, sourceValue: unknown) {
    const telegramUserId = text(telegramUserIdValue);
    if (!telegramUserId) throw new BadRequestException('Telegram не привязан');
    const current = await this.currentDocument(tenantId);
    const subjectKey = `TELEGRAM:${telegramUserId}`;
    const state = await this.state(tenantId, telegramUserId);
    const nextStatus = accepted ? 'accepted' : 'revoked';
    if (state.event?.status === nextStatus && Number(state.event.documentVersion) === Number(current.version)) return state;

    const now = new Date();
    await this.prisma.$executeRaw`
      INSERT INTO "ConsentEvent" (
        "id", "tenantId", "subjectType", "subjectKey", "contactType", "contactValue",
        "documentId", "documentVersion", "status", "acceptedAt", "revokedAt", "source",
        "occurredAt", "migratedFromEventId", "createdAt"
      ) VALUES (
        ${randomUUID()}, ${tenantId}, 'CONTACT_POINT', ${subjectKey}, 'TELEGRAM', ${telegramUserId},
        'marketing-consent', ${current.version}, ${nextStatus},
        ${accepted ? now : null}, ${accepted ? null : now}, ${text(sourceValue) || 'client-marketing-settings'},
        ${now}, NULL, CURRENT_TIMESTAMP
      )
    `;
    return this.state(tenantId, telegramUserId);
  }
}

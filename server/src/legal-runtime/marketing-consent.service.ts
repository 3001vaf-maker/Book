import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';

function text(value: unknown) { return String(value ?? '').trim(); }
function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

@Injectable()
export class MarketingConsentService {
  constructor(private readonly prisma: PrismaService) {}

  private async currentDocument(tenantId: string) {
    const state = await this.prisma.businessDocumentState.findUnique({
      where: { tenantId },
      select: { data: true, migrationVerifiedAt: true },
    });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Документы пользователя ещё не готовы');
    const data = objectValue(state.data);
    const documents = Array.isArray(data.documents) ? data.documents.map((item) => objectValue(item)) : [];
    const current = documents.find((item) => text(item.id) === 'messages-consent');
    if (!current) throw new ConflictException('Актуальное согласие на рекламные и маркетинговые сообщения не сформировано');
    return { version: Math.max(1, Number(current.version || 1)) };
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
        AND "documentId" = 'messages-consent'
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
        'messages-consent', ${current.version}, ${nextStatus},
        ${accepted ? now : null}, ${accepted ? null : now}, ${text(sourceValue) || 'client-marketing-settings'},
        ${now}, NULL, CURRENT_TIMESTAMP
      )
    `;
    return this.state(tenantId, telegramUserId);
  }
}

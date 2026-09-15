import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { CommunicationService } from './communication.service';

type PreferenceRow = {
  id: string; tenantId: string; cardPhone: string; uei: string; preferredChannels: unknown; createdAt: Date; updatedAt: Date;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly communications: CommunicationService,
  ) {}

  listThread(tenantId: string, input: { profileKey?: unknown; bookingAccountId?: unknown; phone?: unknown; uei?: unknown }, limit = 300) {
    return this.communications.listThread(tenantId, input || {}, limit);
  }

  listThreads(tenantId: string, limit = 200) {
    return this.communications.listThreads(tenantId, limit);
  }

  async getPreferences(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const cardPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    if (!cardPhone && !uei) throw new BadRequestException('Не указан клиент');
    const rows = await this.prisma.$queryRaw<PreferenceRow[]>`
      SELECT "id", "tenantId", "cardPhone", "uei", "preferredChannels", "createdAt", "updatedAt"
      FROM "CommunicationPreference"
      WHERE "tenantId" = ${tenantId}
        AND ((${cardPhone} <> '' AND "cardPhone" = ${cardPhone}) OR (${cardPhone} = '' AND ${uei} <> '' AND "uei" = ${uei}))
      ORDER BY "updatedAt" DESC LIMIT 1
    `;
    const row = rows[0] || null;
    return { cardPhone: row?.cardPhone || cardPhone, uei: row?.uei || uei, preferredChannels: normalizeChannels(row?.preferredChannels), updatedAt: row?.updatedAt || null };
  }

  async savePreferences(tenantId: string, input: { phone?: unknown; uei?: unknown; preferredChannels?: unknown }) {
    const cardPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    if (!cardPhone) throw new BadRequestException('Для настроек каналов нужен телефон клиента');
    const preferredChannels = normalizeChannels(input?.preferredChannels);
    const json = JSON.stringify(preferredChannels);
    await this.prisma.$executeRaw`
      INSERT INTO "CommunicationPreference" ("id", "tenantId", "cardPhone", "uei", "preferredChannels", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${tenantId}, ${cardPhone}, ${uei}, ${json}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("tenantId", "cardPhone") DO UPDATE
      SET "uei" = EXCLUDED."uei", "preferredChannels" = EXCLUDED."preferredChannels", "updatedAt" = CURRENT_TIMESTAMP
    `;
    return this.getPreferences(tenantId, { phone: cardPhone, uei });
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConsentPolicyService } from '../document-state/consent-policy.service';
import { PrismaService } from '../prisma.service';
import { CommunicationService } from './communication.service';
import { TelegramBotService } from './telegram-bot.service';

type TelegramIdentityRow = {
  id: string;
  bookingAccountId: string | null;
  cardPhone: string;
  uei: string;
  externalUserId: string;
  display: string;
};

type InAppAccountRow = {
  id: string;
  phone: string;
  uei: string;
  email: string;
};

function text(value: unknown) { return String(value ?? '').trim(); }
function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

@Injectable()
export class CommunicationChannelResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communications: CommunicationService,
    private readonly consentPolicy: ConsentPolicyService,
    private readonly telegram: TelegramBotService,
  ) {}

  async resolveInAppAccount(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const cardPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    if (!cardPhone && !uei) return null;

    const messageAccounts = await this.prisma.$queryRaw<InAppAccountRow[]>`
      SELECT DISTINCT ba."id", ba."phone", ba."uei", ba."email"
      FROM "CommunicationMessage" m
      INNER JOIN "BookingAccount" ba
        ON ba."tenantId" = m."tenantId" AND ba."id" = m."bookingAccountId"
      WHERE m."tenantId" = ${tenantId}
        AND m."channel" = 'IN_APP'
        AND (
          (${cardPhone} <> '' AND m."cardPhone" = ${cardPhone})
          OR (${uei} <> '' AND m."uei" = ${uei})
        )
      ORDER BY ba."id"
      LIMIT 2
    `;
    if (messageAccounts.length === 1) return messageAccounts[0];

    const accountRows = await this.prisma.$queryRaw<InAppAccountRow[]>`
      SELECT ba."id", ba."phone", ba."uei", ba."email"
      FROM "BookingAccount" ba
      WHERE ba."tenantId" = ${tenantId}
        AND (
          (${cardPhone} <> '' AND (
            CASE
              WHEN length(regexp_replace(ba."phone", '[^0-9]', '', 'g')) = 10
                THEN '7' || regexp_replace(ba."phone", '[^0-9]', '', 'g')
              WHEN length(regexp_replace(ba."phone", '[^0-9]', '', 'g')) = 11
                   AND left(regexp_replace(ba."phone", '[^0-9]', '', 'g'), 1) = '8'
                THEN '7' || substring(regexp_replace(ba."phone", '[^0-9]', '', 'g') from 2)
              ELSE regexp_replace(ba."phone", '[^0-9]', '', 'g')
            END
          ) = ${cardPhone})
          OR (${uei} <> '' AND ba."uei" <> '' AND ba."uei" = ${uei})
        )
      ORDER BY ba."updatedAt" DESC, ba."id" DESC
      LIMIT 2
    `;
    return accountRows.length === 1 ? accountRows[0] : null;
  }

  async resolveTelegramIdentity(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const direct = await this.communications.telegramIdentity(tenantId, input || {});
    if (direct) return direct;

    const cardPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    if (!cardPhone && !uei) return null;

    if (cardPhone) {
      const accountRows = await this.prisma.$queryRaw<TelegramIdentityRow[]>`
        SELECT ci."id", ci."bookingAccountId", ci."cardPhone", ci."uei", ci."externalUserId", ci."display"
        FROM "CommunicationIdentity" ci
        INNER JOIN "BookingAccount" ba
          ON ba."tenantId" = ci."tenantId" AND ba."id" = ci."bookingAccountId"
        WHERE ci."tenantId" = ${tenantId}
          AND ci."channel" = 'TELEGRAM'
          AND (
            CASE
              WHEN length(regexp_replace(ba."phone", '[^0-9]', '', 'g')) = 10
                THEN '7' || regexp_replace(ba."phone", '[^0-9]', '', 'g')
              WHEN length(regexp_replace(ba."phone", '[^0-9]', '', 'g')) = 11
                   AND left(regexp_replace(ba."phone", '[^0-9]', '', 'g'), 1) = '8'
                THEN '7' || substring(regexp_replace(ba."phone", '[^0-9]', '', 'g') from 2)
              ELSE regexp_replace(ba."phone", '[^0-9]', '', 'g')
            END
          ) = ${cardPhone}
        ORDER BY ci."verifiedAt" DESC NULLS LAST, ci."updatedAt" DESC
        LIMIT 2
      `;
      if (accountRows.length === 1) return accountRows[0];
    }

    const threadRows = await this.prisma.$queryRaw<TelegramIdentityRow[]>`
      SELECT ci."id", ci."bookingAccountId", ci."cardPhone", ci."uei", ci."externalUserId", ci."display"
      FROM "CommunicationMessage" m
      INNER JOIN "CommunicationIdentity" ci
        ON ci."tenantId" = m."tenantId"
       AND ci."channel" = 'TELEGRAM'
       AND ci."externalUserId" = m."externalThreadId"
      WHERE m."tenantId" = ${tenantId}
        AND m."channel" = 'TELEGRAM'
        AND m."externalThreadId" <> ''
        AND ((${cardPhone} <> '' AND m."cardPhone" = ${cardPhone}) OR (${uei} <> '' AND m."uei" = ${uei}))
      ORDER BY
        CASE WHEN ${cardPhone} <> '' AND ${uei} <> '' AND m."cardPhone" = ${cardPhone} AND m."uei" = ${uei} THEN 0
             WHEN ${cardPhone} <> '' AND m."cardPhone" = ${cardPhone} THEN 1
             ELSE 2 END,
        m."createdAt" DESC,
        m."id" DESC
      LIMIT 1
    `;
    return threadRows[0] || null;
  }

  async sendTelegram(tenantId: string, input: { phone?: unknown; uei?: unknown; body?: unknown }) {
    const body = text(input?.body);
    if (!body) throw new BadRequestException('Пустое сообщение');
    const identity = await this.resolveTelegramIdentity(tenantId, input || {});
    if (!identity) throw new NotFoundException('Telegram у клиента не подключён');
    if (!(await this.consentPolicy.canSendMessages(tenantId, 'TELEGRAM', identity.externalUserId))) {
      throw new BadRequestException('Нет действующего согласия на этот Telegram Contact Point');
    }
    const threadPhone = canonicalPhone(input?.phone) || canonicalPhone(identity.cardPhone);
    const threadUei = text(input?.uei) || text(identity.uei);
    try {
      const result = await this.telegram.sendMessage(tenantId, identity.externalUserId, body);
      return this.communications.recordMessage(tenantId, {
        bookingAccountId: identity.bookingAccountId,
        phone: threadPhone,
        uei: threadUei,
        direction: 'outbound',
        kind: 'message',
        channel: 'TELEGRAM',
        body,
        externalMessageId: String(result?.message_id || ''),
        externalThreadId: String(result?.chat?.id || identity.externalUserId),
        status: 'sent',
      });
    } catch (error) {
      await this.communications.recordMessage(tenantId, {
        bookingAccountId: identity.bookingAccountId,
        phone: threadPhone,
        uei: threadUei,
        direction: 'outbound',
        kind: 'message',
        channel: 'TELEGRAM',
        body,
        externalThreadId: identity.externalUserId,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

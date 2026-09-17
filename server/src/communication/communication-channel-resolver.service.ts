import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ClientContactRouteService } from './client-contact-route.service';
import { ClientProfileThreadService } from './client-profile-thread.service';
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
    private readonly profiles: ClientProfileThreadService,
    private readonly contactRoutes: ClientContactRouteService,
    private readonly communications: CommunicationService,
    private readonly telegram: TelegramBotService,
  ) {}

  private async sourceProfile(tenantId: string, input: { profileKey?: unknown; phone?: unknown; uei?: unknown }) {
    const profileKey = text(input?.profileKey);
    if (profileKey) return this.profiles.byProfileKey(tenantId, profileKey).catch(() => null);
    return this.profiles.byLegacy(tenantId, input || {}).catch(() => null);
  }

  async resolveInAppProfile(tenantId: string, input: { profileKey?: unknown; phone?: unknown; uei?: unknown }) {
    const source = await this.sourceProfile(tenantId, input || {});
    if (!source) return null;
    const route = await this.contactRoutes.resolve(tenantId, source);
    return route.delivery;
  }

  async resolveTelegramIdentity(tenantId: string, input: { profileKey?: unknown; phone?: unknown; uei?: unknown }) {
    const source = await this.sourceProfile(tenantId, input || {});
    const route = source ? await this.contactRoutes.resolve(tenantId, source) : null;
    const routeUei = text(route?.delivery?.profileUei);
    const requestedPhone = canonicalPhone(input?.phone);
    const requestedUei = routeUei || text(input?.uei);

    if (requestedPhone || requestedUei) {
      const direct = await this.communications.telegramIdentity(tenantId, { phone: route?.via ? '' : requestedPhone, uei: requestedUei }).catch(() => null);
      if (direct) return direct;
    }

    const cardPhone = route?.via ? '' : requestedPhone;
    const uei = requestedUei;
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

  async sendTelegram(tenantId: string, input: { profileKey?: unknown; phone?: unknown; uei?: unknown; body?: unknown }) {
    const body = text(input?.body);
    if (!body) throw new BadRequestException('Пустое сообщение');
    const subject = await this.sourceProfile(tenantId, input || {});
    const identity = await this.resolveTelegramIdentity(tenantId, input || {});
    if (!identity) throw new NotFoundException('Telegram у клиента не подключён');
    const threadPhone = canonicalPhone(input?.phone);
    const threadUei = text(subject?.profileUei) || text(input?.uei);
    const threadProfileKey = text(subject?.profileKey) || text(input?.profileKey);
    try {
      const result = await this.telegram.sendMessage(tenantId, identity.externalUserId, body);
      return this.communications.recordMessage(tenantId, {
        profileKey: threadProfileKey,
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
        profileKey: threadProfileKey,
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

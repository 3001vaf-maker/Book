import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BusinessStateService } from '../business-state/business-state.service';
import { ConsentPolicyService } from '../document-state/consent-policy.service';
import { PrismaService } from '../prisma.service';
import { WebPushService } from './web-push.service';

type NotificationInput = {
  type?: string;
  title?: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  uei?: string;
};

type NotificationRow = {
  id: string;
  tenantId: string;
  cardPhone: string;
  uei: string;
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
  deliveryStatus: string;
  deliveryCreatedAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  error: string;
};

type ExternalDeliveryRow = {
  deliveryId: string;
  notificationId: string;
  tenantId: string;
  recipientKey: string;
  status: string;
  title: string;
  body: string;
  type: string;
  entityType: string;
  entityId: string;
  cardPhone: string;
  uei: string;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  error: string;
};

type RoutingPolicyRow = {
  id: string;
  tenantId: string;
  eventType: string;
  mode: string;
  channels: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const ROUTING_MODES = new Set(['always', 'fallback']);
const ROUTING_CHANNELS = new Set(['PUSH', 'TELEGRAM', 'EMAIL']);
const ACTIVE_EXTERNAL_CHANNELS = new Set(['TELEGRAM', 'EMAIL']);

function text(value: unknown) {
  return String(value ?? '').trim();
}

function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

function canonicalEmail(value: unknown) {
  const email = text(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizeMode(value: unknown) {
  const mode = text(value).toLowerCase();
  return ROUTING_MODES.has(mode) ? mode : 'always';
}

function normalizeChannels(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map((item) => text(item).toUpperCase()).filter((item) => ROUTING_CHANNELS.has(item)))];
}

function channelsWithPush(value: unknown) {
  return ['PUSH', ...normalizeChannels(value).filter((channel) => channel !== 'PUSH')];
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessState: BusinessStateService,
    private readonly documents: ConsentPolicyService,
    private readonly webPush: WebPushService,
  ) {}

  private async accountIdentity(tenantId: string, accountId: string) {
    const [account, identity] = await Promise.all([
      this.prisma.bookingAccount.findFirst({
        where: { id: accountId, tenantId },
        select: { phone: true, uei: true, email: true },
      }),
      this.businessState.bookingIdentityForAccount(tenantId, accountId),
    ]);
    if (!account) throw new NotFoundException('Клиентский аккаунт не найден');
    const cardPhone = canonicalPhone(account.phone);
    if (!cardPhone) throw new NotFoundException('У клиентской карты не определён номер телефона');
    const personKey = text(identity?.person?.key || identity?.matchedPerson?.key);
    const uei = text(identity?.uei || account.uei);
    const telegramRows = await this.prisma.$queryRaw<Array<{ externalUserId: string }>>`
      SELECT "externalUserId"
      FROM "CommunicationIdentity"
      WHERE "tenantId" = ${tenantId}
        AND "channel" = 'TELEGRAM'
        AND ("cardPhone" = ${cardPhone} OR (${uei} <> '' AND "uei" = ${uei}))
      ORDER BY "verifiedAt" DESC NULLS LAST, "updatedAt" DESC
      LIMIT 1
    `;
    return {
      accountId,
      cardPhone,
      personKey,
      uei,
      email: canonicalEmail(account.email),
      telegramId: text(telegramRows[0]?.externalUserId),
    };
  }

  private async accountIdentityByPhone(tenantId: string, cardPhone: string) {
    const accounts = await this.prisma.bookingAccount.findMany({
      where: { tenantId },
      select: { id: true, phone: true },
    });
    const match = accounts.find((account) => canonicalPhone(account.phone) === canonicalPhone(cardPhone));
    return match ? this.accountIdentity(tenantId, match.id) : null;
  }

  private project(row: NotificationRow) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      entityType: row.entityType,
      entityId: row.entityId,
      uei: row.uei,
      createdAt: row.createdAt,
      status: row.deliveryStatus,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
      readAt: row.readAt,
      failedAt: row.failedAt,
      error: row.error,
      read: Boolean(row.readAt) || row.deliveryStatus === 'read',
    };
  }

  private projectPolicy(row: RoutingPolicyRow | null, eventType: string) {
    return {
      eventType,
      mode: normalizeMode(row?.mode),
      channels: channelsWithPush(row?.channels),
    };
  }

  async listRoutingPolicies(tenantId: string) {
    const rows = await this.prisma.$queryRaw<RoutingPolicyRow[]>`
      SELECT "id", "tenantId", "eventType", "mode", "channels", "createdAt", "updatedAt"
      FROM "NotificationRoutingPolicy"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "eventType" ASC
    `;
    return rows.map((row) => this.projectPolicy(row, row.eventType));
  }

  async getRoutingPolicy(tenantId: string, eventType: string) {
    const type = text(eventType) || 'message';
    const rows = await this.prisma.$queryRaw<RoutingPolicyRow[]>`
      SELECT "id", "tenantId", "eventType", "mode", "channels", "createdAt", "updatedAt"
      FROM "NotificationRoutingPolicy"
      WHERE "tenantId" = ${tenantId}
        AND "eventType" = ${type}
      LIMIT 1
    `;
    return this.projectPolicy(rows[0] || null, type);
  }

  async saveRoutingPolicy(tenantId: string, eventType: string, input: { mode?: unknown; channels?: unknown }) {
    const type = text(eventType);
    if (!type) throw new BadRequestException('Не указан тип уведомления');
    const mode = normalizeMode(input?.mode);
    const channels = channelsWithPush(input?.channels);
    const id = randomUUID();
    const channelsJson = JSON.stringify(channels);
    await this.prisma.$executeRaw`
      INSERT INTO "NotificationRoutingPolicy" (
        "id", "tenantId", "eventType", "mode", "channels", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${tenantId}, ${type}, ${mode}, ${channelsJson}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("tenantId", "eventType") DO UPDATE
      SET "mode" = EXCLUDED."mode",
          "channels" = EXCLUDED."channels",
          "updatedAt" = CURRENT_TIMESTAMP
    `;
    return this.getRoutingPolicy(tenantId, type);
  }

  private recipientForChannel(identity: Awaited<ReturnType<NotificationService['accountIdentity']>>, channel: string) {
    if (channel === 'EMAIL') return identity.email;
    if (channel === 'TELEGRAM') return identity.telegramId;
    return '';
  }

  private async queueDelivery(tenantId: string, notificationId: string, channel: string, recipientKey: string) {
    const recipient = text(recipientKey);
    if (!recipient) return false;
    await this.prisma.$executeRaw`
      INSERT INTO "NotificationDelivery" (
        "id", "tenantId", "notificationId", "channel", "recipientKey", "status", "createdAt", "error"
      ) VALUES (
        ${randomUUID()}, ${tenantId}, ${notificationId}, ${channel}, ${recipient}, 'created', CURRENT_TIMESTAMP, ''
      )
      ON CONFLICT ("notificationId", "channel", "recipientKey") DO NOTHING
    `;
    return true;
  }

  private async externalAllowed(tenantId: string, identity: Awaited<ReturnType<NotificationService['accountIdentity']>>, channel: string) {
    if (channel === 'PUSH') return true;
    const recipient = this.recipientForChannel(identity, channel);
    if (!recipient) return false;
    return this.documents.canSendMessages(tenantId, channel, recipient);
  }

  private async queueExternalByPolicy(
    tenantId: string,
    notificationId: string,
    eventType: string,
    identity: Awaited<ReturnType<NotificationService['accountIdentity']>>,
  ) {
    const policy = await this.getRoutingPolicy(tenantId, eventType);
    const routed: Array<{ channel: string; recipient: string }> = [];

    if (policy.channels.includes('PUSH')) {
      const endpoints = await this.webPush.listAccountEndpoints(tenantId, identity.accountId);
      for (const endpoint of endpoints) {
        await this.queueDelivery(tenantId, notificationId, 'PUSH', endpoint);
        routed.push({ channel: 'PUSH', recipient: endpoint });
      }
    }

    const configured = policy.channels.filter((channel) => ACTIVE_EXTERNAL_CHANNELS.has(channel));
    const available: Array<{ channel: string; recipient: string }> = [];
    for (const channel of configured) {
      const recipient = this.recipientForChannel(identity, channel);
      if (!recipient || !(await this.externalAllowed(tenantId, identity, channel))) continue;
      available.push({ channel, recipient });
    }
    const selected = policy.mode === 'fallback' ? available.slice(0, 1) : available;
    for (const item of selected) await this.queueDelivery(tenantId, notificationId, item.channel, item.recipient);
    return [...routed, ...selected];
  }

  private async createForAccountInternal(
    tenantId: string,
    accountId: string,
    input: NotificationInput,
    routeExternal: boolean,
  ) {
    const identity = await this.accountIdentity(tenantId, accountId);
    const notificationId = randomUUID();
    const inAppDeliveryId = randomUUID();
    const now = new Date();
    const type = text(input.type) || 'message';
    const title = text(input.title) || 'Уведомление';
    const body = text(input.body);
    const entityType = text(input.entityType);
    const entityId = text(input.entityId);
    const uei = text(input.uei) || identity.uei;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "Notification" (
          "id", "tenantId", "cardPhone", "uei", "type", "title", "body", "entityType", "entityId", "createdAt"
        ) VALUES (
          ${notificationId}, ${tenantId}, ${identity.cardPhone}, ${uei}, ${type}, ${title}, ${body}, ${entityType}, ${entityId}, ${now}
        )
      `;
      await tx.$executeRaw`
        INSERT INTO "NotificationDelivery" (
          "id", "tenantId", "notificationId", "channel", "recipientKey", "status", "createdAt", "deliveredAt", "error"
        ) VALUES (
          ${inAppDeliveryId}, ${tenantId}, ${notificationId}, 'IN_APP', ${identity.cardPhone}, 'delivered', ${now}, ${now}, ''
        )
      `;
    });

    const routed = routeExternal ? await this.queueExternalByPolicy(tenantId, notificationId, type, identity) : [];
    if (routeExternal && routed.some((item) => item.channel === 'PUSH')) {
      await this.webPush.dispatchNotification(tenantId, notificationId);
    }
    return { notification: await this.getForAccount(tenantId, accountId, notificationId), routed };
  }

  async createInAppForAccount(tenantId: string, accountId: string, input: NotificationInput) {
    const created = await this.createForAccountInternal(tenantId, accountId, input, false);
    return created.notification;
  }

  async createForAccount(tenantId: string, accountId: string, input: NotificationInput) {
    return this.createForAccountInternal(tenantId, accountId, input, true);
  }

  async listForAccount(tenantId: string, accountId: string) {
    const { cardPhone } = await this.accountIdentity(tenantId, accountId);
    const rows = await this.prisma.$queryRaw<NotificationRow[]>`
      SELECT
        n."id", n."tenantId", n."cardPhone", n."uei", n."type", n."title", n."body",
        n."entityType", n."entityId", n."createdAt",
        d."status" AS "deliveryStatus", d."createdAt" AS "deliveryCreatedAt",
        d."sentAt", d."deliveredAt", d."readAt", d."failedAt", d."error"
      FROM "Notification" n
      INNER JOIN "NotificationDelivery" d
        ON d."notificationId" = n."id"
       AND d."tenantId" = n."tenantId"
       AND d."channel" = 'IN_APP'
       AND d."recipientKey" = ${cardPhone}
      WHERE n."tenantId" = ${tenantId}
        AND n."cardPhone" = ${cardPhone}
      ORDER BY n."createdAt" DESC, n."id" DESC
      LIMIT 200
    `;
    const items = rows.map((row) => this.project(row));
    return { unreadCount: items.filter((item) => !item.read).length, items };
  }

  async getForAccount(tenantId: string, accountId: string, notificationId: string) {
    const { cardPhone } = await this.accountIdentity(tenantId, accountId);
    const rows = await this.prisma.$queryRaw<NotificationRow[]>`
      SELECT
        n."id", n."tenantId", n."cardPhone", n."uei", n."type", n."title", n."body",
        n."entityType", n."entityId", n."createdAt",
        d."status" AS "deliveryStatus", d."createdAt" AS "deliveryCreatedAt",
        d."sentAt", d."deliveredAt", d."readAt", d."failedAt", d."error"
      FROM "Notification" n
      INNER JOIN "NotificationDelivery" d
        ON d."notificationId" = n."id"
       AND d."tenantId" = n."tenantId"
       AND d."channel" = 'IN_APP'
       AND d."recipientKey" = ${cardPhone}
      WHERE n."tenantId" = ${tenantId}
        AND n."cardPhone" = ${cardPhone}
        AND n."id" = ${notificationId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('Уведомление не найдено');
    return this.project(row);
  }

  async markReadForAccount(tenantId: string, accountId: string, notificationId: string) {
    const { cardPhone } = await this.accountIdentity(tenantId, accountId);
    const current = await this.getForAccount(tenantId, accountId, notificationId);
    if (!current.read) {
      const now = new Date();
      await this.prisma.$executeRaw`
        UPDATE "NotificationDelivery"
        SET "status" = 'read', "readAt" = ${now}
        WHERE "tenantId" = ${tenantId}
          AND "notificationId" = ${notificationId}
          AND "channel" = 'IN_APP'
          AND "recipientKey" = ${cardPhone}
      `;
    }
    return this.getForAccount(tenantId, accountId, notificationId);
  }

  private async pendingDeliveries(tenantId: string, channel: 'EMAIL' | 'TELEGRAM', limit = 100) {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 100)));
    return this.prisma.$queryRaw<ExternalDeliveryRow[]>`
      SELECT
        d."id" AS "deliveryId", d."notificationId", d."tenantId", d."recipientKey", d."status",
        d."createdAt", d."sentAt", d."deliveredAt", d."failedAt", d."error",
        n."title", n."body", n."type", n."entityType", n."entityId", n."cardPhone", n."uei"
      FROM "NotificationDelivery" d
      INNER JOIN "Notification" n
        ON n."id" = d."notificationId"
       AND n."tenantId" = d."tenantId"
      WHERE d."tenantId" = ${tenantId}
        AND d."channel" = ${channel}
        AND d."status" = 'created'
      ORDER BY d."createdAt" ASC, d."id" ASC
      LIMIT ${safeLimit}
    `;
  }

  async pendingEmailDeliveries(tenantId: string, limit = 100) {
    return this.pendingDeliveries(tenantId, 'EMAIL', limit);
  }

  async pendingTelegramDeliveries(tenantId: string, limit = 100) {
    return this.pendingDeliveries(tenantId, 'TELEGRAM', limit);
  }

  private async canSendDelivery(tenantId: string, notificationId: string, channel: 'EMAIL' | 'TELEGRAM') {
    const rows = await this.prisma.$queryRaw<Array<{ cardPhone: string }>>`
      SELECT n."cardPhone"
      FROM "Notification" n
      INNER JOIN "NotificationDelivery" d
        ON d."notificationId" = n."id"
       AND d."tenantId" = n."tenantId"
       AND d."channel" = ${channel}
      WHERE n."tenantId" = ${tenantId}
        AND n."id" = ${notificationId}
      LIMIT 1
    `;
    const identity = rows[0]?.cardPhone ? await this.accountIdentityByPhone(tenantId, rows[0].cardPhone) : null;
    return Boolean(identity && await this.externalAllowed(tenantId, identity, channel));
  }

  async canSendEmailDelivery(tenantId: string, notificationId: string) {
    return this.canSendDelivery(tenantId, notificationId, 'EMAIL');
  }

  async canSendTelegramDelivery(tenantId: string, notificationId: string) {
    return this.canSendDelivery(tenantId, notificationId, 'TELEGRAM');
  }

  private async markDeliverySent(tenantId: string, deliveryId: string, channel: 'EMAIL' | 'TELEGRAM') {
    const now = new Date();
    await this.prisma.$executeRaw`
      UPDATE "NotificationDelivery"
      SET "status" = 'sent', "sentAt" = ${now}, "failedAt" = NULL, "error" = ''
      WHERE "tenantId" = ${tenantId} AND "id" = ${deliveryId} AND "channel" = ${channel}
    `;
    return { deliveryId, status: 'sent', sentAt: now };
  }

  private async markDeliveryDelivered(tenantId: string, deliveryId: string, channel: 'EMAIL' | 'TELEGRAM') {
    const now = new Date();
    await this.prisma.$executeRaw`
      UPDATE "NotificationDelivery"
      SET "status" = 'delivered', "deliveredAt" = ${now}, "failedAt" = NULL, "error" = ''
      WHERE "tenantId" = ${tenantId} AND "id" = ${deliveryId} AND "channel" = ${channel}
    `;
    return { deliveryId, status: 'delivered', deliveredAt: now };
  }

  private async markDeliveryFailed(tenantId: string, deliveryId: string, channel: 'EMAIL' | 'TELEGRAM', error: unknown) {
    const rows = await this.prisma.$queryRaw<Array<{ notificationId: string; channel: string; cardPhone: string; type: string }>>`
      SELECT d."notificationId", d."channel", n."cardPhone", n."type"
      FROM "NotificationDelivery" d
      INNER JOIN "Notification" n ON n."id" = d."notificationId" AND n."tenantId" = d."tenantId"
      WHERE d."tenantId" = ${tenantId} AND d."id" = ${deliveryId} AND d."channel" = ${channel}
      LIMIT 1
    `;
    const current = rows[0];
    const now = new Date();
    const message = text(error).slice(0, 2000);
    await this.prisma.$executeRaw`
      UPDATE "NotificationDelivery"
      SET "status" = 'failed', "failedAt" = ${now}, "error" = ${message}
      WHERE "tenantId" = ${tenantId} AND "id" = ${deliveryId} AND "channel" = ${channel}
    `;

    if (current) {
      const policy = await this.getRoutingPolicy(tenantId, current.type);
      if (policy.mode === 'fallback') {
        const failedIndex = policy.channels.indexOf(current.channel);
        const nextChannels = failedIndex >= 0 ? policy.channels.slice(failedIndex + 1) : [];
        const identity = await this.accountIdentityByPhone(tenantId, current.cardPhone);
        if (identity) {
          for (const nextChannel of nextChannels) {
            if (!ACTIVE_EXTERNAL_CHANNELS.has(nextChannel)) continue;
            const recipient = this.recipientForChannel(identity, nextChannel);
            if (!recipient || !(await this.externalAllowed(tenantId, identity, nextChannel))) continue;
            await this.queueDelivery(tenantId, current.notificationId, nextChannel, recipient);
            break;
          }
        }
      }
    }
    return { deliveryId, status: 'failed', failedAt: now, error: message };
  }

  async markEmailSent(tenantId: string, deliveryId: string) {
    return this.markDeliverySent(tenantId, deliveryId, 'EMAIL');
  }

  async markEmailDelivered(tenantId: string, deliveryId: string) {
    return this.markDeliveryDelivered(tenantId, deliveryId, 'EMAIL');
  }

  async markEmailFailed(tenantId: string, deliveryId: string, error: unknown) {
    return this.markDeliveryFailed(tenantId, deliveryId, 'EMAIL', error);
  }

  async markTelegramSent(tenantId: string, deliveryId: string) {
    return this.markDeliverySent(tenantId, deliveryId, 'TELEGRAM');
  }

  async markTelegramFailed(tenantId: string, deliveryId: string, error: unknown) {
    return this.markDeliveryFailed(tenantId, deliveryId, 'TELEGRAM', error);
  }

  async canSendMessagesForAccount(tenantId: string, accountId: string) {
    const identity = await this.accountIdentity(tenantId, accountId);
    return this.externalAllowed(tenantId, identity);
  }
}

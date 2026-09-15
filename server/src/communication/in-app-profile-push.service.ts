import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { WebPushService } from '../notification/web-push.service';
import { ClientContactRouteService } from './client-contact-route.service';
import { ClientProfileThreadService } from './client-profile-thread.service';

function text(value: unknown) { return String(value ?? '').trim(); }
function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

@Injectable()
export class InAppProfilePushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ClientProfileThreadService,
    private readonly contactRoutes: ClientContactRouteService,
    private readonly webPush: WebPushService,
  ) {}

  async notify(tenantId: string, profileKeyValue: unknown, input: {
    type?: unknown;
    title?: unknown;
    body?: unknown;
    entityType?: unknown;
    entityId?: unknown;
  }) {
    const profile = await this.profiles.byProfileKey(tenantId, profileKeyValue);
    const route = await this.contactRoutes.resolve(tenantId, profile);
    const accounts = await this.profiles.accountsForProfile(tenantId, route.delivery.profileKey);
    const notificationId = randomUUID();
    const now = new Date();
    const firstAccount = accounts[0] || null;
    const type = text(input?.type) || 'chat.message';
    const title = text(input?.title) || 'Новое сообщение';
    const body = text(input?.body);
    const entityType = text(input?.entityType) || 'chat-message';
    const entityId = text(input?.entityId);
    const cardPhone = canonicalPhone(firstAccount?.phone);

    await this.prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id", "tenantId", "cardPhone", "uei", "type", "title", "body", "entityType", "entityId", "createdAt"
      ) VALUES (
        ${notificationId}, ${tenantId}, ${cardPhone}, ${profile.profileUei}, ${type}, ${title}, ${body}, ${entityType}, ${entityId}, ${now}
      )
    `;

    const endpointSet = new Set<string>();
    for (const account of accounts) {
      const endpoints = await this.webPush.listAccountEndpoints(tenantId, account.id);
      for (const endpoint of endpoints) endpointSet.add(endpoint);
    }
    for (const endpoint of endpointSet) {
      await this.prisma.$executeRaw`
        INSERT INTO "NotificationDelivery" (
          "id", "tenantId", "notificationId", "channel", "recipientKey", "status", "createdAt", "error"
        ) VALUES (
          ${randomUUID()}, ${tenantId}, ${notificationId}, 'PUSH', ${endpoint}, 'created', CURRENT_TIMESTAMP, ''
        )
        ON CONFLICT ("notificationId", "channel", "recipientKey") DO NOTHING
      `;
    }
    const result = endpointSet.size ? await this.webPush.dispatchNotification(tenantId, notificationId) : { sent: 0, failed: 0 };
    return { notificationId, profileKey: profile.profileKey, deliveryProfileKey: route.delivery.profileKey, accountIds: accounts.map((account) => account.id), endpoints: endpointSet.size, ...result };
  }
}

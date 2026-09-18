import { Injectable } from '@nestjs/common';
import { BusinessStateService } from '../business-state/business-state.service';
import { LegalRuntimeService } from '../legal-runtime/legal-runtime.service';
import { PrismaService } from '../prisma.service';
import { SaasAccessService } from '../saas-access/saas-access.service';
import { NotificationService } from './notification.service';
import { WebPushService } from './web-push.service';

const APPROVED_SERVICE_EVENTS = new Set([
  'booking.created',
  'booking.cancelled',
  'booking.rescheduled',
  'booking.completed',
  'booking.reminder',
]);

function text(value: unknown) {
  return String(value ?? '').trim();
}

@Injectable()
export class LegalNotificationService extends NotificationService {
  constructor(
    prisma: PrismaService,
    businessState: BusinessStateService,
    webPush: WebPushService,
    private readonly legal: LegalRuntimeService,
    private readonly access: SaasAccessService,
  ) {
    super(prisma, businessState, webPush);
    this.prismaRef = prisma;
  }

  private readonly prismaRef: PrismaService;

  private async externalServiceEnabled(tenantId: string) {
    const capability = await this.access.resolveCapability(tenantId, 'notifications.access');
    return capability.enabled === true;
  }

  override async createForAccount(tenantId: string, accountId: string, input: any) {
    const type = text(input?.type);
    if (!APPROVED_SERVICE_EVENTS.has(type) || !(await this.externalServiceEnabled(tenantId))) {
      const notification = await super.createInAppForAccount(tenantId, accountId, input);
      return { notification, routed: [] };
    }

    await this.legal.assertTenantLive(tenantId, '', 'NOTIFICATION_SERVICE_QUEUE');
    return super.createForAccount(tenantId, accountId, input);
  }

  private async assertExternalDelivery(
    tenantId: string,
    notificationId: string,
    channel: 'EMAIL' | 'TELEGRAM',
  ) {
    if (!(await this.externalServiceEnabled(tenantId))) return false;
    const rows = await this.prismaRef.$queryRaw<Array<{ recipientKey: string; type: string }>>`
      SELECT d."recipientKey", n."type"
      FROM "NotificationDelivery" d
      INNER JOIN "Notification" n
        ON n."id" = d."notificationId"
       AND n."tenantId" = d."tenantId"
      WHERE d."tenantId" = ${tenantId}
        AND d."notificationId" = ${notificationId}
        AND d."channel" = ${channel}
      ORDER BY d."createdAt" ASC
      LIMIT 1
    `;
    const delivery = rows[0];
    if (!delivery || !APPROVED_SERVICE_EVENTS.has(text(delivery.type)) || !text(delivery.recipientKey)) return false;

    try {
      await this.legal.assertExternalCommunication(tenantId, {
        purpose: 'SERVICE',
        channel,
        destination: delivery.recipientKey,
        legalBasis: `approved-notification-template:${delivery.type}`,
      });
      return true;
    } catch {
      return false;
    }
  }

  override async canSendEmailDelivery(tenantId: string, notificationId: string) {
    return this.assertExternalDelivery(tenantId, notificationId, 'EMAIL');
  }

  override async canSendTelegramDelivery(tenantId: string, notificationId: string) {
    return this.assertExternalDelivery(tenantId, notificationId, 'TELEGRAM');
  }
}

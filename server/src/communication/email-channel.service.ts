import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConsentPolicyService } from '../tenant-document-archive/consent-policy.service';
import { NotificationService } from '../notification/notification.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';
import { CommunicationService } from './communication.service';
import { normalizeMessagePurpose } from './message-purpose';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char] || char);
}

@Injectable()
export class EmailChannelService implements OnModuleInit, OnModuleDestroy {
  private pollTimer: NodeJS.Timeout | null = null;
  private dispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly communications: CommunicationService,
    private readonly consentPolicy: ConsentPolicyService,
    private readonly notifications: NotificationService,
    private readonly email: TransactionalEmailService,
  ) {}

  onModuleInit() {
    const interval = Math.max(1000, Number(process.env.EMAIL_DELIVERY_POLL_MS || 3000));
    this.pollTimer = setInterval(() => void this.dispatchPendingNotifications(), interval);
    this.pollTimer.unref?.();
    void this.dispatchPendingNotifications();
  }

  onModuleDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  async sendMessage(
    tenantId: string,
    input: { phone?: unknown; uei?: unknown; subject?: unknown; body?: unknown; purpose?: unknown },
  ) {
    const body = text(input?.body);
    if (!body) throw new BadRequestException('Пустое сообщение');
    const purpose = normalizeMessagePurpose(input?.purpose);
    if (!purpose) throw new BadRequestException('Не указан purpose сообщения');

    const identity = await this.communications.emailIdentity(tenantId, input || {});
    if (!identity) throw new BadRequestException('Email у человека не указан');

    if (!(await this.consentPolicy.hasActivePdnConsentForContact(tenantId, 'EMAIL', identity.externalUserId))) {
      throw new BadRequestException('Нет действующего согласия на обработку ПДН');
    }
    if (
      purpose === 'MARKETING'
      && !(await this.consentPolicy.canSendMarketing(tenantId, 'EMAIL', identity.externalUserId))
    ) {
      throw new BadRequestException('Нет действующего рекламного согласия для Email');
    }

    const subject = text(input?.subject) || (purpose === 'MARKETING' ? 'Сообщение' : 'Уведомление Book');

    try {
      const sent = await this.email.send({
        to: identity.externalUserId,
        subject,
        text: body,
        html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(body)}</div>`,
        tag: `communication-${purpose.toLowerCase()}`,
      });
      return this.communications.recordMessage(tenantId, {
        phone: identity.personPhone,
        uei: identity.uei,
        direction: 'outbound',
        kind: 'message',
        purpose,
        channel: 'EMAIL',
        body,
        externalMessageId: sent.messageId,
        externalThreadId: identity.externalUserId,
        status: 'sent',
      });
    } catch (error) {
      await this.communications.recordMessage(tenantId, {
        phone: identity.personPhone,
        uei: identity.uei,
        direction: 'outbound',
        kind: 'message',
        purpose,
        channel: 'EMAIL',
        body,
        externalThreadId: identity.externalUserId,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async pendingTenantIds() {
    const rows = await this.prisma.$queryRaw<Array<{ tenantId: string }>>`
      SELECT DISTINCT "tenantId"
      FROM "NotificationDelivery"
      WHERE "channel" = 'EMAIL' AND "status" = 'created'
    `;
    return rows.map((row) => row.tenantId);
  }

  async dispatchPendingNotifications(limit = 100) {
    if (this.dispatching) return { busy: true, sent: 0, failed: 0 };
    this.dispatching = true;
    let sent = 0;
    let failed = 0;

    try {
      for (const tenantId of await this.pendingTenantIds()) {
        const deliveries = await this.notifications.pendingEmailDeliveries(tenantId, limit);
        for (const delivery of deliveries) {
          try {
            const allowed = await this.notifications.canSendEmailDelivery(tenantId, delivery.notificationId);
            if (!allowed) {
              await this.notifications.markEmailFailed(
                tenantId,
                delivery.deliveryId,
                'Отправка запрещена для purpose/канала',
              );
              failed += 1;
              continue;
            }

            await this.email.send({
              to: delivery.recipientKey,
              subject: delivery.title || 'Уведомление Book',
              text: delivery.body || delivery.title,
              html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(delivery.body || delivery.title)}</div>`,
              tag: `notification-${text(delivery.purpose).toLowerCase() || 'message'}`,
            });
            await this.notifications.markEmailSent(tenantId, delivery.deliveryId);
            sent += 1;
          } catch (error) {
            await this.notifications.markEmailFailed(
              tenantId,
              delivery.deliveryId,
              error instanceof Error ? error.message : String(error),
            );
            failed += 1;
          }
        }
      }
      return { busy: false, sent, failed };
    } finally {
      this.dispatching = false;
    }
  }
}

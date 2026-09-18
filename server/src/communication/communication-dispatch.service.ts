import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientProfileThreadService } from './client-profile-thread.service';
import { CommunicationChannelResolverService } from './communication-channel-resolver.service';
import { CommunicationService } from './communication.service';
import { CommunicationHistoryService } from './communication-history.service';
import { InAppProfilePushService } from './in-app-profile-push.service';

function text(value: unknown) { return String(value ?? '').trim(); }

@Injectable()
export class CommunicationDispatchService {
  constructor(
    private readonly communications: CommunicationService,
    private readonly history: CommunicationHistoryService,
    private readonly channels: CommunicationChannelResolverService,
    private readonly profiles: ClientProfileThreadService,
    private readonly profilePush: InAppProfilePushService,
  ) {}

  private async resolveProfile(tenantId: string, input: { profileKey?: unknown; phone?: unknown; uei?: unknown }) {
    const profileKey = text(input?.profileKey);
    if (profileKey) return this.profiles.byProfileKey(tenantId, profileKey).catch(() => null);
    return this.profiles.byLegacy(tenantId, input || {}).catch(() => null);
  }

  private async inAppDeliveryProfile(tenantId: string, input: { profileKey?: unknown; phone?: unknown; uei?: unknown }) {
    const delivery = await this.channels.resolveInAppProfile(tenantId, input || {});
    return delivery?.profileKey && Array.isArray(delivery.accountIds) && delivery.accountIds.length > 0 ? delivery : null;
  }

  async resolveChannel(tenantId: string, input: { profileKey?: unknown; phone?: unknown; uei?: unknown; channel?: unknown }) {
    const requested = text(input?.channel).toUpperCase();
    if (requested === 'IN_APP') {
      if (!(await this.inAppDeliveryProfile(tenantId, input || {}))) throw new NotFoundException('Внутренний чат клиента недоступен');
      return 'IN_APP';
    }
    if (requested === 'TELEGRAM') {
      if (!(await this.channels.resolveTelegramIdentity(tenantId, input || {}))) throw new NotFoundException('Канал TELEGRAM у клиента недоступен');
      return 'TELEGRAM';
    }
    if (requested) throw new NotFoundException(`Канал ${requested} у клиента недоступен`);

    if (await this.inAppDeliveryProfile(tenantId, input || {})) return 'IN_APP';

    const available: string[] = [];
    if (await this.channels.resolveTelegramIdentity(tenantId, input || {})) available.push('TELEGRAM');
    const preferences = await this.history.getPreferences(tenantId, input || {});
    const preferred = preferences.preferredChannels.find((channel) => available.includes(channel));
    const selected = preferred || available[0] || '';
    if (!selected) throw new NotFoundException('У клиента нет доступного двустороннего канала');
    return selected;
  }

  async send(tenantId: string, input: {
    profileKey?: unknown;
    phone?: unknown;
    uei?: unknown;
    channel?: unknown;
    body?: unknown;
    content?: unknown;
    attachments?: unknown;
    purpose?: unknown;
    legalBasis?: unknown;
    actorUserId?: unknown;
  }) {
    const body = text(input?.body);
    const attachments = Array.isArray(input?.attachments) ? input.attachments : [];
    const hasRichContent = Boolean(input?.content && typeof input.content === 'object');
    if (!body && !attachments.length && !hasRichContent) throw new BadRequestException('Пустое сообщение');

    const channel = await this.resolveChannel(tenantId, input || {});
    if (channel === 'IN_APP') {
      const profile = await this.resolveProfile(tenantId, input || {});
      const delivery = await this.inAppDeliveryProfile(tenantId, input || {});
      if (!profile || !delivery) throw new NotFoundException('Внутренний чат клиента недоступен');
      const message = await this.communications.recordMessage(tenantId, {
        profileKey: profile.profileKey,
        phone: input?.phone,
        uei: profile.profileUei || input?.uei,
        direction: 'outbound',
        kind: attachments.length ? 'media' : 'message',
        channel: 'IN_APP',
        body,
        content: input?.content,
        attachments,
        status: 'delivered',
      });
      await this.profilePush.notify(tenantId, profile.profileKey, {
        type: 'chat.message',
        title: 'Новое сообщение',
        body: message.body || (attachments.length ? 'Новое сообщение с вложением' : 'Новое сообщение'),
        entityType: 'chat-message',
        entityId: message.id,
      }).catch(() => null);
      return message;
    }

    if (channel === 'TELEGRAM') {
      const identity = await this.channels.resolveTelegramIdentity(tenantId, input || {});
      const destination = text(identity?.externalUserId);
      if (!destination) throw new NotFoundException('Канал TELEGRAM у клиента недоступен');
      const message = await this.channels.sendTelegram(tenantId, {
        profileKey: input?.profileKey,
        phone: input?.phone,
        uei: input?.uei,
        body,
      });
      return message;
    }

    throw new BadRequestException('Канал пока не подключён к двустороннему Chat');
  }
}

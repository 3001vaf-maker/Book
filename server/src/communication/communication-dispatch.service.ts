import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { CommunicationChannelResolverService } from './communication-channel-resolver.service';
import { CommunicationService } from './communication.service';
import { CommunicationHistoryService } from './communication-history.service';

function text(value: unknown) { return String(value ?? '').trim(); }

@Injectable()
export class CommunicationDispatchService {
  constructor(
    private readonly communications: CommunicationService,
    private readonly history: CommunicationHistoryService,
    private readonly channels: CommunicationChannelResolverService,
    private readonly notifications: NotificationService,
  ) {}

  private async availableChannels(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const channels: string[] = [];
    if (await this.channels.resolveInAppAccount(tenantId, input || {})) channels.push('IN_APP');
    if (await this.channels.resolveTelegramIdentity(tenantId, input || {})) channels.push('TELEGRAM');
    return channels;
  }

  async resolveChannel(tenantId: string, input: { phone?: unknown; uei?: unknown; channel?: unknown }) {
    const requested = text(input?.channel).toUpperCase();
    const available = await this.availableChannels(tenantId, input || {});
    if (requested) {
      if (!available.includes(requested)) throw new NotFoundException(`Канал ${requested} у клиента недоступен`);
      return requested;
    }
    if (available.includes('IN_APP')) return 'IN_APP';
    const preferences = await this.history.getPreferences(tenantId, input || {});
    const preferred = preferences.preferredChannels.find((channel) => available.includes(channel));
    const selected = preferred || available[0] || '';
    if (!selected) throw new NotFoundException('У клиента нет доступного двустороннего канала');
    return selected;
  }

  async send(tenantId: string, input: { phone?: unknown; uei?: unknown; channel?: unknown; body?: unknown; content?: unknown; attachments?: unknown }) {
    const body = text(input?.body);
    const attachments = Array.isArray(input?.attachments) ? input.attachments : [];
    const hasRichContent = Boolean(input?.content && typeof input.content === 'object');
    if (!body && !attachments.length && !hasRichContent) throw new BadRequestException('Пустое сообщение');

    const channel = await this.resolveChannel(tenantId, input || {});
    if (channel === 'IN_APP') {
      const account = await this.channels.resolveInAppAccount(tenantId, input || {});
      if (!account) throw new NotFoundException('Внутренний чат клиента недоступен');
      const message = await this.communications.recordMessage(tenantId, {
        bookingAccountId: account.id,
        phone: input?.phone || account.phone,
        uei: input?.uei || account.uei,
        direction: 'outbound',
        kind: attachments.length ? 'media' : 'message',
        channel: 'IN_APP',
        body,
        content: input?.content,
        attachments,
        status: 'delivered',
      });
      await this.notifications.createForAccount(tenantId, account.id, {
        type: 'chat.message',
        title: 'Новое сообщение',
        body: message.body || (attachments.length ? 'Новое сообщение с вложением' : 'Новое сообщение'),
        entityType: 'chat-message',
        entityId: message.id,
        uei: message.uei,
      }).catch(() => null);
      return message;
    }
    if (channel === 'TELEGRAM') return this.channels.sendTelegram(tenantId, { phone: input?.phone, uei: input?.uei, body });
    throw new BadRequestException('Канал пока не подключён к двустороннему Chat');
  }
}

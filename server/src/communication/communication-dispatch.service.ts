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

  async resolveChannel(tenantId: string, input: { phone?: unknown; uei?: unknown; channel?: unknown }) {
    const requested = text(input?.channel).toUpperCase();
    if (requested === 'IN_APP') {
      if (!(await this.channels.resolveInAppAccount(tenantId, input || {}))) throw new NotFoundException('Внутренний чат клиента недоступен');
      return 'IN_APP';
    }
    if (requested === 'TELEGRAM') {
      if (!(await this.channels.resolveTelegramIdentity(tenantId, input || {}))) throw new NotFoundException('Канал TELEGRAM у клиента недоступен');
      return 'TELEGRAM';
    }
    if (requested) throw new NotFoundException(`Канал ${requested} у клиента недоступен`);

    if (await this.channels.resolveInAppAccount(tenantId, input || {})) return 'IN_APP';

    const available: string[] = [];
    if (await this.channels.resolveTelegramIdentity(tenantId, input || {})) available.push('TELEGRAM');
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

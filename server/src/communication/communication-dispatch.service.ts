import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { CommunicationHistoryService } from './communication-history.service';
import { TelegramBotService } from './telegram-bot.service';
import { EmailChannelService } from './email-channel.service';
import type { MessagePurpose } from './message-purpose';
import { SaasAccessService } from '../saas-access/saas-access.service';

function text(value: unknown) { return String(value ?? '').trim(); }

function telegramRecipient(input: { phone?: unknown; uei?: unknown } = {}) {
  const phone = text(input?.phone);
  return phone
    ? { phone, uei: '' }
    : { phone: '', uei: text(input?.uei) };
}

@Injectable()
export class CommunicationDispatchService {
  constructor(
    private readonly communications: CommunicationService,
    private readonly history: CommunicationHistoryService,
    private readonly telegram: TelegramBotService,
    private readonly email: EmailChannelService,
    private readonly access: SaasAccessService,
  ) {}

  async availableChannels(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const channels: string[] = ['PUSH'];
    if (await this.communications.telegramIdentity(tenantId, telegramRecipient(input || {}))) channels.push('TELEGRAM');
    if (await this.email.isAvailable(tenantId) && await this.communications.emailIdentity(tenantId, input || {})) channels.push('EMAIL');
    return channels;
  }

  async resolveChannel(tenantId: string, input: { phone?: unknown; uei?: unknown; channel?: unknown }) {
    const requested = text(input?.channel).toUpperCase();
    const available = await this.availableChannels(tenantId, input || {});
    if (requested) {
      if (!available.includes(requested)) throw new NotFoundException(`Канал ${requested} у человека недоступен`);
      return requested;
    }
    const preferences = await this.history.getPreferences(tenantId, input || {});
    const preferred = preferences.preferredChannels.find((channel) => available.includes(channel));
    return preferred || available[0];
  }

  async send(tenantId: string, input: { phone?: unknown; uei?: unknown; channel?: unknown; subject?: unknown; body?: unknown; attachments?: unknown; purpose: MessagePurpose }) {
    await this.access.assertRealOperationsAllowed(tenantId);
    const body = text(input?.body);
    const attachments = Array.isArray(input?.attachments) ? input.attachments : [];
    if (!body && !attachments.length) throw new BadRequestException('Пустое сообщение');

    const channel = await this.resolveChannel(tenantId, input || {});
    if (attachments.length && channel !== 'PUSH') {
      throw new BadRequestException('Вложения можно отправить только через Push');
    }
    if (channel === 'PUSH') {
      return this.communications.recordMessage(tenantId, {
        phone: input?.phone,
        uei: input?.uei,
        direction: 'outbound',
        kind: attachments.length ? 'media' : 'message',
        purpose: input.purpose,
        channel: 'IN_APP',
        body,
        attachments,
        status: 'delivered',
      });
    }
    if (channel === 'TELEGRAM') {
      const recipient = telegramRecipient(input || {});
      return this.telegram.sendChatMessage(tenantId, { ...recipient, body, purpose: input.purpose });
    }
    if (channel === 'EMAIL') return this.email.sendMessage(tenantId, { phone: input?.phone, uei: input?.uei, subject: input?.subject, body, purpose: input.purpose });
    throw new BadRequestException('Канал пока не подключён');
  }
}

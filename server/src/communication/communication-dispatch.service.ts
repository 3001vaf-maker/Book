import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConsentPolicyService } from '../document-state/consent-policy.service';
import { CommunicationService } from './communication.service';
import { CommunicationHistoryService } from './communication-history.service';
import { TelegramBotService } from './telegram-bot.service';
import type { MessagePurpose } from './message-purpose';

function text(value: unknown) { return String(value ?? '').trim(); }

@Injectable()
export class CommunicationDispatchService {
  constructor(
    private readonly communications: CommunicationService,
    private readonly consentPolicy: ConsentPolicyService,
    private readonly history: CommunicationHistoryService,
    private readonly telegram: TelegramBotService,
  ) {}

  private async availableChannels(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const channels: string[] = [];
    if (await this.communications.telegramIdentity(tenantId, input || {})) channels.push('TELEGRAM');
    return channels;
  }

  async resolveChannel(tenantId: string, input: { phone?: unknown; uei?: unknown; channel?: unknown }) {
    const requested = text(input?.channel).toUpperCase();
    const available = await this.availableChannels(tenantId, input || {});
    if (requested) {
      if (!available.includes(requested)) throw new NotFoundException(`Канал ${requested} у клиента недоступен`);
      return requested;
    }
    const preferences = await this.history.getPreferences(tenantId, input || {});
    const preferred = preferences.preferredChannels.find((channel) => available.includes(channel));
    const selected = preferred || available[0] || '';
    if (!selected) throw new NotFoundException('У клиента нет доступного двустороннего канала');
    return selected;
  }

  async send(tenantId: string, input: { phone?: unknown; uei?: unknown; channel?: unknown; body?: unknown; attachments?: unknown; purpose: MessagePurpose }) {
    const body = text(input?.body);
    const attachments = Array.isArray(input?.attachments) ? input.attachments : [];
    if (!body && !attachments.length) throw new BadRequestException('Пустое сообщение');
    if (!(await this.consentPolicy.hasActivePdnConsentForIdentity(tenantId, input?.phone, input?.uei))) {
      throw new BadRequestException('Нет действующего согласия на обработку ПДН');
    }

    if (attachments.length) {
      return this.communications.recordMessage(tenantId, {
        phone: input?.phone,
        uei: input?.uei,
        direction: 'outbound',
        kind: 'media',
        purpose: input.purpose,
        channel: 'IN_APP',
        body,
        attachments,
        status: 'delivered',
      });
    }

    const channel = await this.resolveChannel(tenantId, input || {});
    if (channel === 'TELEGRAM') return this.telegram.sendChatMessage(tenantId, { phone: input?.phone, uei: input?.uei, body, purpose: input.purpose });
    throw new BadRequestException('Канал пока не подключён к двустороннему Chat');
  }
}

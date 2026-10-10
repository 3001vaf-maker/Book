import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { ConsentPolicyService } from '../tenant-document-archive/consent-policy.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma.service';
import { CommunicationService } from './communication.service';
import { normalizeMessagePurpose, type MessagePurpose } from './message-purpose';

type TelegramBotRow = {
  id: string; tenantId: string; botId: string; botUsername: string; encryptedToken: string; tokenIv: string; tokenTag: string;
  webhookKey: string; webhookSecretHash: string; status: string; connectedAt: Date; updatedAt: Date;
};
type TelegramIdentityRow = { personPhone: string; uei: string };
const TELEGRAM_API_TIMEOUT_MS = 10_000;
function text(value: unknown) { return String(value ?? '').trim(); }
function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}
function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function telegramUsername(value: unknown) { const clean = text(value).replace(/^@+/, ''); return clean ? `@${clean}` : ''; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error || ''); }

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly dispatching = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly communications: CommunicationService,
    private readonly notifications: NotificationService,
    private readonly consentPolicy: ConsentPolicyService,
  ) {}

  onModuleInit() {
    const interval = Math.max(1000, Number(process.env.TELEGRAM_DELIVERY_POLL_MS || 3000));
    this.pollTimer = setInterval(() => this.dispatchAllTenantsInBackground(), interval);
    this.pollTimer.unref?.();
  }
  onModuleDestroy() { if (this.pollTimer) clearInterval(this.pollTimer); this.pollTimer = null; }

  private dispatchAllTenantsInBackground() {
    void this.dispatchAllTenants().catch((error) => {
      const message = errorMessage(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Telegram delivery polling failed: ${message}`, stack);
    });
  }

  private dispatchTenantInBackground(tenantId: string) {
    void this.dispatchTenant(tenantId).catch((error) => {
      const message = errorMessage(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Telegram delivery dispatch failed for tenant ${tenantId}: ${message}`, stack);
    });
  }

  private configurationStatus() {
    const publicApiUrl = text(process.env.PUBLIC_API_URL).replace(/\/$/, '');
    const accountAppUrl = text(process.env.ACCOUNT_APP_URL).replace(/\/$/, '');
    const credentialsKeyConfigured = Boolean(text(process.env.TELEGRAM_CREDENTIALS_KEY));
    const publicApiUrlConfigured = /^https:\/\//i.test(publicApiUrl);
    const accountAppUrlConfigured = /^https:\/\//i.test(accountAppUrl);
    return {
      credentialsKeyConfigured,
      publicApiUrlConfigured,
      accountAppUrlConfigured,
      ready: credentialsKeyConfigured && publicApiUrlConfigured && accountAppUrlConfigured,
    };
  }

  private encryptionKey() {
    const secret = text(process.env.TELEGRAM_CREDENTIALS_KEY);
    if (!secret) throw new ServiceUnavailableException('Не настроен ключ шифрования Telegram');
    return createHash('sha256').update(secret).digest();
  }
  private encryptToken(token: string) {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return { encryptedToken: encrypted.toString('base64url'), tokenIv: iv.toString('base64url'), tokenTag: cipher.getAuthTag().toString('base64url') };
  }
  private decryptToken(row: TelegramBotRow) {
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(row.tokenIv, 'base64url'));
    decipher.setAuthTag(Buffer.from(row.tokenTag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(row.encryptedToken, 'base64url')), decipher.final()]).toString('utf8');
  }
  private async telegramApi(token: string, method: string, payload: Record<string, any> = {}) {
    const startedAt = Date.now();
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
      });
      const data = await response.json().catch(() => ({})) as Record<string, any>;
      if (!response.ok || !data.ok) throw new BadRequestException(text(data?.description) || 'Telegram отклонил запрос');
      this.logger.log(`[telegram-api] ${method} ok ${Date.now() - startedAt}ms`);
      return data.result;
    } catch (error) {
      const message = errorMessage(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[telegram-api] ${method} failed ${Date.now() - startedAt}ms: ${message}`, stack);
      throw error;
    }
  }
  private publicConnection(row: TelegramBotRow | null) {
    if (!row) return { connected: false };
    return { connected: true, botId: row.botId, botUsername: telegramUsername(row.botUsername), storedStatus: row.status, connectedAt: row.connectedAt, updatedAt: row.updatedAt };
  }
  private expectedWebhookUrl(row: TelegramBotRow) {
    const publicApiUrl = text(process.env.PUBLIC_API_URL).replace(/\/$/, '');
    return publicApiUrl ? `${publicApiUrl}/communications/telegram/webhook/${row.webhookKey}` : '';
  }
  private async rowForTenant(tenantId: string) {
    const rows = await this.prisma.$queryRaw<TelegramBotRow[]>`
      SELECT "id", "tenantId", "botId", "botUsername", "encryptedToken", "tokenIv", "tokenTag", "webhookKey", "webhookSecretHash", "status", "connectedAt", "updatedAt"
      FROM "TelegramBotConnection" WHERE "tenantId" = ${tenantId} LIMIT 1
    `;
    return rows[0] || null;
  }

  async getConnection(tenantId: string) {
    const configuration = this.configurationStatus();
    const row = await this.rowForTenant(tenantId);
    if (!row) return { connected: false, status: 'disconnected', webhookActive: false, configuration };
    const base = this.publicConnection(row);
    if (!configuration.credentialsKeyConfigured) {
      return { ...base, status: 'error', webhookActive: false, webhookError: 'Не настроен ключ шифрования Telegram', webhookPendingUpdateCount: 0, configuration };
    }
    if (!configuration.publicApiUrlConfigured) {
      return { ...base, status: 'error', webhookActive: false, webhookError: 'Не настроен PUBLIC_API_URL', webhookPendingUpdateCount: 0, configuration };
    }
    try {
      this.logger.log(`[telegram-health] checking tenant=${tenantId} bot=${row.botUsername}`);
      const info = await this.telegramApi(this.decryptToken(row), 'getWebhookInfo') as Record<string, any>;
      const expectedUrl = this.expectedWebhookUrl(row);
      const actualUrl = text(info?.url);
      const webhookError = text(info?.last_error_message);
      const webhookPendingUpdateCount = Math.max(0, Number(info?.pending_update_count || 0));
      const webhookUrlMatches = Boolean(actualUrl && expectedUrl && actualUrl === expectedUrl);
      const webhookActive = webhookUrlMatches && !webhookError;
      const linkReady = webhookActive && configuration.accountAppUrlConfigured;
      this.logger.log(`[telegram-health] tenant=${tenantId} active=${webhookActive} urlMatches=${webhookUrlMatches} pending=${webhookPendingUpdateCount} telegramError=${Boolean(webhookError)}`);
      return {
        ...base,
        status: linkReady ? 'active' : webhookActive ? 'link_unconfigured' : 'error',
        webhookActive,
        webhookUrlMatches,
        webhookError: webhookError || (!webhookUrlMatches ? 'Webhook Telegram не совпадает с адресом приложения' : '') || (!configuration.accountAppUrlConfigured ? 'Не настроен ACCOUNT_APP_URL' : ''),
        webhookPendingUpdateCount,
        configuration,
      };
    } catch (error) {
      const message = errorMessage(error) || 'Не удалось проверить webhook Telegram';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[telegram-health] tenant=${tenantId} failed: ${message}`, stack);
      return { ...base, status: 'error', webhookActive: false, webhookError: message, webhookPendingUpdateCount: 0, configuration };
    }
  }

  async connect(tenantId: string, rawToken: unknown) {
    const configuration = this.configurationStatus();
    if (!configuration.credentialsKeyConfigured) throw new ServiceUnavailableException('Не настроен ключ шифрования Telegram');
    if (!configuration.publicApiUrlConfigured) throw new ServiceUnavailableException('Не настроен PUBLIC_API_URL для Telegram webhook');
    if (!configuration.accountAppUrlConfigured) throw new ServiceUnavailableException('Не настроен ACCOUNT_APP_URL для Telegram-входа');
    const token = text(rawToken);
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token)) throw new BadRequestException('Некорректный токен Telegram-бота');
    if (await this.rowForTenant(tenantId)) {
      throw new ConflictException('Telegram-бот уже подключён. Сначала отключите его.');
    }
    const bot = await this.telegramApi(token, 'getMe');
    if (!bot?.id || !bot?.is_bot) throw new BadRequestException('Токен не принадлежит Telegram-боту');
    const botId = String(bot.id); const botUsername = telegramUsername(bot.username);
    const ownership = await this.prisma.$queryRaw<Array<{ tenantId: string }>>`SELECT "tenantId" FROM "TelegramBotConnection" WHERE "botId" = ${botId} LIMIT 1`;
    if (ownership[0] && ownership[0].tenantId !== tenantId) throw new ConflictException('Этот Telegram-бот уже подключён к другому аккаунту');
    const encrypted = this.encryptToken(token); const webhookKey = randomBytes(24).toString('base64url'); const webhookSecret = randomBytes(24).toString('base64url');
    const publicApiUrl = text(process.env.PUBLIC_API_URL).replace(/\/$/, '');
    await this.telegramApi(token, 'setWebhook', { url: `${publicApiUrl}/communications/telegram/webhook/${webhookKey}`, secret_token: webhookSecret, allowed_updates: ['message'], drop_pending_updates: false });
    const inserted = await this.prisma.$executeRaw`
      INSERT INTO "TelegramBotConnection" ("id", "tenantId", "botId", "botUsername", "encryptedToken", "tokenIv", "tokenTag", "webhookKey", "webhookSecretHash", "status", "connectedAt", "updatedAt")
      VALUES (${randomUUID()}, ${tenantId}, ${botId}, ${botUsername}, ${encrypted.encryptedToken}, ${encrypted.tokenIv}, ${encrypted.tokenTag}, ${webhookKey}, ${sha256(webhookSecret)}, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("tenantId") DO NOTHING
    `;
    if (!inserted) {
      try { await this.telegramApi(token, 'deleteWebhook', { drop_pending_updates: false }); } catch {}
      throw new ConflictException('Telegram-бот уже подключён. Сначала отключите его.');
    }
    this.dispatchTenantInBackground(tenantId);
    return this.getConnection(tenantId);
  }

  async repairConnection(tenantId: string) {
    const configuration = this.configurationStatus();
    if (!configuration.credentialsKeyConfigured) throw new ServiceUnavailableException('Не настроен ключ шифрования Telegram');
    if (!configuration.publicApiUrlConfigured) throw new ServiceUnavailableException('Не настроен PUBLIC_API_URL для Telegram webhook');
    if (!configuration.accountAppUrlConfigured) throw new ServiceUnavailableException('Не настроен ACCOUNT_APP_URL для Telegram-входа');
    const row = await this.rowForTenant(tenantId);
    if (!row) throw new NotFoundException('Telegram-бот не подключён');
    const token = this.decryptToken(row);
    const webhookSecret = randomBytes(24).toString('base64url');
    this.logger.log(`[telegram-repair] tenant=${tenantId} setWebhook start`);
    await this.telegramApi(token, 'setWebhook', {
      url: this.expectedWebhookUrl(row),
      secret_token: webhookSecret,
      allowed_updates: ['message'],
      drop_pending_updates: false,
    });
    await this.prisma.$executeRaw`
      UPDATE "TelegramBotConnection"
      SET "webhookSecretHash" = ${sha256(webhookSecret)}, "status" = 'active', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "tenantId" = ${tenantId}
    `;
    this.logger.log(`[telegram-repair] tenant=${tenantId} setWebhook stored`);
    return this.getConnection(tenantId);
  }

  async disconnect(tenantId: string) {
    const row = await this.rowForTenant(tenantId); if (!row) return { connected: false };
    try { await this.telegramApi(this.decryptToken(row), 'deleteWebhook', { drop_pending_updates: false }); } catch {}
    await this.prisma.$queryRaw`DELETE FROM "TelegramBotConnection" WHERE "tenantId" = ${tenantId}`;
    return { connected: false, status: 'disconnected', webhookActive: false, configuration: this.configurationStatus() };
  }

  async sendMessage(tenantId: string, telegramUserId: string, body: string) {
    const row = await this.rowForTenant(tenantId); if (!row) throw new NotFoundException('Telegram-бот не подключён');
    return this.telegramApi(this.decryptToken(row), 'sendMessage', { chat_id: telegramUserId, text: body });
  }

  private async sendSystemMessage(
    connection: TelegramBotRow,
    chatId: string | number,
    body: string,
    replyMarkup: Record<string, any> | null = null,
  ) {
    const purpose: MessagePurpose = 'SYSTEM';
    if (!normalizeMessagePurpose(purpose)) throw new BadRequestException('Некорректный purpose системного сообщения');
    return this.telegramApi(this.decryptToken(connection), 'sendMessage', {
      chat_id: chatId,
      text: body,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }

  async sendChatMessage(tenantId: string, input: { phone?: unknown; uei?: unknown; body?: unknown; purpose?: unknown }) {
    const body = text(input?.body); if (!body) throw new BadRequestException('Пустое сообщение');
    const purpose = normalizeMessagePurpose(input?.purpose); if (!purpose) throw new BadRequestException('Не указан purpose сообщения');
    const identity = await this.communications.telegramIdentity(tenantId, input || {}); if (!identity) throw new NotFoundException('Telegram у человека не подключён');
    if (purpose === 'MARKETING' && !(await this.consentPolicy.canSendMarketing(tenantId, 'TELEGRAM', identity.externalUserId))) {
      throw new BadRequestException('Нет действующего рекламного согласия для Telegram');
    }
    try {
      const result = await this.sendMessage(tenantId, identity.externalUserId, body);
      return this.communications.recordMessage(tenantId, { phone: identity.personPhone, uei: identity.uei, direction: 'outbound', kind: 'message', purpose, channel: 'TELEGRAM', body, externalMessageId: String(result?.message_id || ''), externalThreadId: String(result?.chat?.id || identity.externalUserId), status: 'sent' });
    } catch (error) {
      await this.communications.recordMessage(tenantId, { phone: identity.personPhone, uei: identity.uei, direction: 'outbound', kind: 'message', purpose, channel: 'TELEGRAM', body, status: 'failed', error: errorMessage(error) });
      throw error;
    }
  }

  private async dispatchAllTenants() {
    const rows = await this.prisma.$queryRaw<Array<{ tenantId: string }>>`SELECT "tenantId" FROM "TelegramBotConnection" WHERE "status" IN ('connected', 'active')`;
    await Promise.allSettled(rows.map((row) => this.dispatchTenant(row.tenantId)));
  }
  async dispatchTenant(tenantId: string, limit = 100) {
    if (this.dispatching.has(tenantId)) return { busy: true, sent: 0, failed: 0 };
    this.dispatching.add(tenantId); let sent = 0; let failed = 0;
    try {
      const connection = await this.rowForTenant(tenantId); if (!connection) return { busy: false, sent, failed };
      const token = this.decryptToken(connection); const deliveries = await this.notifications.pendingTelegramDeliveries(tenantId, limit);
      for (const delivery of deliveries) {
        try {
          const allowed = await this.notifications.canSendTelegramDelivery(tenantId, delivery.notificationId);
          if (!allowed) { await this.notifications.markTelegramFailed(tenantId, delivery.deliveryId, 'Отправка запрещена для purpose/канала'); failed += 1; continue; }
          await this.telegramApi(token, 'sendMessage', { chat_id: delivery.recipientKey, text: delivery.body || delivery.title });
          await this.notifications.markTelegramSent(tenantId, delivery.deliveryId); sent += 1;
        } catch (error) { await this.notifications.markTelegramFailed(tenantId, delivery.deliveryId, errorMessage(error)); failed += 1; }
      }
      return { busy: false, sent, failed };
    } finally { this.dispatching.delete(tenantId); }
  }

  async handleWebhook(webhookKey: string, secretToken: unknown, update: Record<string, any>) {
    const updateId = text(update?.update_id) || 'unknown';
    const startedAt = Date.now();
    this.logger.log(`[telegram-webhook] received update=${updateId}`);
    try {
      const rows = await this.prisma.$queryRaw<TelegramBotRow[]>`
        SELECT "id", "tenantId", "botId", "botUsername", "encryptedToken", "tokenIv", "tokenTag", "webhookKey", "webhookSecretHash", "status", "connectedAt", "updatedAt"
        FROM "TelegramBotConnection" WHERE "webhookKey" = ${webhookKey} LIMIT 1
      `;
      const connection = rows[0];
      if (!connection) {
        this.logger.warn(`[telegram-webhook] update=${updateId} connection-not-found`);
        throw new NotFoundException('Telegram webhook не найден');
      }
      if (sha256(text(secretToken)) !== connection.webhookSecretHash) {
        this.logger.warn(`[telegram-webhook] update=${updateId} tenant=${connection.tenantId} secret-mismatch`);
        throw new UnauthorizedException('Некорректный Telegram webhook secret');
      }
      const message = update?.message;
      if (!message?.from?.id || !message?.chat?.id) {
        this.logger.log(`[telegram-webhook] update=${updateId} tenant=${connection.tenantId} ignored-non-message`);
        return { ok: true };
      }
      const telegramUserId = String(message.from.id); const username = telegramUsername(message.from.username); const messageBody = text(message.text || message.caption);
      const isStart = /^\/start(?:@\w+)?(?:\s|$)/i.test(messageBody);
      this.logger.log(`[telegram-webhook] update=${updateId} tenant=${connection.tenantId} message-received start=${isStart}`);
      const identities = await this.prisma.$queryRaw<TelegramIdentityRow[]>`
        SELECT "personPhone", "uei" FROM "CommunicationIdentity"
        WHERE "tenantId" = ${connection.tenantId} AND "channel" = 'TELEGRAM' AND "externalUserId" = ${telegramUserId} LIMIT 1
      `;
      const identity = identities[0] || null;
      this.logger.log(`[telegram-webhook] update=${updateId} tenant=${connection.tenantId} identity-found=${Boolean(identity)}`);
      if (!identity || isStart) {
        this.logger.log(`[telegram-webhook] update=${updateId} tenant=${connection.tenantId} create-entry start`);
        const entry = await this.communications.createTelegramEntry(connection.tenantId, { telegramUserId, username });
        this.logger.log(`[telegram-webhook] update=${updateId} tenant=${connection.tenantId} create-entry ok`);
        const accountAppUrl = text(process.env.ACCOUNT_APP_URL).replace(/\/$/, '');
        if (!accountAppUrl) throw new ServiceUnavailableException('Не настроен ACCOUNT_APP_URL для Telegram-входа');
        const url = new URL(accountAppUrl); url.searchParams.set('booking', connection.tenantId); url.searchParams.set('tg_entry', entry.token);
        const launchButton = message.chat.type === 'private'
          ? { text: 'Открыть приложение', web_app: { url: url.toString() } }
          : { text: 'Открыть приложение', url: url.toString() };
        this.logger.log(`[telegram-webhook] update=${updateId} tenant=${connection.tenantId} send-start-reply start`);
        await this.sendSystemMessage(
          connection,
          message.chat.id,
          'Откройте приложение, чтобы продолжить.',
          { inline_keyboard: [[launchButton]] },
        );
        this.logger.log(`[telegram-webhook] update=${updateId} tenant=${connection.tenantId} send-start-reply ok`);
        if (!identity) return { ok: true, linked: false };
      }
      if (messageBody && !isStart) {
        await this.communications.recordMessage(connection.tenantId, { phone: identity!.personPhone, uei: identity!.uei, direction: 'inbound', kind: 'message', purpose: 'DIRECT', channel: 'TELEGRAM', body: messageBody, externalMessageId: String(message.message_id || ''), externalThreadId: String(message.chat.id), status: 'delivered' });
        this.logger.log(`[telegram-webhook] update=${updateId} tenant=${connection.tenantId} inbound-recorded`);
      }
      this.logger.log(`[telegram-webhook] update=${updateId} tenant=${connection.tenantId} completed ${Date.now() - startedAt}ms`);
      return { ok: true, linked: true };
    } catch (error) {
      const message = errorMessage(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[telegram-webhook] update=${updateId} failed ${Date.now() - startedAt}ms: ${message}`, stack);
      throw error;
    }
  }
}

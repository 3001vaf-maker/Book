import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { LegalRuntimeService } from '../legal-runtime/legal-runtime.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma.service';
import { CommunicationService } from './communication.service';

type TelegramBotRow = {
  id: string; tenantId: string; botId: string; botUsername: string; encryptedToken: string; tokenIv: string; tokenTag: string;
  webhookKey: string; webhookSecretHash: string; status: string; connectedAt: Date; updatedAt: Date;
};
type TelegramIdentityRow = { cardPhone: string; uei: string };
function text(value: unknown) { return String(value ?? '').trim(); }
function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}
function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function telegramUsername(value: unknown) { const clean = text(value).replace(/^@+/, ''); return clean ? `@${clean}` : ''; }

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly dispatching = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly communications: CommunicationService,
    private readonly notifications: NotificationService,
    private readonly legal: LegalRuntimeService,
  ) {}

  onModuleInit() {
    const interval = Math.max(1000, Number(process.env.TELEGRAM_DELIVERY_POLL_MS || 3000));
    this.pollTimer = setInterval(() => void this.dispatchAllTenants(), interval);
    this.pollTimer.unref?.();
  }
  onModuleDestroy() { if (this.pollTimer) clearInterval(this.pollTimer); this.pollTimer = null; }

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
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({})) as Record<string, any>;
    if (!response.ok || !data.ok) throw new BadRequestException(text(data?.description) || 'Telegram отклонил запрос');
    return data.result;
  }
  private environmentStatus() {
    const publicApiUrl = text(process.env.PUBLIC_API_URL).replace(/\/$/, '');
    const clientAppUrl = text(process.env.CLIENT_APP_URL).replace(/\/$/, '');
    const isHttps = (value: string) => {
      if (!value) return false;
      try { return new URL(value).protocol === 'https:'; } catch { return false; }
    };
    const credentialsKeyConfigured = Boolean(text(process.env.TELEGRAM_CREDENTIALS_KEY));
    const publicApiUrlConfigured = isHttps(publicApiUrl);
    const clientAppUrlConfigured = isHttps(clientAppUrl);
    return {
      credentialsKeyConfigured,
      publicApiUrlConfigured,
      clientAppUrlConfigured,
      ready: credentialsKeyConfigured && publicApiUrlConfigured && clientAppUrlConfigured,
    };
  }
  private requiredHttpsUrl(name: 'PUBLIC_API_URL' | 'CLIENT_APP_URL') {
    const value = text(process.env[name]).replace(/\/$/, '');
    if (!value) throw new ServiceUnavailableException(`Не настроен ${name}`);
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') throw new Error('https required');
      return url.toString().replace(/\/$/, '');
    } catch {
      throw new ServiceUnavailableException(`${name} должен быть корректным HTTPS URL`);
    }
  }
  private webhookUrl(webhookKey: string) {
    const publicApiUrl = text(process.env.PUBLIC_API_URL).replace(/\/$/, '');
    return publicApiUrl ? `${publicApiUrl}/communications/telegram/webhook/${webhookKey}` : '';
  }
  private publicConnection(row: TelegramBotRow | null, webhook: Record<string, any> = {}) {
    const configuration = this.environmentStatus();
    if (!row) return { connected: false, configuration };
    return {
      connected: true,
      botId: row.botId,
      botUsername: telegramUsername(row.botUsername),
      status: row.status,
      webhookActive: false,
      connectedAt: row.connectedAt,
      updatedAt: row.updatedAt,
      configuration,
      ...webhook,
    };
  }
  private async rowForTenant(tenantId: string) {
    const rows = await this.prisma.$queryRaw<TelegramBotRow[]>`
      SELECT "id", "tenantId", "botId", "botUsername", "encryptedToken", "tokenIv", "tokenTag", "webhookKey", "webhookSecretHash", "status", "connectedAt", "updatedAt"
      FROM "TelegramBotConnection" WHERE "tenantId" = ${tenantId} LIMIT 1
    `;
    return rows[0] || null;
  }
  async getConnection(tenantId: string) {
    const row = await this.rowForTenant(tenantId);
    if (!row) return this.publicConnection(null);
    try {
      const info = await this.telegramApi(this.decryptToken(row), 'getWebhookInfo');
      const expectedUrl = this.webhookUrl(row.webhookKey);
      const webhookActive = Boolean(expectedUrl && text(info?.url) === expectedUrl && !text(info?.last_error_message));
      return this.publicConnection(row, {
        webhookActive,
        webhookPendingUpdateCount: Number(info?.pending_update_count || 0),
        webhookError: text(info?.last_error_message),
      });
    } catch (error) {
      return this.publicConnection(row, {
        webhookActive: false,
        webhookError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async connect(tenantId: string, rawToken: unknown) {
    const token = text(rawToken);
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token)) throw new BadRequestException('Некорректный токен Telegram-бота');
    this.encryptionKey();
    const publicApiUrl = this.requiredHttpsUrl('PUBLIC_API_URL');
    this.requiredHttpsUrl('CLIENT_APP_URL');
    const bot = await this.telegramApi(token, 'getMe');
    if (!bot?.id || !bot?.is_bot) throw new BadRequestException('Токен не принадлежит Telegram-боту');
    const botId = String(bot.id); const botUsername = telegramUsername(bot.username);
    const ownership = await this.prisma.$queryRaw<Array<{ tenantId: string }>>`SELECT "tenantId" FROM "TelegramBotConnection" WHERE "botId" = ${botId} LIMIT 1`;
    if (ownership[0] && ownership[0].tenantId !== tenantId) throw new ConflictException('Этот Telegram-бот уже подключён к другому аккаунту Book');
    const encrypted = this.encryptToken(token); const webhookKey = randomBytes(24).toString('base64url'); const webhookSecret = randomBytes(24).toString('base64url');
    const webhookUrl = `${publicApiUrl}/communications/telegram/webhook/${webhookKey}`;
    await this.telegramApi(token, 'setWebhook', { url: webhookUrl, secret_token: webhookSecret, allowed_updates: ['message'], drop_pending_updates: false });
    const webhookInfo = await this.telegramApi(token, 'getWebhookInfo');
    if (text(webhookInfo?.url) !== webhookUrl) throw new ServiceUnavailableException('Telegram не подтвердил webhook Book');
    const status = 'active';
    await this.prisma.$executeRaw`
      INSERT INTO "TelegramBotConnection" ("id", "tenantId", "botId", "botUsername", "encryptedToken", "tokenIv", "tokenTag", "webhookKey", "webhookSecretHash", "status", "connectedAt", "updatedAt")
      VALUES (${randomUUID()}, ${tenantId}, ${botId}, ${botUsername}, ${encrypted.encryptedToken}, ${encrypted.tokenIv}, ${encrypted.tokenTag}, ${webhookKey}, ${sha256(webhookSecret)}, ${status}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("tenantId") DO UPDATE SET "botId" = EXCLUDED."botId", "botUsername" = EXCLUDED."botUsername", "encryptedToken" = EXCLUDED."encryptedToken", "tokenIv" = EXCLUDED."tokenIv", "tokenTag" = EXCLUDED."tokenTag", "webhookKey" = EXCLUDED."webhookKey", "webhookSecretHash" = EXCLUDED."webhookSecretHash", "status" = EXCLUDED."status", "connectedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    `;
    void this.dispatchTenant(tenantId);
    return this.getConnection(tenantId);
  }

  async disconnect(tenantId: string) {
    const row = await this.rowForTenant(tenantId); if (!row) return { connected: false };
    try { await this.telegramApi(this.decryptToken(row), 'deleteWebhook', { drop_pending_updates: false }); } catch {}
    await this.prisma.$executeRaw`DELETE FROM "TelegramBotConnection" WHERE "tenantId" = ${tenantId}`;
    return { connected: false, configuration: this.environmentStatus() };
  }

  async sendMessage(tenantId: string, telegramUserId: string, body: string) {
    await this.legal.assertTenantLive(tenantId, '', 'TELEGRAM_DIRECT_SEND');
    const row = await this.rowForTenant(tenantId); if (!row) throw new NotFoundException('Telegram-бот не подключён');
    return this.telegramApi(this.decryptToken(row), 'sendMessage', { chat_id: telegramUserId, text: body });
  }

  async sendChatMessage(tenantId: string, input: { phone?: unknown; uei?: unknown; body?: unknown }) {
    const body = text(input?.body); if (!body) throw new BadRequestException('Пустое сообщение');
    const identity = await this.communications.telegramIdentity(tenantId, input || {}); if (!identity) throw new NotFoundException('Telegram у клиента не подключён');
    await this.legal.assertExternalCommunication(tenantId, {
      purpose: 'DIALOG',
      channel: 'TELEGRAM',
      destination: identity.externalUserId,
    });
    try {
      const result = await this.sendMessage(tenantId, identity.externalUserId, body);
      return this.communications.recordMessage(tenantId, { phone: identity.cardPhone, uei: identity.uei, direction: 'outbound', kind: 'message', channel: 'TELEGRAM', body, externalMessageId: String(result?.message_id || ''), externalThreadId: String(result?.chat?.id || identity.externalUserId), status: 'sent' });
    } catch (error) {
      await this.communications.recordMessage(tenantId, { phone: identity.cardPhone, uei: identity.uei, direction: 'outbound', kind: 'message', channel: 'TELEGRAM', body, status: 'failed', error: error instanceof Error ? error.message : String(error) });
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
          await this.legal.assertTenantLive(tenantId, '', 'TELEGRAM_NOTIFICATION_DELIVERY');
          const allowed = await this.notifications.canSendTelegramDelivery(tenantId, delivery.notificationId);
          if (!allowed) { await this.notifications.markTelegramFailed(tenantId, delivery.deliveryId, 'messages-consent отсутствует или отозван'); failed += 1; continue; }
          await this.telegramApi(token, 'sendMessage', { chat_id: delivery.recipientKey, text: delivery.body || delivery.title });
          await this.notifications.markTelegramSent(tenantId, delivery.deliveryId); sent += 1;
        } catch (error) { await this.notifications.markTelegramFailed(tenantId, delivery.deliveryId, error instanceof Error ? error.message : String(error)); failed += 1; }
      }
      return { busy: false, sent, failed };
    } finally { this.dispatching.delete(tenantId); }
  }

  async handleWebhook(webhookKey: string, secretToken: unknown, update: Record<string, any>) {
    const rows = await this.prisma.$queryRaw<TelegramBotRow[]>`
      SELECT "id", "tenantId", "botId", "botUsername", "encryptedToken", "tokenIv", "tokenTag", "webhookKey", "webhookSecretHash", "status", "connectedAt", "updatedAt"
      FROM "TelegramBotConnection" WHERE "webhookKey" = ${webhookKey} LIMIT 1
    `;
    const connection = rows[0]; if (!connection) throw new NotFoundException('Telegram webhook не найден');
    if (sha256(text(secretToken)) !== connection.webhookSecretHash) throw new UnauthorizedException('Некорректный Telegram webhook secret');
    try {
      await this.legal.assertTenantLive(connection.tenantId, '', 'TELEGRAM_WEBHOOK');
    } catch {
      return { ok: true, ignored: true };
    }
    const message = update?.message; if (!message?.from?.id || !message?.chat?.id) return { ok: true };
    const telegramUserId = String(message.from.id); const username = telegramUsername(message.from.username); const messageBody = text(message.text || message.caption);
    const isStart = /^\/start(?:@\w+)?(?:\s|$)/i.test(messageBody);
    const identities = await this.prisma.$queryRaw<TelegramIdentityRow[]>`
      SELECT "cardPhone", "uei" FROM "CommunicationIdentity"
      WHERE "tenantId" = ${connection.tenantId} AND "channel" = 'TELEGRAM' AND "externalUserId" = ${telegramUserId} LIMIT 1
    `;
    const identity = identities[0] || null;
    if (!identity || isStart) {
      const entry = await this.communications.createTelegramEntry(connection.tenantId, { telegramUserId, username });
      const clientAppUrl = text(process.env.CLIENT_APP_URL).replace(/\/$/, '');
      if (clientAppUrl) {
        const url = new URL(clientAppUrl); url.searchParams.set('booking', connection.tenantId); url.searchParams.set('tg_entry', entry.token);
        const launchButton = message.chat.type === 'private'
          ? { text: 'Открыть Book', web_app: { url: url.toString() } }
          : { text: 'Открыть Book', url: url.toString() };
        await this.telegramApi(this.decryptToken(connection), 'sendMessage', { chat_id: message.chat.id, text: 'Откройте Book, чтобы продолжить.', reply_markup: { inline_keyboard: [[launchButton]] } });
      }
      if (!identity) return { ok: true, linked: false };
    }
    if (messageBody && !isStart) {
      await this.communications.recordMessage(connection.tenantId, { phone: identity.cardPhone, uei: identity.uei, direction: 'inbound', kind: 'message', channel: 'TELEGRAM', body: messageBody, externalMessageId: String(message.message_id || ''), externalThreadId: String(message.chat.id), status: 'delivered' });
    }
    return { ok: true, linked: true };
  }
}

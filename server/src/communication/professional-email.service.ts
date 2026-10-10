import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolveMx } from 'node:dns/promises';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma.service';

type ProfessionalEmailRow = {
  id: string;
  tenantId: string;
  platformAccountId: string;
  email: string;
  provider: string;
  deviceId: string;
  encryptedAccessToken: string;
  accessTokenIv: string;
  accessTokenTag: string;
  encryptedRefreshToken: string;
  refreshTokenIv: string;
  refreshTokenTag: string;
  expiresAt: Date | null;
  scope: string;
  status: string;
  connectedAt: Date;
  updatedAt: Date;
};

type OAuthStateRow = {
  id: string;
  tenantId: string;
  platformAccountId: string;
  email: string;
  provider: string;
  deviceId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type SecretBox = { encrypted: string; iv: string; tag: string };

function text(value: unknown) { return String(value ?? '').trim(); }
function canonicalEmail(value: unknown) {
  const email = text(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}
function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error || ''); }

const YANDEX_DOMAINS = new Set(['yandex.ru', 'ya.ru', 'yandex.com', 'yandex.kz', 'yandex.by']);
const MAIL_DOMAINS = new Set(['mail.ru', 'inbox.ru', 'bk.ru', 'list.ru', 'internet.ru']);
const GOOGLE_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

@Injectable()
export class ProfessionalEmailService {
  private readonly logger = new Logger(ProfessionalEmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  private configurationReady() {
    return text(process.env.PROFESSIONAL_EMAIL_OAUTH_ENABLED).toLowerCase() === 'true'
      && Boolean(text(process.env.PROFESSIONAL_EMAIL_CREDENTIALS_KEY))
      && Boolean(text(process.env.YANDEX_MAIL_OAUTH_CLIENT_ID))
      && Boolean(text(process.env.YANDEX_MAIL_OAUTH_CLIENT_SECRET))
      && /^https:\/\//i.test(text(process.env.PUBLIC_API_URL));
  }

  private oauthClient() {
    if (!this.configurationReady()) throw new ServiceUnavailableException('Подключение почты временно недоступно');
    return {
      clientId: text(process.env.YANDEX_MAIL_OAUTH_CLIENT_ID),
      clientSecret: text(process.env.YANDEX_MAIL_OAUTH_CLIENT_SECRET),
    };
  }

  private encryptionKey() {
    const secret = text(process.env.PROFESSIONAL_EMAIL_CREDENTIALS_KEY);
    if (!secret) throw new ServiceUnavailableException('Подключение почты временно недоступно');
    return createHash('sha256').update(secret).digest();
  }

  private encrypt(value: string): SecretBox {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return {
      encrypted: encrypted.toString('base64url'),
      iv: iv.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
    };
  }

  private decrypt(encrypted: string, iv: string, tag: string) {
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private async rowForTenant(tenantId: string) {
    const rows = await this.prisma.$queryRaw<ProfessionalEmailRow[]>`
      SELECT "id", "tenantId", "platformAccountId", "email", "provider", "deviceId",
             "encryptedAccessToken", "accessTokenIv", "accessTokenTag",
             "encryptedRefreshToken", "refreshTokenIv", "refreshTokenTag",
             "expiresAt", "scope", "status", "connectedAt", "updatedAt"
      FROM "ProfessionalEmailConnection"
      WHERE "tenantId" = ${tenantId}
      LIMIT 1
    `;
    return rows[0] || null;
  }

  private async accountEmail(platformAccountId: string) {
    const account = await this.prisma.platformAccount.findUnique({
      where: { id: platformAccountId },
      select: { email: true },
    });
    return canonicalEmail(account?.email);
  }

  async connectionStatus(tenantId: string, platformAccountId: string) {
    const row = await this.rowForTenant(tenantId);
    const suggestedEmail = await this.accountEmail(platformAccountId);
    if (!row) {
      return { connected: false, email: '', suggestedEmail, provider: '', connectionAvailable: true };
    }
    return {
      connected: true,
      email: row.email,
      suggestedEmail,
      provider: row.provider,
      connectionAvailable: row.status === 'active' && this.configurationReady(),
      connectedAt: row.connectedAt,
    };
  }

  async isConnected(tenantId: string) {
    const row = await this.rowForTenant(tenantId);
    return Boolean(row && row.status === 'active' && this.configurationReady());
  }

  private async providerForEmail(email: string) {
    const domain = email.split('@')[1] || '';
    if (YANDEX_DOMAINS.has(domain)) return 'yandex';
    if (MAIL_DOMAINS.has(domain)) return 'mail';
    if (GOOGLE_DOMAINS.has(domain)) return 'google';
    try {
      const records = await resolveMx(domain);
      const exchanges = records.map((item) => text(item.exchange).toLowerCase().replace(/\.$/, ''));
      if (exchanges.some((value) => /(^|\.)yandex\.(net|ru)$/.test(value))) return 'yandex';
      if (exchanges.some((value) => /(^|\.)mail\.ru$/.test(value))) return 'mail';
      if (exchanges.some((value) => /(^|\.)google\.com$/.test(value) || /(^|\.)googlemail\.com$/.test(value))) return 'google';
    } catch {}
    return 'unsupported';
  }

  private callbackUrl() {
    return `${text(process.env.PUBLIC_API_URL).replace(/\/$/, '')}/communications/integrations/email/oauth/yandex/callback`;
  }

  async beginConnection(tenantId: string, platformAccountId: string, rawEmail: unknown) {
    const email = canonicalEmail(rawEmail);
    if (!email) throw new BadRequestException('Укажите корректную рабочую почту');
    if (await this.rowForTenant(tenantId)) throw new ConflictException('Почта уже подключена. Сначала отключите её.');

    const provider = await this.providerForEmail(email);
    if (provider !== 'yandex') throw new BadRequestException('Эту почту пока нельзя подключить автоматически');
    const { clientId } = this.oauthClient();

    await this.prisma.$executeRaw`
      DELETE FROM "ProfessionalEmailOAuthState"
      WHERE "tenantId" = ${tenantId}
    `;

    const state = randomBytes(32).toString('base64url');
    const deviceId = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.$executeRaw`
      INSERT INTO "ProfessionalEmailOAuthState" (
        "id", "tenantId", "platformAccountId", "email", "provider", "deviceId", "stateHash", "expiresAt", "createdAt"
      ) VALUES (
        ${randomUUID()}, ${tenantId}, ${platformAccountId}, ${email}, 'yandex', ${deviceId}, ${sha256(state)}, ${expiresAt}, CURRENT_TIMESTAMP
      )
    `;

    const url = new URL('https://oauth.yandex.ru/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', this.callbackUrl());
    url.searchParams.set('login_hint', email);
    url.searchParams.set('scope', 'mail:smtp');
    url.searchParams.set('force_confirm', 'yes');
    url.searchParams.set('state', state);
    url.searchParams.set('device_id', deviceId);
    url.searchParams.set('device_name', 'VA Tools Email');
    return { authorizationUrl: url.toString() };
  }

  private async consumeState(rawState: unknown) {
    const state = text(rawState);
    if (!state) throw new BadRequestException('Подключение почты не подтверждено');
    const rows = await this.prisma.$queryRaw<OAuthStateRow[]>`
      SELECT "id", "tenantId", "platformAccountId", "email", "provider", "deviceId", "expiresAt", "usedAt"
      FROM "ProfessionalEmailOAuthState"
      WHERE "stateHash" = ${sha256(state)}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Подключение почты истекло. Запустите его заново.');
    }
    const used = await this.prisma.$executeRaw`
      UPDATE "ProfessionalEmailOAuthState"
      SET "usedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${row.id} AND "usedAt" IS NULL AND "expiresAt" > CURRENT_TIMESTAMP
    `;
    if (!used) throw new BadRequestException('Подключение почты уже использовано');
    return row;
  }

  private async tokenRequest(params: URLSearchParams) {
    const response = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const payload = await response.json().catch(() => ({})) as TokenPayload;
    if (!response.ok || !text(payload.access_token)) {
      throw new ServiceUnavailableException('Не удалось подтвердить подключение почты');
    }
    return payload;
  }

  private async exchangeCode(code: string, deviceId: string) {
    const { clientId, clientSecret } = this.oauthClient();
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      device_id: deviceId,
    });
    return this.tokenRequest(params);
  }

  private yandexTransport(email: string, accessToken: string) {
    return nodemailer.createTransport({
      host: 'smtp.yandex.com',
      port: 465,
      secure: true,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
      auth: { type: 'OAuth2', user: email, accessToken },
    });
  }

  async completeYandexConnection(rawState: unknown, rawCode: unknown, rawError: unknown) {
    const state = await this.consumeState(rawState);
    if (text(rawError)) throw new BadRequestException('Подключение почты отменено');
    const code = text(rawCode);
    if (!code) throw new BadRequestException('Подключение почты не подтверждено');
    if (state.provider !== 'yandex') throw new BadRequestException('Неверный почтовый сервис');

    const token = await this.exchangeCode(code, state.deviceId);
    const scope = text(token.scope) || 'mail:smtp';
    if (!scope.split(/\s+/).includes('mail:smtp')) {
      throw new ServiceUnavailableException('Не удалось получить разрешение на отправку писем');
    }
    const accessToken = text(token.access_token);
    await this.yandexTransport(state.email, accessToken).verify();

    const access = this.encrypt(accessToken);
    const refreshValue = text(token.refresh_token);
    const refresh = refreshValue ? this.encrypt(refreshValue) : { encrypted: '', iv: '', tag: '' };
    const expiresIn = Math.max(0, Number(token.expires_in || 0));
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    await this.prisma.$executeRaw`
      INSERT INTO "ProfessionalEmailConnection" (
        "id", "tenantId", "platformAccountId", "email", "provider", "deviceId",
        "encryptedAccessToken", "accessTokenIv", "accessTokenTag",
        "encryptedRefreshToken", "refreshTokenIv", "refreshTokenTag",
        "expiresAt", "scope", "status", "connectedAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${state.tenantId}, ${state.platformAccountId}, ${state.email}, 'yandex', ${state.deviceId},
        ${access.encrypted}, ${access.iv}, ${access.tag},
        ${refresh.encrypted}, ${refresh.iv}, ${refresh.tag},
        ${expiresAt}, ${scope}, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("tenantId") DO UPDATE SET
        "platformAccountId" = EXCLUDED."platformAccountId",
        "email" = EXCLUDED."email",
        "provider" = EXCLUDED."provider",
        "deviceId" = EXCLUDED."deviceId",
        "encryptedAccessToken" = EXCLUDED."encryptedAccessToken",
        "accessTokenIv" = EXCLUDED."accessTokenIv",
        "accessTokenTag" = EXCLUDED."accessTokenTag",
        "encryptedRefreshToken" = EXCLUDED."encryptedRefreshToken",
        "refreshTokenIv" = EXCLUDED."refreshTokenIv",
        "refreshTokenTag" = EXCLUDED."refreshTokenTag",
        "expiresAt" = EXCLUDED."expiresAt",
        "scope" = EXCLUDED."scope",
        "status" = 'active',
        "connectedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    `;
    return { connected: true, email: state.email };
  }

  private decryptRefreshToken(row: ProfessionalEmailRow) {
    if (!row.encryptedRefreshToken || !row.refreshTokenIv || !row.refreshTokenTag) return '';
    return this.decrypt(row.encryptedRefreshToken, row.refreshTokenIv, row.refreshTokenTag);
  }

  private async refreshAccessToken(row: ProfessionalEmailRow) {
    const refreshToken = this.decryptRefreshToken(row);
    if (!refreshToken) throw new ServiceUnavailableException('Почту нужно подключить заново');
    const { clientId, clientSecret } = this.oauthClient();
    const token = await this.tokenRequest(new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }));
    const accessValue = text(token.access_token);
    const refreshValue = text(token.refresh_token) || refreshToken;
    const access = this.encrypt(accessValue);
    const refresh = this.encrypt(refreshValue);
    const expiresIn = Math.max(0, Number(token.expires_in || 0));
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
    const scope = text(token.scope) || row.scope || 'mail:smtp';
    await this.prisma.$executeRaw`
      UPDATE "ProfessionalEmailConnection"
      SET "encryptedAccessToken" = ${access.encrypted}, "accessTokenIv" = ${access.iv}, "accessTokenTag" = ${access.tag},
          "encryptedRefreshToken" = ${refresh.encrypted}, "refreshTokenIv" = ${refresh.iv}, "refreshTokenTag" = ${refresh.tag},
          "expiresAt" = ${expiresAt}, "scope" = ${scope}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${row.id}
    `;
    return accessValue;
  }

  private async accessToken(row: ProfessionalEmailRow) {
    if (!row.expiresAt || row.expiresAt.getTime() > Date.now() + 2 * 60 * 1000) {
      return this.decrypt(row.encryptedAccessToken, row.accessTokenIv, row.accessTokenTag);
    }
    return this.refreshAccessToken(row);
  }

  async send(tenantId: string, input: { to: string; subject: string; html: string; text?: string; tag?: string }) {
    const row = await this.rowForTenant(tenantId);
    if (!row || row.status !== 'active') throw new ServiceUnavailableException('Рабочая почта не подключена');
    if (!this.configurationReady()) throw new ServiceUnavailableException('Связь с рабочей почтой временно недоступна');
    const to = canonicalEmail(input.to);
    if (!to) throw new BadRequestException('Некорректный Email получателя');

    try {
      const accessToken = await this.accessToken(row);
      const result = await this.yandexTransport(row.email, accessToken).sendMail({
        from: row.email,
        replyTo: row.email,
        to,
        subject: text(input.subject) || 'Уведомление',
        html: input.html,
        text: input.text,
        headers: input.tag ? { 'X-Message-Tag': input.tag } : undefined,
      });
      if (!result.messageId) throw new Error('Почтовый сервис не вернул идентификатор письма');
      return { provider: row.provider, messageId: result.messageId, fromEmail: row.email };
    } catch (error) {
      this.logger.error(`Professional email send failed for tenant ${tenantId}: ${errorMessage(error)}`);
      throw new ServiceUnavailableException('Не удалось отправить письмо через рабочую почту');
    }
  }

  async disconnect(tenantId: string, platformAccountId: string) {
    const row = await this.rowForTenant(tenantId);
    if (row && row.provider === 'yandex' && this.configurationReady()) {
      try {
        const { clientId, clientSecret } = this.oauthClient();
        const accessToken = this.decrypt(row.encryptedAccessToken, row.accessTokenIv, row.accessTokenTag);
        await fetch('https://oauth.yandex.ru/revoke_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ access_token: accessToken, client_id: clientId, client_secret: clientSecret }).toString(),
        });
      } catch (error) {
        this.logger.warn(`Professional email token revoke failed for tenant ${tenantId}: ${errorMessage(error)}`);
      }
    }
    await this.prisma.$executeRaw`DELETE FROM "ProfessionalEmailOAuthState" WHERE "tenantId" = ${tenantId}`;
    await this.prisma.$executeRaw`DELETE FROM "ProfessionalEmailConnection" WHERE "tenantId" = ${tenantId}`;
    return this.connectionStatus(tenantId, platformAccountId);
  }
}

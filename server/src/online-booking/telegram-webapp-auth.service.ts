import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createDecipheriv, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma.service';

type TelegramBotConnectionRow = {
  tenantId: string;
  botUsername: string;
  encryptedToken: string;
  tokenIv: string;
  tokenTag: string;
  status: string;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function normalizedBotUsername(value: unknown) {
  const clean = text(value).replace(/^@+/, '');
  return clean ? `@${clean}` : '';
}

@Injectable()
export class TelegramWebAppAuthService {
  constructor(private readonly prisma: PrismaService) {}

  private encryptionKey() {
    const secret = text(process.env.TELEGRAM_CREDENTIALS_KEY);
    if (!secret) throw new ServiceUnavailableException('Не настроен ключ шифрования Telegram');
    return createHash('sha256').update(secret).digest();
  }

  private decryptToken(row: TelegramBotConnectionRow) {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(row.tokenIv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(row.tokenTag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(row.encryptedToken, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private async connection(rawBotUsername: unknown) {
    const botUsername = normalizedBotUsername(rawBotUsername);
    if (!/^@[A-Za-z0-9_]{5,}$/.test(botUsername)) {
      throw new BadRequestException('Некорректный Telegram-бот');
    }
    const rows = await this.prisma.$queryRaw<TelegramBotConnectionRow[]>`
      SELECT "tenantId", "botUsername", "encryptedToken", "tokenIv", "tokenTag", "status"
      FROM "TelegramBotConnection"
      WHERE LOWER("botUsername") = LOWER(${botUsername}) AND "status" IN ('connected', 'active')
      LIMIT 1
    `;
    const row = rows[0] || null;
    if (!row) throw new NotFoundException('Telegram-бот не подключён к Book');
    return row;
  }

  async verify(rawBotUsername: unknown, rawInitData: unknown) {
    const row = await this.connection(rawBotUsername);
    const initData = text(rawInitData);
    if (!initData || initData.length > 32768) {
      throw new BadRequestException('Некорректные данные Telegram Mini App');
    }

    const params = new URLSearchParams(initData);
    const receivedHash = text(params.get('hash')).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(receivedHash)) {
      throw new BadRequestException('Telegram Mini App не подтверждён');
    }

    const authDate = Number(params.get('auth_date'));
    if (!Number.isInteger(authDate) || authDate <= 0) {
      throw new BadRequestException('Некорректная дата Telegram Mini App');
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (authDate > nowSeconds + 120 || nowSeconds - authDate > 15 * 60) {
      throw new BadRequestException('Telegram Mini App нужно открыть заново');
    }

    const dataCheckString = [...params.entries()]
      .filter(([key]) => key !== 'hash')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const botToken = this.decryptToken(row);
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    const actual = Buffer.from(receivedHash, 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new BadRequestException('Telegram Mini App не подтверждён');
    }

    let user: Record<string, any> = {};
    try {
      user = JSON.parse(String(params.get('user') || '{}')) as Record<string, any>;
    } catch {
      throw new BadRequestException('Некорректный пользователь Telegram');
    }
    const telegramUserId = text(user.id);
    if (!/^\d+$/.test(telegramUserId)) {
      throw new BadRequestException('Telegram-пользователь не определён');
    }

    return {
      tenantId: row.tenantId,
      botUsername: normalizedBotUsername(row.botUsername),
      telegramUserId,
      username: text(user.username),
      user: {
        id: telegramUserId,
        firstName: text(user.first_name),
        lastName: text(user.last_name),
        username: text(user.username),
      },
    };
  }
}

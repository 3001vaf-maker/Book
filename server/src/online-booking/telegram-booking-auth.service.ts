import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { CommunicationService } from '../communication/communication.service';
import { PrismaService } from '../prisma.service';
import { OnlineBookingService } from './online-booking.service';
import { TelegramWebAppAuthService } from './telegram-webapp-auth.service';

type TelegramEntryRow = {
  id: string;
  telegramUserId: string;
  username: string;
  expiresAt: Date;
  usedAt: Date | null;
};

type TelegramIdentityRow = {
  bookingAccountId: string | null;
  cardPhone: string;
  uei: string;
  verifiedAt: Date | null;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

function tokenHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class TelegramBookingAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly communications: CommunicationService,
    private readonly booking: OnlineBookingService,
    private readonly webAppAuth: TelegramWebAppAuthService,
  ) {}

  private async ticket(tenantId: string, rawToken: unknown) {
    const token = text(rawToken);
    if (!token) throw new BadRequestException('Не указан Telegram-вход');
    const hash = tokenHash(token);
    const rows = await this.prisma.$queryRaw<TelegramEntryRow[]>`
      SELECT "id", "telegramUserId", "username", "expiresAt", "usedAt"
      FROM "TelegramEntryTicket"
      WHERE "tenantId" = ${tenantId} AND "tokenHash" = ${hash}
      LIMIT 1
    `;
    const ticket = rows[0];
    if (!ticket) throw new NotFoundException('Telegram-вход не найден');
    if (ticket.usedAt) throw new ConflictException('Telegram-вход уже использован');
    if (ticket.expiresAt.getTime() <= Date.now()) throw new ConflictException('Telegram-вход истёк');
    return { ...ticket, token };
  }

  private async linkedAccountId(tenantId: string, telegramUserId: string) {
    const rows = await this.prisma.$queryRaw<TelegramIdentityRow[]>`
      SELECT "bookingAccountId", "cardPhone", "uei", "verifiedAt"
      FROM "CommunicationIdentity"
      WHERE "tenantId" = ${tenantId} AND "channel" = 'TELEGRAM' AND "externalUserId" = ${telegramUserId}
      LIMIT 1
    `;
    const identity = rows[0] || null;
    if (!identity) return '';

    const directAccountId = text(identity.bookingAccountId);
    if (directAccountId) {
      const direct = await this.prisma.bookingAccount.findFirst({
        where: { id: directAccountId, tenantId },
        select: { id: true },
      });
      if (direct) return direct.id;
    }

    if (!identity.verifiedAt) return '';
    const phone = canonicalPhone(identity.cardPhone);
    const uei = text(identity.uei);
    if (!phone && !uei) return '';

    const accounts = await this.prisma.bookingAccount.findMany({
      where: { tenantId },
      select: { id: true, phone: true, uei: true },
    });
    const matches = accounts.filter((account) => (
      (phone && canonicalPhone(account.phone) === phone)
      || (uei && text(account.uei) === uei)
    ));
    return matches.length === 1 ? matches[0].id : '';
  }

  private async session(tenantId: string, accountId: string) {
    const account = await this.booking.getAccount(tenantId, accountId);
    const accessToken = await this.jwt.signAsync({
      sub: accountId,
      tenantId,
      kind: 'booking-account',
    }, { expiresIn: '30d' });
    return { state: 'authenticated', authMethod: 'telegram', accessToken, account };
  }

  async createMainAppEntry(rawBotUsername: unknown, rawInitData: unknown) {
    const verified = await this.webAppAuth.verify(rawBotUsername, rawInitData);
    const entry = await this.communications.createTelegramEntry(verified.tenantId, {
      telegramUserId: verified.telegramUserId,
      username: verified.username,
    });
    return {
      tenantId: verified.tenantId,
      token: entry.token,
      expiresAt: entry.expiresAt,
      telegram: verified.user,
    };
  }

  async exchange(tenantId: string, rawToken: unknown) {
    const ticket = await this.ticket(tenantId, rawToken);
    const accountId = await this.linkedAccountId(tenantId, ticket.telegramUserId);
    if (!accountId) {
      return {
        state: 'registration',
        authMethod: 'telegram',
        telegram: { username: text(ticket.username) },
      };
    }

    await this.communications.bindTelegramEntry(tenantId, accountId, ticket.token);
    await this.prisma.bookingAccount.update({
      where: { id: accountId },
      data: { telegramId: ticket.telegramUserId },
    });
    return this.session(tenantId, accountId);
  }

  async register(tenantId: string, rawToken: unknown, body: Record<string, any>) {
    const ticket = await this.ticket(tenantId, rawToken);
    const alreadyLinked = await this.linkedAccountId(tenantId, ticket.telegramUserId);
    if (alreadyLinked) {
      await this.communications.bindTelegramEntry(tenantId, alreadyLinked, ticket.token);
      await this.prisma.bookingAccount.update({
        where: { id: alreadyLinked },
        data: { telegramId: ticket.telegramUserId },
      });
      return this.session(tenantId, alreadyLinked);
    }

    // Telegram is the verified login method. This private high-entropy value only satisfies
    // the legacy non-null password column and is never shown to or requested from the client.
    const internalCredential = randomBytes(48).toString('base64url');
    const created = await this.booking.registerAccount(tenantId, {
      ...body,
      password: internalCredential,
      telegramId: ticket.telegramUserId,
    });

    await this.communications.bindTelegramEntry(tenantId, created.account.id, ticket.token);
    await this.prisma.bookingAccount.update({
      where: { id: created.account.id },
      data: { telegramId: ticket.telegramUserId },
    });

    return {
      ...created,
      state: 'authenticated',
      authMethod: 'telegram',
      account: await this.booking.getAccount(tenantId, created.account.id),
    };
  }
}

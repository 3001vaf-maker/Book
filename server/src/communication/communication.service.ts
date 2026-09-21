import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AccountContactType } from '@prisma/client';
import { BusinessStateService } from '../business-state/business-state.service';
import { PrismaService } from '../prisma.service';
import { normalizeMessagePurpose, type MessagePurpose } from './message-purpose';

type TelegramEntryRow = {
  id: string;
  tenantId: string;
  telegramUserId: string;
  username: string;
  expiresAt: Date;
  usedAt: Date | null;
};

type TelegramIdentityRow = {
  id: string;
  personPhone: string;
  uei: string;
  externalUserId: string;
  display: string;
};

type CommunicationMessageRow = {
  id: string;
  tenantId: string;
  personPhone: string;
  uei: string;
  direction: string;
  kind: string;
  purpose: MessagePurpose | null;
  channel: string;
  body: string;
  attachments: unknown;
  externalMessageId: string;
  externalThreadId: string;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  error: string;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

function canonicalEmail(value: unknown) {
  const email = text(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function personHasPhone(person: Record<string, any>, phone: string) {
  const phones = Array.isArray(person.phones) ? person.phones : [];
  return phones.some((value) => canonicalPhone(value) === phone);
}

function telegramUsername(value: unknown) {
  const clean = text(value).replace(/^@+/, '');
  return clean ? `@${clean}` : '';
}

function tokenHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeAttachments(value: unknown) {
  const source = Array.isArray(value) ? value.slice(0, 3) : [];
  let totalEncoded = 0;
  return source.map((raw) => {
    const item = objectValue(raw);
    const type = text(item.type).toLowerCase();
    const name = text(item.name).slice(0, 200) || 'Медиа';
    const dataUrl = text(item.dataUrl);
    const size = Math.max(0, Number(item.size || 0));
    if (!/^(image|video)\//.test(type)) throw new BadRequestException('Поддерживаются только фото и видео');
    if (!dataUrl.startsWith(`data:${type};base64,`)) throw new BadRequestException('Некорректный медиафайл');
    if (size > 8 * 1024 * 1024) throw new BadRequestException('Один файл должен быть не больше 8 МБ');
    if (dataUrl.length > 12 * 1024 * 1024) throw new BadRequestException('Медиафайл слишком большой');
    totalEncoded += dataUrl.length;
    if (totalEncoded > 24 * 1024 * 1024) throw new BadRequestException('Слишком большой общий объём вложений');
    return { name, type, size, dataUrl };
  });
}

@Injectable()
export class CommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessState: BusinessStateService,
  ) {}

  async createTelegramEntry(tenantId: string, input: { telegramUserId?: unknown; username?: unknown }) {
    const telegramUserId = text(input?.telegramUserId);
    if (!/^\d+$/.test(telegramUserId)) throw new BadRequestException('Некорректный Telegram ID');
    const username = telegramUsername(input?.username);
    const token = randomBytes(32).toString('base64url');
    const hash = tokenHash(token);
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.$executeRaw`
      INSERT INTO "TelegramEntryTicket" ("id", "tenantId", "tokenHash", "telegramUserId", "username", "createdAt", "expiresAt")
      VALUES (${id}, ${tenantId}, ${hash}, ${telegramUserId}, ${username}, CURRENT_TIMESTAMP, ${expiresAt})
    `;
    return { token, expiresAt, username };
  }

  private async telegramEntry(tenantId: string, entryToken: unknown) {
    const token = text(entryToken);
    if (!token) throw new BadRequestException('Не указан Telegram-вход');
    const hash = tokenHash(token);
    const rows = await this.prisma.$queryRaw<TelegramEntryRow[]>`
      SELECT "id", "tenantId", "telegramUserId", "username", "expiresAt", "usedAt"
      FROM "TelegramEntryTicket"
      WHERE "tenantId" = ${tenantId} AND "tokenHash" = ${hash}
      LIMIT 1
    `;
    const ticket = rows[0];
    if (!ticket) throw new NotFoundException('Telegram-вход не найден');
    if (ticket.usedAt) throw new ConflictException('Telegram-вход уже использован');
    if (ticket.expiresAt.getTime() <= Date.now()) throw new ConflictException('Telegram-вход истёк');
    return ticket;
  }

  async resolveTelegramEntryAccount(tenantId: string, entryToken: unknown) {
    const ticket = await this.telegramEntry(tenantId, entryToken);
    const [contact, quarantined] = await Promise.all([
      this.prisma.accountContact.findUnique({
        where: { type_value: { type: AccountContactType.TELEGRAM, value: ticket.telegramUserId } },
        select: { accountId: true },
      }),
      this.prisma.accountContactConflict.findUnique({
        where: { type_value: { type: AccountContactType.TELEGRAM, value: ticket.telegramUserId } },
        select: { id: true },
      }),
    ]);
    if (quarantined) {
      throw new ConflictException('Этот Telegram связан с несколькими ранее созданными учетными записями');
    }
    return contact
      ? { exists: true, accountId: contact.accountId }
      : { exists: false, accountId: '' };
  }

  async bindTelegramEntry(tenantId: string, accountId: string, entryToken: unknown) {
    const ticket = await this.telegramEntry(tenantId, entryToken);
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, select: { phone: true, telegramId: true } });
    if (!account) throw new NotFoundException('Аккаунт не найден');

    const [globalTelegram, quarantinedTelegram] = await Promise.all([
      this.prisma.accountContact.findUnique({
        where: { type_value: { type: AccountContactType.TELEGRAM, value: ticket.telegramUserId } },
        select: { accountId: true },
      }),
      this.prisma.accountContactConflict.findUnique({
        where: { type_value: { type: AccountContactType.TELEGRAM, value: ticket.telegramUserId } },
        select: { id: true },
      }),
    ]);
    if (quarantinedTelegram) {
      throw new ConflictException('Этот Telegram связан с несколькими ранее созданными учетными записями');
    }
    if (globalTelegram && globalTelegram.accountId !== accountId) {
      throw new ConflictException('Этот Telegram уже зарегистрирован в другом аккаунте');
    }
    const personPhone = canonicalPhone(account.phone);
    if (!personPhone) throw new BadRequestException('У человека не определён телефон');

    const telegramRows = await this.prisma.$queryRaw<TelegramIdentityRow[]>`
      SELECT "id", "personPhone", "uei", "externalUserId", "display"
      FROM "CommunicationIdentity"
      WHERE "tenantId" = ${tenantId} AND "channel" = 'TELEGRAM' AND "externalUserId" = ${ticket.telegramUserId}
      LIMIT 1
    `;
    const existingTelegram = telegramRows[0] || null;
    const samePhone = Boolean(existingTelegram && canonicalPhone(existingTelegram.personPhone) === personPhone);

    const business = await this.businessState.get(tenantId);
    const phoneMatch = (Array.isArray(business.people) ? business.people : [])
      .map((value) => objectValue(value)).find((person) => personHasPhone(person, personPhone)) || null;
    const match = samePhone ? 'phone+telegram' : phoneMatch ? 'phone' : 'new';

    const identity = await this.businessState.bookingIdentityForAccount(tenantId, accountId);
    const personKey = text(identity?.person?.key || identity?.matchedPerson?.key);
    if (!personKey) throw new NotFoundException('Человекская карта не найдена');
    const uei = text(identity?.uei);
    const display = telegramUsername(ticket.username);

    if (existingTelegram) {
      if (!samePhone) throw new ConflictException('Этот Telegram уже связан с другой Person');
      if (existingTelegram.uei && uei && existingTelegram.uei !== uei) {
        throw new ConflictException('Этот Telegram уже связан с другим UEI');
      }
    }
    const resolvedUei = uei || text(existingTelegram?.uei);

    await this.prisma.$transaction(async (tx) => {
      const used = await tx.$executeRaw`
        UPDATE "TelegramEntryTicket"
        SET "usedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${ticket.id}
          AND "usedAt" IS NULL
          AND "expiresAt" > CURRENT_TIMESTAMP
      `;
      if (!used) throw new ConflictException('Telegram-вход уже использован или истёк');

      await tx.accountContact.upsert({
        where: { type_value: { type: AccountContactType.TELEGRAM, value: ticket.telegramUserId } },
        create: {
          accountId,
          type: AccountContactType.TELEGRAM,
          value: ticket.telegramUserId,
          isPrimary: !text(account.telegramId),
        },
        update: {},
      });
      if (!text(account.telegramId)) {
        await tx.account.update({
          where: { id: accountId },
          data: { telegramId: ticket.telegramUserId },
        });
      }

      await tx.$executeRaw`
        INSERT INTO "CommunicationIdentity" (
          "id", "tenantId", "personPhone", "uei", "channel", "externalUserId", "display", "verifiedAt", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${tenantId}, ${personPhone}, ${resolvedUei}, 'TELEGRAM', ${ticket.telegramUserId}, ${display}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("tenantId", "channel", "externalUserId") DO UPDATE
        SET "display" = EXCLUDED."display",
            "verifiedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
      `;
    });

    return { linked: true, channel: 'TELEGRAM', username: display, match };
  }

  async emailIdentity(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const personPhone = canonicalPhone(input?.phone);
    const requestedUei = text(input?.uei);
    if (!personPhone && !requestedUei) throw new BadRequestException('Не указан человек');

    const business = await this.businessState.get(tenantId);
    const relations = objectValue(objectValue(business.uei).relations);
    const people = (Array.isArray(business.people) ? business.people : []).map((value) => objectValue(value));
    const matches = people.filter((person) => {
      const personKey = text(person.key);
      const linkedUei = text(relations[`person:${personKey}`] || person.uei);
      return (personPhone && personHasPhone(person, personPhone)) || (requestedUei && linkedUei === requestedUei);
    });

    for (const person of matches) {
      const email = (Array.isArray(person.emails) ? person.emails : []).map(canonicalEmail).find(Boolean) || '';
      if (!email) continue;
      const resolvedPhone = (Array.isArray(person.phones) ? person.phones : []).map(canonicalPhone).find(Boolean) || personPhone;
      const personKey = text(person.key);
      const resolvedUei = text(relations[`person:${personKey}`] || person.uei || requestedUei);
      return {
        id: `email:${personKey || resolvedPhone || resolvedUei}`,
        personPhone: resolvedPhone,
        uei: resolvedUei,
        externalUserId: email,
        display: email,
      };
    }
    return null;
  }

  async telegramIdentity(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const personPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    if (!personPhone && !uei) throw new BadRequestException('Не указан человек');
    const rows = await this.prisma.$queryRaw<TelegramIdentityRow[]>`
      SELECT "id", "personPhone", "uei", "externalUserId", "display"
      FROM "CommunicationIdentity"
      WHERE "tenantId" = ${tenantId} AND "channel" = 'TELEGRAM'
        AND ((${personPhone} <> '' AND "personPhone" = ${personPhone}) OR (${uei} <> '' AND "uei" = ${uei}))
      ORDER BY "verifiedAt" DESC NULLS LAST, "updatedAt" DESC LIMIT 1
    `;
    return rows[0] || null;
  }

  async recordMessage(tenantId: string, input: {
    phone?: unknown; uei?: unknown; direction?: unknown; kind?: unknown; purpose?: unknown; channel?: unknown; body?: unknown; attachments?: unknown;
    externalMessageId?: unknown; externalThreadId?: unknown; status?: unknown; error?: unknown;
  }) {
    const personPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    const direction = text(input?.direction).toLowerCase() || 'system';
    const kind = text(input?.kind).toLowerCase() || 'message';
    const purpose = normalizeMessagePurpose(input?.purpose);
    if (!purpose) throw new BadRequestException('Не указан purpose сообщения');
    const channel = text(input?.channel).toUpperCase() || 'IN_APP';
    const body = text(input?.body);
    const attachments = normalizeAttachments(input?.attachments);
    const attachmentsJson = JSON.stringify(attachments);
    const status = text(input?.status).toLowerCase() || 'created';
    const externalMessageId = text(input?.externalMessageId);
    const externalThreadId = text(input?.externalThreadId);
    const error = text(input?.error).slice(0, 2000);
    if (!personPhone && !uei) throw new BadRequestException('Не указан человек');
    if (!body && !attachments.length) throw new BadRequestException('Пустое сообщение');
    const id = randomUUID();
    const now = new Date();
    await this.prisma.$executeRaw`
      INSERT INTO "CommunicationMessage" (
        "id", "tenantId", "personPhone", "uei", "direction", "kind", "purpose", "channel", "body", "attachments",
        "externalMessageId", "externalThreadId", "status", "createdAt", "sentAt", "deliveredAt", "failedAt", "error"
      ) VALUES (
        ${id}, ${tenantId}, ${personPhone}, ${uei}, ${direction}, ${kind}, ${purpose}, ${channel}, ${body}, ${attachmentsJson}::jsonb,
        ${externalMessageId}, ${externalThreadId}, ${status}, ${now},
        ${status === 'sent' ? now : null}, ${status === 'delivered' ? now : null}, ${status === 'failed' ? now : null}, ${error}
      ) ON CONFLICT DO NOTHING
    `;
    return { id, tenantId, personPhone, uei, direction, kind, purpose, channel, body, attachments, externalMessageId, externalThreadId, status, createdAt: now, error };
  }

  async listThread(tenantId: string, input: { phone?: unknown; uei?: unknown }, limit = 300) {
    const personPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    if (!personPhone && !uei) throw new BadRequestException('Не указан человек');
    const safeLimit = Math.max(1, Math.min(1000, Math.floor(Number(limit) || 300)));
    return this.prisma.$queryRaw<CommunicationMessageRow[]>`
      SELECT "id", "tenantId", "personPhone", "uei", "direction", "kind", "purpose", "channel", "body", "attachments",
             "externalMessageId", "externalThreadId", "status", "createdAt", "sentAt", "deliveredAt", "readAt", "failedAt", "error"
      FROM "CommunicationMessage"
      WHERE "tenantId" = ${tenantId}
        AND ((${personPhone} <> '' AND "personPhone" = ${personPhone}) OR (${uei} <> '' AND "uei" = ${uei}))
      ORDER BY "createdAt" ASC, "id" ASC LIMIT ${safeLimit}
    `;
  }

  async listThreads(tenantId: string, limit = 200) {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 200)));
    return this.prisma.$queryRaw<CommunicationMessageRow[]>`
      SELECT DISTINCT ON (COALESCE(NULLIF("uei", ''), "personPhone"))
             "id", "tenantId", "personPhone", "uei", "direction", "kind", "purpose", "channel", "body", "attachments",
             "externalMessageId", "externalThreadId", "status", "createdAt", "sentAt", "deliveredAt", "readAt", "failedAt", "error"
      FROM "CommunicationMessage"
      WHERE "tenantId" = ${tenantId}
      ORDER BY COALESCE(NULLIF("uei", ''), "personPhone"), "createdAt" DESC, "id" DESC
      LIMIT ${safeLimit}
    `;
  }
}

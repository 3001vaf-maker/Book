import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { BusinessStateService } from '../business-state/business-state.service';
import { PrismaService } from '../prisma.service';

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
  bookingAccountId: string | null;
  cardPhone: string;
  uei: string;
  externalUserId: string;
  display: string;
  verifiedAt: Date | null;
  updatedAt: Date;
};

type CommunicationMessageRow = {
  id: string;
  tenantId: string;
  cardPhone: string;
  uei: string;
  direction: string;
  kind: string;
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

function personHasPhone(person: Record<string, any>, phone: string) {
  const phones = Array.isArray(person.phones) ? person.phones : [];
  return phones.some((value) => canonicalPhone(value) === phone);
}

function personAccounts(person: Record<string, any>) {
  return [...new Set((Array.isArray(person.accounts) ? person.accounts : []).map((value) => text(value)).filter(Boolean))];
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

  async bindTelegramEntry(tenantId: string, accountId: string, entryToken: unknown) {
    const ticket = await this.telegramEntry(tenantId, entryToken);
    const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId }, select: { phone: true } });
    if (!account) throw new NotFoundException('Клиентский аккаунт не найден');
    const cardPhone = canonicalPhone(account.phone);
    if (!cardPhone) throw new BadRequestException('У клиента не определён телефон');

    const telegramRows = await this.prisma.$queryRaw<TelegramIdentityRow[]>`
      SELECT "id", "bookingAccountId", "cardPhone", "uei", "externalUserId", "display", "verifiedAt", "updatedAt"
      FROM "CommunicationIdentity"
      WHERE "tenantId" = ${tenantId} AND "channel" = 'TELEGRAM' AND "externalUserId" = ${ticket.telegramUserId}
      LIMIT 1
    `;
    const existingTelegram = telegramRows[0] || null;
    const samePhone = Boolean(existingTelegram && canonicalPhone(existingTelegram.cardPhone) === cardPhone);

    const business = await this.businessState.get(tenantId);
    const phoneMatch = (Array.isArray(business.people) ? business.people : [])
      .map((value) => objectValue(value)).find((person) => personHasPhone(person, cardPhone)) || null;
    const match = existingTelegram?.bookingAccountId === accountId
      ? 'account+telegram'
      : samePhone ? 'phone+telegram' : phoneMatch ? 'phone' : 'new';

    const identity = await this.businessState.bookingIdentityForAccount(tenantId, accountId);
    const personKey = text(identity?.person?.key || identity?.matchedPerson?.key);
    if (!personKey) throw new NotFoundException('Клиентская карта не найдена');
    const uei = text(identity?.uei);
    const display = telegramUsername(ticket.username);

    if (existingTelegram) {
      if (existingTelegram.bookingAccountId && existingTelegram.bookingAccountId !== accountId) {
        throw new ConflictException('Этот Telegram уже связан с другим клиентским аккаунтом');
      }
      if (!existingTelegram.bookingAccountId && !samePhone && existingTelegram.uei && uei && existingTelegram.uei !== uei) {
        throw new ConflictException('Этот Telegram уже связан с другим клиентом');
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

      await tx.$executeRaw`
        INSERT INTO "CommunicationIdentity" (
          "id", "tenantId", "bookingAccountId", "cardPhone", "uei", "channel", "externalUserId", "display", "verifiedAt", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${tenantId}, ${accountId}, ${cardPhone}, ${resolvedUei}, 'TELEGRAM', ${ticket.telegramUserId}, ${display}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("tenantId", "channel", "externalUserId") DO UPDATE
        SET "bookingAccountId" = EXCLUDED."bookingAccountId",
            "cardPhone" = EXCLUDED."cardPhone",
            "uei" = EXCLUDED."uei",
            "display" = EXCLUDED."display",
            "verifiedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
      `;
    });

    return { linked: true, channel: 'TELEGRAM', username: display, match };
  }

  private async telegramAnchors(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const requestedPhone = canonicalPhone(input?.phone);
    const requestedUei = text(input?.uei);
    if (!requestedPhone && !requestedUei) throw new BadRequestException('Не указан клиент');

    const business = await this.businessState.get(tenantId);
    const people = (Array.isArray(business.people) ? business.people : []).map((value) => objectValue(value));
    const relations = objectValue(business.uei?.relations);
    const memberKeys = new Set<string>();
    const ueis = new Set<string>();
    const phones = new Set<string>();
    const accountIds = new Set<string>();

    if (requestedPhone) phones.add(requestedPhone);
    if (requestedUei) ueis.add(requestedUei);

    const addUeiMembers = (uei: string) => {
      if (!uei) return;
      ueis.add(uei);
      for (const person of people) {
        const key = text(person.key);
        if (key && text(relations[`person:${key}`]) === uei) memberKeys.add(key);
      }
    };

    addUeiMembers(requestedUei);
    for (const person of people) {
      const key = text(person.key);
      if (!key) continue;
      if (requestedPhone && personHasPhone(person, requestedPhone)) {
        memberKeys.add(key);
        addUeiMembers(text(relations[`person:${key}`]));
      }
    }

    for (const person of people) {
      const key = text(person.key);
      if (!key || !memberKeys.has(key)) continue;
      for (const phone of Array.isArray(person.phones) ? person.phones : []) {
        const normalized = canonicalPhone(phone);
        if (normalized) phones.add(normalized);
      }
      for (const accountId of personAccounts(person)) accountIds.add(accountId);
      const currentUei = text(relations[`person:${key}`]);
      if (currentUei) ueis.add(currentUei);
    }

    const accounts = accountIds.size
      ? await this.prisma.bookingAccount.findMany({
          where: { tenantId, id: { in: [...accountIds] } },
          select: { id: true, phone: true, uei: true },
        })
      : [];
    for (const account of accounts) {
      const phone = canonicalPhone(account.phone);
      if (phone) phones.add(phone);
      const accountUei = text(account.uei);
      if (accountUei) ueis.add(accountUei);
    }

    return { requestedPhone, requestedUei, accountIds, phones, ueis, accounts };
  }

  async telegramIdentity(tenantId: string, input: { phone?: unknown; uei?: unknown }) {
    const anchors = await this.telegramAnchors(tenantId, input || {});
    const rows = await this.prisma.$queryRaw<TelegramIdentityRow[]>`
      SELECT "id", "bookingAccountId", "cardPhone", "uei", "externalUserId", "display", "verifiedAt", "updatedAt"
      FROM "CommunicationIdentity"
      WHERE "tenantId" = ${tenantId} AND "channel" = 'TELEGRAM'
      ORDER BY "verifiedAt" DESC NULLS LAST, "updatedAt" DESC
    `;

    const byAccount = rows.find((row) => row.bookingAccountId && anchors.accountIds.has(row.bookingAccountId));
    const byPhone = rows.find((row) => anchors.phones.has(canonicalPhone(row.cardPhone)));
    const byUei = rows.find((row) => text(row.uei) && anchors.ueis.has(text(row.uei)));
    const identity = byAccount || byPhone || byUei || null;
    if (!identity) return null;

    let resolvedAccountId = text(identity.bookingAccountId);
    if (!resolvedAccountId) {
      const rowPhone = canonicalPhone(identity.cardPhone);
      const matchingAccounts = anchors.accounts.filter((account) => canonicalPhone(account.phone) === rowPhone);
      if (matchingAccounts.length === 1) resolvedAccountId = matchingAccounts[0].id;
      else if (anchors.accountIds.size === 1) resolvedAccountId = [...anchors.accountIds][0];
    }

    const resolvedAccount = resolvedAccountId ? anchors.accounts.find((account) => account.id === resolvedAccountId) : null;
    const resolvedPhone = canonicalPhone(resolvedAccount?.phone) || canonicalPhone(identity.cardPhone) || anchors.requestedPhone;
    const resolvedUei = anchors.requestedUei || text(resolvedAccount?.uei) || [...anchors.ueis][0] || text(identity.uei);

    if (resolvedAccountId !== text(identity.bookingAccountId)
      || (resolvedPhone && resolvedPhone !== canonicalPhone(identity.cardPhone))
      || (resolvedUei && resolvedUei !== text(identity.uei))) {
      await this.prisma.$executeRaw`
        UPDATE "CommunicationIdentity"
        SET "bookingAccountId" = ${resolvedAccountId || null},
            "cardPhone" = ${resolvedPhone || identity.cardPhone},
            "uei" = ${resolvedUei},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${identity.id} AND "tenantId" = ${tenantId}
      `;
    }

    return {
      ...identity,
      bookingAccountId: resolvedAccountId || null,
      cardPhone: resolvedPhone || identity.cardPhone,
      uei: resolvedUei,
    };
  }

  async recordMessage(tenantId: string, input: {
    phone?: unknown; uei?: unknown; direction?: unknown; kind?: unknown; channel?: unknown; body?: unknown; attachments?: unknown;
    externalMessageId?: unknown; externalThreadId?: unknown; status?: unknown; error?: unknown;
  }) {
    const cardPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    const direction = text(input?.direction).toLowerCase() || 'system';
    const kind = text(input?.kind).toLowerCase() || 'message';
    const channel = text(input?.channel).toUpperCase() || 'IN_APP';
    const body = text(input?.body);
    const attachments = normalizeAttachments(input?.attachments);
    const attachmentsJson = JSON.stringify(attachments);
    const status = text(input?.status).toLowerCase() || 'created';
    const externalMessageId = text(input?.externalMessageId);
    const externalThreadId = text(input?.externalThreadId);
    const error = text(input?.error).slice(0, 2000);
    if (!cardPhone && !uei) throw new BadRequestException('Не указан клиент');
    if (!body && !attachments.length) throw new BadRequestException('Пустое сообщение');
    const id = randomUUID();
    const now = new Date();
    await this.prisma.$executeRaw`
      INSERT INTO "CommunicationMessage" (
        "id", "tenantId", "cardPhone", "uei", "direction", "kind", "channel", "body", "attachments",
        "externalMessageId", "externalThreadId", "status", "createdAt", "sentAt", "deliveredAt", "failedAt", "error"
      ) VALUES (
        ${id}, ${tenantId}, ${cardPhone}, ${uei}, ${direction}, ${kind}, ${channel}, ${body}, ${attachmentsJson}::jsonb,
        ${externalMessageId}, ${externalThreadId}, ${status}, ${now},
        ${status === 'sent' ? now : null}, ${status === 'delivered' ? now : null}, ${status === 'failed' ? now : null}, ${error}
      ) ON CONFLICT DO NOTHING
    `;
    return { id, tenantId, cardPhone, uei, direction, kind, channel, body, attachments, externalMessageId, externalThreadId, status, createdAt: now, error };
  }

  async listThread(tenantId: string, input: { phone?: unknown; uei?: unknown }, limit = 300) {
    const cardPhone = canonicalPhone(input?.phone);
    const uei = text(input?.uei);
    if (!cardPhone && !uei) throw new BadRequestException('Не указан клиент');
    const safeLimit = Math.max(1, Math.min(1000, Math.floor(Number(limit) || 300)));
    return this.prisma.$queryRaw<CommunicationMessageRow[]>`
      SELECT "id", "tenantId", "cardPhone", "uei", "direction", "kind", "channel", "body", "attachments",
             "externalMessageId", "externalThreadId", "status", "createdAt", "sentAt", "deliveredAt", "readAt", "failedAt", "error"
      FROM "CommunicationMessage"
      WHERE "tenantId" = ${tenantId}
        AND ((${cardPhone} <> '' AND "cardPhone" = ${cardPhone}) OR (${uei} <> '' AND "uei" = ${uei}))
      ORDER BY "createdAt" ASC, "id" ASC LIMIT ${safeLimit}
    `;
  }

  async listThreads(tenantId: string, limit = 200) {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 200)));
    return this.prisma.$queryRaw<CommunicationMessageRow[]>`
      SELECT DISTINCT ON (COALESCE(NULLIF("uei", ''), "cardPhone"))
             "id", "tenantId", "cardPhone", "uei", "direction", "kind", "channel", "body", "attachments",
             "externalMessageId", "externalThreadId", "status", "createdAt", "sentAt", "deliveredAt", "readAt", "failedAt", "error"
      FROM "CommunicationMessage"
      WHERE "tenantId" = ${tenantId}
      ORDER BY COALESCE(NULLIF("uei", ''), "cardPhone"), "createdAt" DESC, "id" DESC
      LIMIT ${safeLimit}
    `;
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { BusinessStateService } from '../business-state/business-state.service';
import { PrismaService } from '../prisma.service';
import { PersonProfileThreadService } from './person-profile-thread.service';

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
  profileKey: string;
  actorAccountId: string | null;
  actorPersonKey: string;
  actorName: string;
  actorUei: string;
  cardPhone: string;
  uei: string;
  direction: string;
  kind: string;
  channel: string;
  body: string;
  content: unknown;
  attachments: unknown;
  externalMessageId: string;
  externalThreadId: string;
  status: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  error: string;
};

type MessageActor = { side: 'master' } | { side: 'client'; accountId: string };

const RICH_BLOCK_TYPES = new Set(['paragraph', 'heading', 'subheading', 'quote', 'list-item']);
const RICH_MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'code']);

function text(value: unknown) { return String(value ?? '').trim(); }
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
function tokenHash(value: string) { return createHash('sha256').update(value).digest('hex'); }

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

function normalizeRichContent(value: unknown, fallbackBody: unknown = '') {
  const source = objectValue(value);
  const blocks: Array<{ type: string; spans: Array<{ text: string; marks: string[] }> }> = [];
  let totalText = 0;
  for (const rawBlock of (Array.isArray(source.blocks) ? source.blocks : []).slice(0, 120)) {
    const block = objectValue(rawBlock);
    const type = RICH_BLOCK_TYPES.has(text(block.type).toLowerCase()) ? text(block.type).toLowerCase() : 'paragraph';
    const spans: Array<{ text: string; marks: string[] }> = [];
    for (const rawSpan of (Array.isArray(block.spans) ? block.spans : []).slice(0, 300)) {
      const span = objectValue(rawSpan);
      const spanText = String(span.text ?? '').replace(/\u0000/g, '').slice(0, 12000);
      if (!spanText) continue;
      totalText += spanText.length;
      if (totalText > 30000) throw new BadRequestException('Сообщение слишком длинное');
      const marks = [...new Set((Array.isArray(span.marks) ? span.marks : []).map((mark) => text(mark).toLowerCase()).filter((mark) => RICH_MARKS.has(mark)))];
      spans.push({ text: spanText, marks });
    }
    if (spans.length) blocks.push({ type, spans });
  }
  if (!blocks.length) {
    const fallback = text(fallbackBody).slice(0, 30000);
    if (fallback) blocks.push({ type: 'paragraph', spans: [{ text: fallback, marks: [] }] });
  }
  return { version: 1, blocks };
}

function richPlainText(value: unknown) {
  const normalized = normalizeRichContent(value);
  return normalized.blocks.map((block) => block.spans.map((span) => span.text).join('')).join('\n').trim();
}

@Injectable()
export class CommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessState: BusinessStateService,
    private readonly profiles: PersonProfileThreadService,
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
    const match = existingTelegram?.bookingAccountId === accountId ? 'account+telegram' : samePhone ? 'phone+telegram' : phoneMatch ? 'phone' : 'new';
    const identity = await this.businessState.bookingIdentityForAccount(tenantId, accountId);
    const personKey = text(identity?.person?.key || identity?.matchedPerson?.key);
    if (!personKey) throw new NotFoundException('Клиентская карта не найдена');
    const uei = text(identity?.uei);
    const display = telegramUsername(ticket.username);
    if (existingTelegram) {
      if (existingTelegram.bookingAccountId && existingTelegram.bookingAccountId !== accountId) throw new ConflictException('Этот Telegram уже связан с другим клиентским аккаунтом');
      if (!existingTelegram.bookingAccountId && !samePhone && existingTelegram.uei && uei && existingTelegram.uei !== uei) throw new ConflictException('Этот Telegram уже связан с другим клиентом');
    }
    const resolvedUei = uei || text(existingTelegram?.uei);
    await this.prisma.$transaction(async (tx) => {
      const used = await tx.$executeRaw`
        UPDATE "TelegramEntryTicket" SET "usedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${ticket.id} AND "usedAt" IS NULL AND "expiresAt" > CURRENT_TIMESTAMP
      `;
      if (!used) throw new ConflictException('Telegram-вход уже использован или истёк');
      await tx.$executeRaw`
        INSERT INTO "CommunicationIdentity" (
          "id", "tenantId", "bookingAccountId", "cardPhone", "uei", "channel", "externalUserId", "display", "verifiedAt", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${tenantId}, ${accountId}, ${cardPhone}, ${resolvedUei}, 'TELEGRAM', ${ticket.telegramUserId}, ${display}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("tenantId", "channel", "externalUserId") DO UPDATE
        SET "bookingAccountId" = EXCLUDED."bookingAccountId", "cardPhone" = EXCLUDED."cardPhone", "uei" = EXCLUDED."uei",
            "display" = EXCLUDED."display", "verifiedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
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
    const accountIdSet = new Set<string>();
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
      for (const accountId of personAccounts(person)) accountIdSet.add(accountId);
      const currentUei = text(relations[`person:${key}`]);
      if (currentUei) ueis.add(currentUei);
    }
    const accounts = accountIdSet.size ? await this.prisma.bookingAccount.findMany({
      where: { tenantId, id: { in: [...accountIdSet] } }, select: { id: true, phone: true, uei: true },
    }) : [];
    for (const account of accounts) {
      const phone = canonicalPhone(account.phone);
      if (phone) phones.add(phone);
      const accountUei = text(account.uei);
      if (accountUei) ueis.add(accountUei);
    }
    return { requestedPhone, requestedUei, accountIds: accountIdSet, phones, ueis, accounts };
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
        SET "bookingAccountId" = ${resolvedAccountId || null}, "cardPhone" = ${resolvedPhone || identity.cardPhone}, "uei" = ${resolvedUei}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${identity.id} AND "tenantId" = ${tenantId}
      `;
    }
    return { ...identity, bookingAccountId: resolvedAccountId || null, cardPhone: resolvedPhone || identity.cardPhone, uei: resolvedUei };
  }

  private async ensureBookingAccount(tenantId: string, accountId: string) {
    if (!accountId) return null;
    const account = await this.prisma.bookingAccount.findFirst({ where: { id: accountId, tenantId }, select: { id: true, phone: true, uei: true } });
    if (!account) throw new NotFoundException('Клиентский аккаунт не найден');
    return account;
  }

  async recordMessage(tenantId: string, input: {
    profileKey?: unknown;
    actorAccountId?: unknown;
    actorPersonKey?: unknown;
    actorName?: unknown;
    actorUei?: unknown;
    bookingAccountId?: unknown;
    phone?: unknown;
    uei?: unknown;
    direction?: unknown;
    kind?: unknown;
    channel?: unknown;
    body?: unknown;
    content?: unknown;
    attachments?: unknown;
    externalMessageId?: unknown;
    externalThreadId?: unknown;
    status?: unknown;
    error?: unknown;
  }) {
    const direction = text(input?.direction).toLowerCase() || 'system';
    const kind = text(input?.kind).toLowerCase() || 'message';
    const channel = text(input?.channel).toUpperCase() || 'IN_APP';
    const legacyAccountId = text(input?.bookingAccountId);
    const explicitActorAccountId = text(input?.actorAccountId);
    const accountAnchorId = explicitActorAccountId || legacyAccountId;
    const account = accountAnchorId ? await this.ensureBookingAccount(tenantId, accountAnchorId) : null;
    let profile = null as Awaited<ReturnType<PersonProfileThreadService['byProfileKey']>> | null;
    const requestedProfileKey = text(input?.profileKey);
    if (requestedProfileKey) profile = await this.profiles.byProfileKey(tenantId, requestedProfileKey);
    else if (accountAnchorId) profile = await this.profiles.byAccount(tenantId, accountAnchorId).catch(() => null);
    else profile = await this.profiles.byLegacy(tenantId, { phone: input?.phone, uei: input?.uei }).catch(() => null);

    const storedProfileKey = profile
      ? (direction === 'inbound' && accountAnchorId ? profile.sourcePersonKey : profile.profileKey)
      : requestedProfileKey;
    const actorAccountId = direction === 'inbound' ? accountAnchorId : '';
    const actorPersonKey = direction === 'inbound' ? (text(input?.actorPersonKey) || profile?.sourcePersonKey || '') : '';
    const actorName = direction === 'inbound' ? (text(input?.actorName) || profile?.sourceName || '') : '';
    const actorUei = direction === 'inbound' ? (text(input?.actorUei) || profile?.sourceUei || '') : '';
    const cardPhone = canonicalPhone(input?.phone) || canonicalPhone(account?.phone);
    const uei = text(input?.uei) || text(account?.uei) || text(profile?.profileUei);
    const content = normalizeRichContent(input?.content, input?.body);
    const body = richPlainText(content) || text(input?.body);
    const attachments = normalizeAttachments(input?.attachments);
    const status = text(input?.status).toLowerCase() || 'created';
    const externalMessageId = text(input?.externalMessageId);
    const externalThreadId = text(input?.externalThreadId);
    const error = text(input?.error).slice(0, 2000);
    if (!storedProfileKey && !cardPhone && !uei) throw new BadRequestException('Не указан клиент');
    if (!body && !attachments.length) throw new BadRequestException('Пустое сообщение');
    const id = randomUUID();
    const now = new Date();
    const attachmentsJson = JSON.stringify(attachments);
    const contentJson = JSON.stringify(content);
    await this.prisma.$executeRaw`
      INSERT INTO "CommunicationMessage" (
        "id", "tenantId", "profileKey", "actorAccountId", "actorPersonKey", "actorName", "actorUei",
        "cardPhone", "uei", "direction", "kind", "channel", "body", "content", "attachments",
        "externalMessageId", "externalThreadId", "status", "createdAt", "sentAt", "deliveredAt", "failedAt", "error"
      ) VALUES (
        ${id}, ${tenantId}, ${storedProfileKey}, ${actorAccountId || null}, ${actorPersonKey}, ${actorName}, ${actorUei},
        ${cardPhone}, ${uei}, ${direction}, ${kind}, ${channel}, ${body}, ${contentJson}::jsonb, ${attachmentsJson}::jsonb,
        ${externalMessageId}, ${externalThreadId}, ${status}, ${now},
        ${status === 'sent' ? now : null}, ${status === 'delivered' ? now : null}, ${status === 'failed' ? now : null}, ${error}
      ) ON CONFLICT DO NOTHING
    `;
    return {
      id, tenantId, profileKey: storedProfileKey, actorAccountId: actorAccountId || null, actorPersonKey, actorName, actorUei,
      cardPhone, uei, direction, kind, channel, body, content, attachments, externalMessageId, externalThreadId,
      status, createdAt: now, editedAt: null, deletedAt: null, error,
    };
  }

  private async messageById(tenantId: string, messageId: string) {
    const rows = await this.prisma.$queryRaw<CommunicationMessageRow[]>`
      SELECT "id", "tenantId", "profileKey", "actorAccountId", "actorPersonKey", "actorName", "actorUei",
             "cardPhone", "uei", "direction", "kind", "channel", "body", "content", "attachments",
             "externalMessageId", "externalThreadId", "status", "createdAt", "editedAt", "deletedAt",
             "sentAt", "deliveredAt", "readAt", "failedAt", "error"
      FROM "CommunicationMessage"
      WHERE "tenantId" = ${tenantId} AND "id" = ${messageId}
      LIMIT 1
    `;
    return rows[0] || null;
  }

  private assertMessageActor(message: CommunicationMessageRow, actor: MessageActor) {
    if (message.channel !== 'IN_APP') throw new BadRequestException('Можно изменять только внутренние сообщения');
    if (message.deletedAt) throw new BadRequestException('Сообщение уже удалено');
    if (actor.side === 'master') {
      if (message.direction !== 'outbound') throw new BadRequestException('Можно изменять только свои сообщения');
      return;
    }
    if (message.direction !== 'inbound' || message.actorAccountId !== actor.accountId) throw new BadRequestException('Можно изменять только свои сообщения');
  }

  async editMessage(tenantId: string, messageIdValue: unknown, actor: MessageActor, input: { body?: unknown; content?: unknown }) {
    const messageId = text(messageIdValue);
    const current = await this.messageById(tenantId, messageId);
    if (!current) throw new NotFoundException('Сообщение не найдено');
    this.assertMessageActor(current, actor);
    const content = normalizeRichContent(input?.content, input?.body);
    const body = richPlainText(content);
    if (!body) throw new BadRequestException('Пустое сообщение');
    const contentJson = JSON.stringify(content);
    await this.prisma.$executeRaw`
      UPDATE "CommunicationMessage" SET "body" = ${body}, "content" = ${contentJson}::jsonb, "editedAt" = CURRENT_TIMESTAMP
      WHERE "tenantId" = ${tenantId} AND "id" = ${messageId}
    `;
    return this.messageById(tenantId, messageId);
  }

  async deleteMessage(tenantId: string, messageIdValue: unknown, actor: MessageActor) {
    const messageId = text(messageIdValue);
    const current = await this.messageById(tenantId, messageId);
    if (!current) throw new NotFoundException('Сообщение не найдено');
    this.assertMessageActor(current, actor);
    await this.prisma.$executeRaw`
      UPDATE "CommunicationMessage"
      SET "body" = '', "content" = '{"version":1,"blocks":[]}'::jsonb, "attachments" = '[]'::jsonb,
          "status" = 'deleted', "deletedAt" = CURRENT_TIMESTAMP
      WHERE "tenantId" = ${tenantId} AND "id" = ${messageId}
    `;
    return this.messageById(tenantId, messageId);
  }

  async listThread(tenantId: string, input: { profileKey?: unknown; bookingAccountId?: unknown; phone?: unknown; uei?: unknown }, limit = 300) {
    const requestedProfileKey = text(input?.profileKey);
    const accountId = text(input?.bookingAccountId);
    let profile = null as Awaited<ReturnType<PersonProfileThreadService['byProfileKey']>> | null;
    if (requestedProfileKey) profile = await this.profiles.byProfileKey(tenantId, requestedProfileKey);
    else if (accountId) profile = await this.profiles.byAccount(tenantId, accountId);
    else profile = await this.profiles.byLegacy(tenantId, { phone: input?.phone, uei: input?.uei });
    if (!profile) throw new BadRequestException('Не указан профиль клиента');
    const safeLimit = Math.max(1, Math.min(1000, Math.floor(Number(limit) || 300)));
    const keys = profile.memberKeys.length ? profile.memberKeys : [profile.profileKey];
    const keySql = Prisma.join(keys.map((key) => Prisma.sql`${key}`));
    const rows = await this.prisma.$queryRaw<CommunicationMessageRow[]>(Prisma.sql`
      SELECT "id", "tenantId", "profileKey", "actorAccountId", "actorPersonKey", "actorName", "actorUei",
             "cardPhone", "uei", "direction", "kind", "channel", "body", "content", "attachments",
             "externalMessageId", "externalThreadId", "status", "createdAt", "editedAt", "deletedAt",
             "sentAt", "deliveredAt", "readAt", "failedAt", "error"
      FROM "CommunicationMessage"
      WHERE "tenantId" = ${tenantId} AND "profileKey" IN (${keySql})
      ORDER BY "createdAt" ASC, "id" ASC LIMIT ${safeLimit}
    `);
    return rows.map((row) => ({ ...row, threadProfileKey: profile.profileKey, threadProfileName: profile.profileName, threadProfileUei: profile.profileUei }));
  }

  async listThreads(tenantId: string, limit = 200) {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 200)));
    const scanLimit = Math.min(5000, safeLimit * 20);
    const rows = await this.prisma.$queryRaw<CommunicationMessageRow[]>`
      SELECT "id", "tenantId", "profileKey", "actorAccountId", "actorPersonKey", "actorName", "actorUei",
             "cardPhone", "uei", "direction", "kind", "channel", "body", "content", "attachments",
             "externalMessageId", "externalThreadId", "status", "createdAt", "editedAt", "deletedAt",
             "sentAt", "deliveredAt", "readAt", "failedAt", "error"
      FROM "CommunicationMessage"
      WHERE "tenantId" = ${tenantId} AND "profileKey" <> ''
      ORDER BY "createdAt" DESC, "id" DESC LIMIT ${scanLimit}
    `;
    const profileMap = await this.profiles.canonicalizeProfileKeys(tenantId, rows.map((row) => row.profileKey));
    const latest = new Map<string, CommunicationMessageRow & { threadProfileKey: string; threadProfileName: string; threadProfileUei: string }>();
    for (const row of rows) {
      const profile = profileMap.get(row.profileKey);
      const threadProfileKey = profile?.profileKey || row.profileKey;
      if (!threadProfileKey || latest.has(threadProfileKey)) continue;
      latest.set(threadProfileKey, {
        ...row,
        threadProfileKey,
        threadProfileName: profile?.profileName || '',
        threadProfileUei: profile?.profileUei || row.uei,
      });
      if (latest.size >= safeLimit) break;
    }
    return [...latest.values()];
  }
}

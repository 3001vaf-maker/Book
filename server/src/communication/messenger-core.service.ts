import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { CommunicationService } from './communication.service';

export type MessengerActor = 'professional' | 'person';

type Identity = { phone?: unknown; uei?: unknown };
type ConversationRow = {
  id: string; tenantId: string; type: string; title: string; personPhone: string; uei: string;
  archivedAt: Date | null; mutedUntil: Date | null; createdAt: Date; updatedAt: Date;
};
type ParticipantRow = {
  id: string; conversationId: string; kind: string; refId: string; display: string; role: string; joinedAt: Date; leftAt: Date | null;
};
type MessageRow = {
  id: string; tenantId: string; personPhone: string; uei: string; direction: string; kind: string; purpose: string | null; channel: string;
  body: string; attachments: unknown; externalMessageId: string; externalThreadId: string; status: string; createdAt: Date; sentAt: Date | null;
  deliveredAt: Date | null; readAt: Date | null; failedAt: Date | null; error: string; conversationId: string | null;
  authorParticipantId: string | null; replyToId: string | null; forwardedFromId: string | null; editedAt: Date | null; deletedAt: Date | null;
  pinnedAt: Date | null; reactions: unknown; poll: unknown;
};

function text(value: unknown) { return String(value ?? '').trim(); }
function canonicalPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}
function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}
function identityRef(identity: Identity) {
  return text(identity?.uei) || canonicalPhone(identity?.phone);
}
function cleanAttachments(value: unknown) {
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
    if (size > 8 * 1024 * 1024 || dataUrl.length > 12 * 1024 * 1024) throw new BadRequestException('Медиафайл слишком большой');
    totalEncoded += dataUrl.length;
    if (totalEncoded > 24 * 1024 * 1024) throw new BadRequestException('Слишком большой общий объём вложений');
    return { name, type, size, dataUrl };
  });
}
function normalizeMessage(row: MessageRow | null) {
  if (!row) return null;
  const deleted = Boolean(row.deletedAt);
  return {
    ...row,
    body: deleted ? '' : row.body,
    attachments: deleted ? [] : (Array.isArray(row.attachments) ? row.attachments : []),
    deleted,
    reactions: Array.isArray(row.reactions) ? row.reactions : [],
    poll: row.poll && typeof row.poll === 'object' ? row.poll : null,
    channel: 'CHAT',
  };
}

@Injectable()
export class MessengerCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communications: CommunicationService,
  ) {}

  private async directConversation(tenantId: string, identity: Identity) {
    const personPhone = canonicalPhone(identity?.phone);
    const uei = text(identity?.uei);
    if (!personPhone && !uei) throw new BadRequestException('Не указан человек');
    const rows = await this.prisma.$queryRaw<ConversationRow[]>`
      SELECT * FROM "MessengerConversation"
      WHERE "tenantId" = ${tenantId} AND "type" = 'DIRECT'
        AND ((${uei} <> '' AND "uei" = ${uei}) OR (${uei} = '' AND ${personPhone} <> '' AND "personPhone" = ${personPhone}))
      ORDER BY "updatedAt" DESC LIMIT 1
    `;
    if (rows[0]) return rows[0];

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "MessengerConversation" ("id", "tenantId", "type", "personPhone", "uei", "createdAt", "updatedAt")
      VALUES (${id}, ${tenantId}, 'DIRECT', ${personPhone}, ${uei}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT DO NOTHING
    `;
    const created = await this.prisma.$queryRaw<ConversationRow[]>`
      SELECT * FROM "MessengerConversation"
      WHERE "tenantId" = ${tenantId} AND "type" = 'DIRECT'
        AND ((${uei} <> '' AND "uei" = ${uei}) OR (${uei} = '' AND ${personPhone} <> '' AND "personPhone" = ${personPhone}))
      ORDER BY "updatedAt" DESC LIMIT 1
    `;
    const conversation = created[0];
    if (!conversation) throw new BadRequestException('Не удалось создать диалог');
    await this.ensureDirectParticipants(conversation);
    return conversation;
  }

  private async ensureDirectParticipants(conversation: ConversationRow) {
    const personRef = conversation.uei || conversation.personPhone;
    await this.prisma.$executeRaw`
      INSERT INTO "MessengerParticipant" ("id", "conversationId", "kind", "refId", "display", "role", "joinedAt")
      VALUES (${randomUUID()}, ${conversation.id}, 'PROFESSIONAL', ${conversation.tenantId}, '', 'OWNER', CURRENT_TIMESTAMP)
      ON CONFLICT ("conversationId", "kind", "refId") DO NOTHING
    `;
    if (personRef) {
      await this.prisma.$executeRaw`
        INSERT INTO "MessengerParticipant" ("id", "conversationId", "kind", "refId", "display", "role", "joinedAt")
        VALUES (${randomUUID()}, ${conversation.id}, 'PERSON', ${personRef}, '', 'MEMBER', CURRENT_TIMESTAMP)
        ON CONFLICT ("conversationId", "kind", "refId") DO NOTHING
      `;
    }
  }

  private async participant(conversationId: string, actor: MessengerActor, identity: Identity = {}) {
    const kind = actor === 'professional' ? 'PROFESSIONAL' : 'PERSON';
    const refId = actor === 'professional' ? '' : identityRef(identity);
    const rows = actor === 'professional'
      ? await this.prisma.$queryRaw<ParticipantRow[]>`
          SELECT * FROM "MessengerParticipant" WHERE "conversationId" = ${conversationId} AND "kind" = 'PROFESSIONAL' AND "leftAt" IS NULL LIMIT 1
        `
      : await this.prisma.$queryRaw<ParticipantRow[]>`
          SELECT * FROM "MessengerParticipant" WHERE "conversationId" = ${conversationId} AND "kind" = 'PERSON' AND "refId" = ${refId} AND "leftAt" IS NULL LIMIT 1
        `;
    if (!rows[0]) throw new ForbiddenException('Нет доступа к диалогу');
    return rows[0];
  }

  async ensureDirect(tenantId: string, identity: Identity) {
    const conversation = await this.directConversation(tenantId, identity);
    await this.ensureDirectParticipants(conversation);
    return conversation;
  }

  async recordDirectMessage(
    tenantId: string,
    actor: MessengerActor,
    identity: Identity,
    input: { body?: unknown; attachments?: unknown; replyToId?: unknown } = {},
  ) {
    const conversation = await this.ensureDirect(tenantId, identity);
    const author = await this.participant(conversation.id, actor, identity);
    const direction = actor === 'professional' ? 'outbound' : 'inbound';
    const created = await this.communications.recordMessage(tenantId, {
      phone: conversation.personPhone,
      uei: conversation.uei,
      direction,
      kind: Array.isArray(input.attachments) && input.attachments.length ? 'media' : 'message',
      purpose: 'DIRECT',
      channel: 'IN_APP',
      body: input.body,
      attachments: input.attachments,
      status: 'sent',
    });
    const replyToId = text(input.replyToId);
    if (replyToId) await this.assertMessageInConversation(conversation.id, replyToId);
    await this.prisma.$executeRaw`
      UPDATE "CommunicationMessage"
      SET "conversationId" = ${conversation.id}, "authorParticipantId" = ${author.id}, "replyToId" = ${replyToId || null}
      WHERE "id" = ${created.id} AND "tenantId" = ${tenantId}
    `;
    await this.touchConversation(conversation.id);
    return this.messageById(tenantId, created.id);
  }

  private async touchConversation(conversationId: string) {
    await this.prisma.$executeRaw`UPDATE "MessengerConversation" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${conversationId}`;
  }

  private async assertConversation(tenantId: string, conversationId: string) {
    const rows = await this.prisma.$queryRaw<ConversationRow[]>`
      SELECT * FROM "MessengerConversation" WHERE "id" = ${conversationId} AND "tenantId" = ${tenantId} LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Диалог не найден');
    return rows[0];
  }

  private async assertMessageInConversation(conversationId: string, messageId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "CommunicationMessage" WHERE "id" = ${messageId} AND "conversationId" = ${conversationId} LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Сообщение не найдено');
  }

  private async messageById(tenantId: string, messageId: string) {
    const rows = await this.prisma.$queryRaw<MessageRow[]>`
      SELECT "id", "tenantId", "personPhone", "uei", "direction", "kind", "purpose", "channel", "body", "attachments",
        "externalMessageId", "externalThreadId", "status", "createdAt", "sentAt", "deliveredAt", "readAt", "failedAt", "error",
        "conversationId", "authorParticipantId", "replyToId", "forwardedFromId", "editedAt", "deletedAt", "pinnedAt", "reactions", "poll"
      FROM "CommunicationMessage" WHERE "id" = ${messageId} AND "tenantId" = ${tenantId} LIMIT 1
    `;
    return normalizeMessage(rows[0] || null);
  }

  async directMessages(tenantId: string, identity: Identity, actor: MessengerActor) {
    const conversation = await this.ensureDirect(tenantId, identity);
    await this.participant(conversation.id, actor, identity);
    return this.messages(tenantId, conversation.id, actor, identity);
  }

  async messages(tenantId: string, conversationId: string, actor: MessengerActor, identity: Identity = {}, limit = 500) {
    await this.assertConversation(tenantId, conversationId);
    await this.participant(conversationId, actor, identity);
    const safeLimit = Math.max(1, Math.min(1000, Math.floor(Number(limit) || 500)));
    const rows = await this.prisma.$queryRaw<MessageRow[]>`
      SELECT "id", "tenantId", "personPhone", "uei", "direction", "kind", "purpose", "channel", "body", "attachments",
        "externalMessageId", "externalThreadId", "status", "createdAt", "sentAt", "deliveredAt", "readAt", "failedAt", "error",
        "conversationId", "authorParticipantId", "replyToId", "forwardedFromId", "editedAt", "deletedAt", "pinnedAt", "reactions", "poll"
      FROM "CommunicationMessage"
      WHERE "tenantId" = ${tenantId} AND "conversationId" = ${conversationId} AND "purpose" = 'DIRECT' AND "channel" = 'IN_APP'
      ORDER BY "createdAt" ASC, "id" ASC LIMIT ${safeLimit}
    `;
    return rows.map(normalizeMessage);
  }

  async conversations(tenantId: string, actor: MessengerActor, identity: Identity = {}) {
    const personRef = identityRef(identity);
    const unreadDirection = actor === 'professional' ? 'inbound' : 'outbound';
    const rows = actor === 'professional'
      ? await this.prisma.$queryRaw<any[]>`
          SELECT c.*,
            COALESCE((SELECT m."body" FROM "CommunicationMessage" m WHERE m."conversationId" = c."id" AND m."channel" = 'IN_APP' ORDER BY m."createdAt" DESC, m."id" DESC LIMIT 1), '') AS "body",
            (SELECT m."createdAt" FROM "CommunicationMessage" m WHERE m."conversationId" = c."id" AND m."channel" = 'IN_APP' ORDER BY m."createdAt" DESC, m."id" DESC LIMIT 1) AS "lastMessageAt",
            (SELECT COUNT(*)::int FROM "CommunicationMessage" m WHERE m."conversationId" = c."id" AND m."channel" = 'IN_APP' AND m."direction" = ${unreadDirection} AND m."readAt" IS NULL AND m."failedAt" IS NULL) AS "unreadCount"
          FROM "MessengerConversation" c
          WHERE c."tenantId" = ${tenantId}
          ORDER BY COALESCE((SELECT MAX(m."createdAt") FROM "CommunicationMessage" m WHERE m."conversationId" = c."id" AND m."channel" = 'IN_APP'), c."updatedAt") DESC
        `
      : await this.prisma.$queryRaw<any[]>`
          SELECT c.*,
            COALESCE((SELECT m."body" FROM "CommunicationMessage" m WHERE m."conversationId" = c."id" AND m."channel" = 'IN_APP' ORDER BY m."createdAt" DESC, m."id" DESC LIMIT 1), '') AS "body",
            (SELECT m."createdAt" FROM "CommunicationMessage" m WHERE m."conversationId" = c."id" AND m."channel" = 'IN_APP' ORDER BY m."createdAt" DESC, m."id" DESC LIMIT 1) AS "lastMessageAt",
            (SELECT COUNT(*)::int FROM "CommunicationMessage" m WHERE m."conversationId" = c."id" AND m."channel" = 'IN_APP' AND m."direction" = ${unreadDirection} AND m."readAt" IS NULL AND m."failedAt" IS NULL) AS "unreadCount"
          FROM "MessengerConversation" c
          INNER JOIN "MessengerParticipant" p ON p."conversationId" = c."id" AND p."kind" = 'PERSON' AND p."refId" = ${personRef} AND p."leftAt" IS NULL
          WHERE c."tenantId" = ${tenantId}
          ORDER BY COALESCE((SELECT MAX(m."createdAt") FROM "CommunicationMessage" m WHERE m."conversationId" = c."id" AND m."channel" = 'IN_APP'), c."updatedAt") DESC
        `;
    return rows;
  }

  async createGroup(tenantId: string, titleValue: unknown, participantsValue: unknown) {
    const title = text(titleValue).slice(0, 120);
    if (!title) throw new BadRequestException('Укажите название группы');
    const participants = (Array.isArray(participantsValue) ? participantsValue : [])
      .map((value) => objectValue(value))
      .map((value) => ({ phone: canonicalPhone(value.phone), uei: text(value.uei), display: text(value.display).slice(0, 120) }))
      .filter((value) => value.phone || value.uei);
    if (!participants.length) throw new BadRequestException('Добавьте участника');
    const conversationId = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "MessengerConversation" ("id", "tenantId", "type", "title", "createdAt", "updatedAt")
      VALUES (${conversationId}, ${tenantId}, 'GROUP', ${title}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    await this.prisma.$executeRaw`
      INSERT INTO "MessengerParticipant" ("id", "conversationId", "kind", "refId", "display", "role", "joinedAt")
      VALUES (${randomUUID()}, ${conversationId}, 'PROFESSIONAL', ${tenantId}, '', 'OWNER', CURRENT_TIMESTAMP)
    `;
    for (const person of participants) {
      const refId = person.uei || person.phone;
      await this.prisma.$executeRaw`
        INSERT INTO "MessengerParticipant" ("id", "conversationId", "kind", "refId", "display", "role", "joinedAt")
        VALUES (${randomUUID()}, ${conversationId}, 'PERSON', ${refId}, ${person.display}, 'MEMBER', CURRENT_TIMESTAMP)
        ON CONFLICT ("conversationId", "kind", "refId") DO NOTHING
      `;
    }
    return this.assertConversation(tenantId, conversationId);
  }

  async sendToConversation(
    tenantId: string,
    conversationId: string,
    actor: MessengerActor,
    identity: Identity,
    input: { body?: unknown; attachments?: unknown; replyToId?: unknown; kind?: unknown; poll?: unknown; forwardedFromId?: unknown } = {},
  ) {
    const conversation = await this.assertConversation(tenantId, conversationId);
    if (conversation.type === 'DIRECT') {
      return this.recordDirectMessage(tenantId, actor, { phone: conversation.personPhone, uei: conversation.uei }, input);
    }
    const author = await this.participant(conversationId, actor, identity);
    const body = text(input.body);
    const attachments = cleanAttachments(input.attachments);
    const kind = text(input.kind).toLowerCase() || (attachments.length ? 'media' : 'message');
    const poll = input.poll && typeof input.poll === 'object' ? input.poll : null;
    if (!body && !attachments.length && !poll) throw new BadRequestException('Пустое сообщение');
    const replyToId = text(input.replyToId);
    if (replyToId) await this.assertMessageInConversation(conversationId, replyToId);
    const forwardedFromId = text(input.forwardedFromId);
    const id = randomUUID();
    const attachmentsJson = JSON.stringify(attachments);
    const pollJson = poll ? JSON.stringify(poll) : null;
    const direction = actor === 'professional' ? 'outbound' : 'inbound';
    await this.prisma.$executeRaw`
      INSERT INTO "CommunicationMessage" (
        "id", "tenantId", "personPhone", "uei", "direction", "kind", "purpose", "channel", "body", "attachments",
        "status", "createdAt", "sentAt", "conversationId", "authorParticipantId", "replyToId", "forwardedFromId", "poll"
      ) VALUES (
        ${id}, ${tenantId}, '', '', ${direction}, ${kind}, 'DIRECT', 'IN_APP', ${body}, ${attachmentsJson}::jsonb,
        'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${conversationId}, ${author.id}, ${replyToId || null}, ${forwardedFromId || null}, ${pollJson}::jsonb
      )
    `;
    await this.touchConversation(conversationId);
    return this.messageById(tenantId, id);
  }

  private async assertOwnMessage(tenantId: string, messageId: string, actor: MessengerActor, identity: Identity = {}) {
    const message = await this.messageById(tenantId, messageId);
    if (!message || !message.conversationId) throw new NotFoundException('Сообщение не найдено');
    const participant = await this.participant(message.conversationId, actor, identity);
    if (message.authorParticipantId !== participant.id) throw new ForbiddenException('Можно изменить только своё сообщение');
    return { message, participant };
  }

  async editMessage(tenantId: string, messageId: string, actor: MessengerActor, identity: Identity, bodyValue: unknown) {
    const { message } = await this.assertOwnMessage(tenantId, messageId, actor, identity);
    if (message.deletedAt) throw new BadRequestException('Сообщение удалено');
    if (message.poll) throw new BadRequestException('Опрос редактируется отдельно');
    const body = text(bodyValue);
    if (!body && !(Array.isArray(message.attachments) && message.attachments.length)) throw new BadRequestException('Пустое сообщение');
    await this.prisma.$executeRaw`
      UPDATE "CommunicationMessage" SET "body" = ${body}, "editedAt" = CURRENT_TIMESTAMP WHERE "id" = ${messageId} AND "tenantId" = ${tenantId}
    `;
    return this.messageById(tenantId, messageId);
  }

  async deleteMessage(tenantId: string, messageId: string, actor: MessengerActor, identity: Identity) {
    const { message } = await this.assertOwnMessage(tenantId, messageId, actor, identity);
    await this.prisma.$executeRaw`
      UPDATE "CommunicationMessage" SET "deletedAt" = COALESCE("deletedAt", CURRENT_TIMESTAMP) WHERE "id" = ${messageId} AND "tenantId" = ${tenantId}
    `;
    return this.messageById(tenantId, messageId);
  }

  async toggleReaction(tenantId: string, messageId: string, actor: MessengerActor, identity: Identity, emojiValue: unknown) {
    const emoji = text(emojiValue).slice(0, 16);
    if (!emoji) throw new BadRequestException('Не выбрана реакция');
    const message = await this.messageById(tenantId, messageId);
    if (!message || !message.conversationId) throw new NotFoundException('Сообщение не найдено');
    const participant = await this.participant(message.conversationId, actor, identity);
    const reactions = Array.isArray(message.reactions) ? [...message.reactions] as any[] : [];
    const index = reactions.findIndex((value) => value?.participantId === participant.id && value?.emoji === emoji);
    if (index >= 0) reactions.splice(index, 1);
    else reactions.push({ participantId: participant.id, emoji });
    const json = JSON.stringify(reactions);
    await this.prisma.$executeRaw`UPDATE "CommunicationMessage" SET "reactions" = ${json}::jsonb WHERE "id" = ${messageId} AND "tenantId" = ${tenantId}`;
    return this.messageById(tenantId, messageId);
  }

  async togglePin(tenantId: string, messageId: string, actor: MessengerActor, identity: Identity) {
    const message = await this.messageById(tenantId, messageId);
    if (!message || !message.conversationId) throw new NotFoundException('Сообщение не найдено');
    await this.participant(message.conversationId, actor, identity);
    await this.prisma.$executeRaw`
      UPDATE "CommunicationMessage" SET "pinnedAt" = CASE WHEN "pinnedAt" IS NULL THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE "id" = ${messageId} AND "tenantId" = ${tenantId}
    `;
    return this.messageById(tenantId, messageId);
  }

  async forwardMessage(
    tenantId: string,
    messageId: string,
    actor: MessengerActor,
    actorIdentity: Identity,
    targetConversationId: string,
  ) {
    const original = await this.messageById(tenantId, messageId);
    if (!original || !original.conversationId || original.deletedAt) throw new NotFoundException('Сообщение не найдено');
    await this.participant(original.conversationId, actor, actorIdentity);
    return this.sendToConversation(tenantId, targetConversationId, actor, actorIdentity, {
      body: original.body,
      attachments: original.attachments,
      forwardedFromId: original.id,
    });
  }

  async createPoll(
    tenantId: string,
    conversationId: string,
    actor: MessengerActor,
    identity: Identity,
    input: { question?: unknown; options?: unknown },
  ) {
    const question = text(input?.question).slice(0, 300);
    const options = (Array.isArray(input?.options) ? input.options : [])
      .map((value) => text(value).slice(0, 120)).filter(Boolean).slice(0, 10)
      .map((label) => ({ id: randomUUID(), label, votes: [] as string[] }));
    if (!question || options.length < 2) throw new BadRequestException('Для опроса нужен вопрос и минимум два варианта');
    return this.sendToConversation(tenantId, conversationId, actor, identity, {
      kind: 'poll', body: question, poll: { question, options, closed: false },
    });
  }

  async votePoll(tenantId: string, messageId: string, actor: MessengerActor, identity: Identity, optionIdValue: unknown) {
    const optionId = text(optionIdValue);
    const message = await this.messageById(tenantId, messageId);
    if (!message || !message.conversationId || !message.poll) throw new NotFoundException('Опрос не найден');
    const participant = await this.participant(message.conversationId, actor, identity);
    const poll = objectValue(message.poll);
    if (poll.closed === true) throw new BadRequestException('Опрос закрыт');
    const options = (Array.isArray(poll.options) ? poll.options : []).map((raw) => {
      const option = objectValue(raw);
      const votes = Array.isArray(option.votes) ? option.votes.map(text).filter(Boolean) : [];
      return { ...option, votes: votes.filter((id) => id !== participant.id) };
    });
    const selected = options.find((option) => text(option.id) === optionId);
    if (!selected) throw new BadRequestException('Вариант не найден');
    selected.votes.push(participant.id);
    const json = JSON.stringify({ ...poll, options });
    await this.prisma.$executeRaw`UPDATE "CommunicationMessage" SET "poll" = ${json}::jsonb WHERE "id" = ${messageId} AND "tenantId" = ${tenantId}`;
    return this.messageById(tenantId, messageId);
  }

  async search(tenantId: string, actor: MessengerActor, identity: Identity, queryValue: unknown, conversationId = '') {
    const query = text(queryValue).slice(0, 120);
    if (!query) return [];
    const pattern = `%${query.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    if (conversationId) {
      await this.assertConversation(tenantId, conversationId);
      await this.participant(conversationId, actor, identity);
      const rows = await this.prisma.$queryRaw<MessageRow[]>`
        SELECT "id", "tenantId", "personPhone", "uei", "direction", "kind", "purpose", "channel", "body", "attachments",
          "externalMessageId", "externalThreadId", "status", "createdAt", "sentAt", "deliveredAt", "readAt", "failedAt", "error",
          "conversationId", "authorParticipantId", "replyToId", "forwardedFromId", "editedAt", "deletedAt", "pinnedAt", "reactions", "poll"
        FROM "CommunicationMessage"
        WHERE "tenantId" = ${tenantId} AND "conversationId" = ${conversationId} AND "channel" = 'IN_APP' AND "deletedAt" IS NULL AND "body" ILIKE ${pattern}
        ORDER BY "createdAt" DESC LIMIT 100
      `;
      return rows.map(normalizeMessage);
    }
    if (actor !== 'professional') throw new BadRequestException('Выберите диалог');
    const rows = await this.prisma.$queryRaw<MessageRow[]>`
      SELECT "id", "tenantId", "personPhone", "uei", "direction", "kind", "purpose", "channel", "body", "attachments",
        "externalMessageId", "externalThreadId", "status", "createdAt", "sentAt", "deliveredAt", "readAt", "failedAt", "error",
        "conversationId", "authorParticipantId", "replyToId", "forwardedFromId", "editedAt", "deletedAt", "pinnedAt", "reactions", "poll"
      FROM "CommunicationMessage"
      WHERE "tenantId" = ${tenantId} AND "channel" = 'IN_APP' AND "deletedAt" IS NULL AND "body" ILIKE ${pattern}
      ORDER BY "createdAt" DESC LIMIT 100
    `;
    return rows.map(normalizeMessage);
  }

  async setConversationState(tenantId: string, conversationId: string, actor: MessengerActor, identity: Identity, input: { archived?: unknown; muted?: unknown }) {
    await this.assertConversation(tenantId, conversationId);
    await this.participant(conversationId, actor, identity);
    const archived = input?.archived === true;
    const muted = input?.muted === true;
    await this.prisma.$executeRaw`
      UPDATE "MessengerConversation"
      SET "archivedAt" = ${archived ? new Date() : null}, "mutedUntil" = ${muted ? new Date('2999-12-31T00:00:00.000Z') : null}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${conversationId} AND "tenantId" = ${tenantId}
    `;
    return this.assertConversation(tenantId, conversationId);
  }
}
